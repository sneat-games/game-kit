// Generic WebRTC PvP transport, extracted from bidding-tictactoe/web/src/
// pvp/peer.ts. Opens a DataChannel between a host and a guest via the
// shared Cloudflare Worker signaling relay (see webrtc-relay/index.ts),
// then hands back a `PeerHandle` the game sends/receives `WireMessage`s on.
//
// The relay's routes are namespaced `gameId`-first so room codes can't
// collide across games:
//
//   POST /reserve/{gameId}/{roomId}
//   POST /signal/{gameId}/{roomId}/{role}/{type}   -- {role} publishes
//   GET  /signal/{gameId}/{roomId}/{role}/{type}   -- read what {role} published
//
// where `{role}` is "host" | "guest" and `{type}` is "offer" | "answer" |
// "ice". Each side POSTs to its OWN role's slot and GETs the OTHER side's:
// the host posts its offer to .../host/offer and the guest reads it from
// that same path; the guest posts its answer to .../guest/answer and the
// host reads it from there. ICE candidates work the same way, except the
// relay APPENDS each POST to a newline-joined list rather than overwriting
// it, and a GET always returns the whole accumulated list (it never
// consumes/clears entries) — so a poller must (a) split the response on
// "\n" and parse each line as its own candidate, not the response as a
// whole, and (b) remember how many lines it has already added, or it will
// re-add the same candidates (and hammer the relay) on every poll. BTTT's
// own peer.ts predates the shared relay and did neither; see `drainIce`
// below for the fix.
//
// `roomId` (see room.ts) acts as an unguessable capability: only someone
// holding the room link can connect. WireMessage is generic — games choose
// their own commit/reveal/move payload shapes; the kit only moves JSON
// across the wire and tells you when a message of a given `kind` arrives.

import { defaultRelayBase } from "./room.js";

export type WireMessage =
  | { kind: "hello"; game: string; protocol: 1; config: unknown }
  | { kind: "hello-ack" }
  | { kind: "commit"; turn: number; hash: string; public?: unknown }
  | { kind: "reveal"; turn: number; bid: number; move?: unknown; salt: string }
  | { kind: "assign"; turn: number; mover: 0 | 1 }
  | { kind: "move"; turn: number; seq?: number; move: unknown }
  | { kind: "rematch-request" }
  | { kind: "rematch-accept" }
  | { kind: "leave" };

export type PeerRole = "host" | "guest";

export interface PeerHandle {
  /** The host is always player 0; the guest is always player 1. */
  readonly role: PeerRole;
  readonly dataChannel: RTCDataChannel;
  send(msg: WireMessage): void;
  close(): void;
  onMessage(cb: (msg: WireMessage) => void): void;
  /** Unregister a message callback. A finished turn MUST call this, or its
   *  stale handler keeps firing against a state that has moved on. */
  offMessage(cb: (msg: WireMessage) => void): void;
  onClose(cb: () => void): void;
  offClose(cb: () => void): void;
}

type SignalType = "offer" | "answer" | "ice";

/** Signaling relay client, scoped to one room and one side of the
 *  connection. Only used during connection setup; once the DataChannel is
 *  open, no further signaling traffic should occur. */
interface SignalingClient {
  /** Publish this side's own offer/answer/ice under its own role slot. */
  postOwn(type: SignalType, body: string): Promise<void>;
  /** Read what the OTHER side has published. */
  pollOther(type: SignalType): Promise<string | null>;
}

function signalingClient(relayBase: string, gameId: string, roomId: string, ownRole: PeerRole): SignalingClient {
  const otherRole: PeerRole = ownRole === "host" ? "guest" : "host";
  const path = (role: PeerRole, type: SignalType) =>
    `${relayBase}/signal/${encodeURIComponent(gameId)}/${encodeURIComponent(roomId)}/${role}/${type}`;
  return {
    async postOwn(type, body) {
      const res = await fetch(path(ownRole, type), {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
      });
      if (!res.ok) throw new Error(`signaling post ${type}: ${res.status}`);
    },
    async pollOther(type) {
      const res = await fetch(path(otherRole, type));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`signaling poll ${type}: ${res.status}`);
      return await res.text();
    },
  };
}

export interface PeerOptions {
  gameId: string;
  roomId: string;
  /** Overrides the relay's base URL; see room.ts's `defaultRelayBase`. */
  relayBase?: string;
  rtcConfig?: RTCConfiguration;
}

/** Create the host peer: creates the offer, publishes it, waits for the
 *  guest's answer, and opens the DataChannel it created. */
export async function hostPeer(opts: PeerOptions): Promise<PeerHandle> {
  const relayBase = opts.relayBase ?? defaultRelayBase();
  const sig = signalingClient(relayBase, opts.gameId, opts.roomId, "host");
  const pc = new RTCPeerConnection(opts.rtcConfig ?? defaultRtcConfig());
  const dc = pc.createDataChannel(opts.gameId, { ordered: true });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sig.postOwn("offer", pc.localDescription!.sdp);
  pc.addEventListener("icecandidate", (e) => {
    if (e.candidate) void sig.postOwn("ice", JSON.stringify(e.candidate));
  });

  const answerSdp = await waitFor(sig, "answer", 60_000);
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  void drainIce(sig, pc, 60_000);

  await opened(dc);
  return makeHandle("host", dc, pc);
}

/** Create the guest peer. Must be called by the invitee after reading
 *  `roomId` from the share link (see room.ts's `roomIdFromLocation`). */
export async function guestPeer(opts: PeerOptions): Promise<PeerHandle> {
  const relayBase = opts.relayBase ?? defaultRelayBase();
  const sig = signalingClient(relayBase, opts.gameId, opts.roomId, "guest");
  const pc = new RTCPeerConnection(opts.rtcConfig ?? defaultRtcConfig());

  pc.addEventListener("icecandidate", (e) => {
    if (e.candidate) void sig.postOwn("ice", JSON.stringify(e.candidate));
  });

  const offerSdp = await waitFor(sig, "offer", 60_000);
  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sig.postOwn("answer", pc.localDescription!.sdp);
  void drainIce(sig, pc, 60_000);

  // Wait for the host-side DataChannel to surface via ondatachannel.
  const dc = await new Promise<RTCDataChannel>((resolve) => {
    pc.addEventListener("datachannel", (e) => resolve(e.channel), { once: true });
  });
  await opened(dc);
  return makeHandle("guest", dc, pc);
}

// --- helpers -------------------------------------------------------------

function defaultRtcConfig(): RTCConfiguration {
  // STUN-only keeps the MVP serverless. For symmetric NATs a TURN server
  // would be needed; out of MVP scope (see BTTT's peer.ts, which carries
  // the same limitation).
  return {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };
}

function opened(dc: RTCDataChannel): Promise<void> {
  if (dc.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("datachannel open timeout")), 30_000);
    dc.addEventListener("open", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

async function waitFor(sig: SignalingClient, type: "offer" | "answer", timeoutMs: number): Promise<string> {
  // The relay itself long-polls each GET for up to ~25s before returning
  // 404, so the retry loop here only needs a short backoff between the
  // (rare) empty responses — it exists to cover the relay's own timeout,
  // not to replace it with client-side polling.
  const deadline = Date.now() + timeoutMs;
  let slept = 0;
  while (Date.now() < deadline) {
    const v = await sig.pollOther(type);
    if (v !== null && v.length > 0) return v;
    await sleep(Math.min(500, 50 * ++slept));
  }
  throw new Error(`signaling: timed out waiting for ${type}`);
}

/**
 * Poll for the other side's ICE candidates until `timeoutMs` elapses. The
 * relay never consumes what it stores — GET always returns the FULL
 * newline-joined history — so this tracks how many lines it has already
 * fed to `addIceCandidate` and only processes new ones each pass. Without
 * that bookkeeping every poll would re-add every candidate seen so far.
 * A fixed delay between polls (win or empty) is likewise required: without
 * it, once the first candidate lands the "poll again immediately" branch
 * never sees an empty response again (the relay's data never disappears),
 * turning this into a request-per-tick busy loop against the relay for the
 * rest of the connection attempt.
 */
async function drainIce(sig: SignalingClient, pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let consumed = 0;
  while (Date.now() < deadline) {
    try {
      const v = await sig.pollOther("ice");
      if (v !== null && v.length > 0) {
        const { newLines, total } = splitIceCandidates(v, consumed);
        for (const line of newLines) {
          try {
            const candidate = JSON.parse(line) as RTCIceCandidateInit;
            await pc.addIceCandidate(candidate);
          } catch (e) {
            // A malformed or late (post-close) candidate is safe to ignore.
            console.debug("[pvp] addIceCandidate ignored", e);
          }
        }
        consumed = total;
      }
    } catch (e) {
      console.debug("[pvp] ice poll failed", e);
    }
    await sleep(400);
  }
}

/**
 * Given the relay's raw (newline-joined, ever-growing) ICE response and how
 * many lines were already applied, return just the new lines plus the new
 * total — so a poller can advance its own counter without re-parsing
 * candidates it has already handed to `addIceCandidate`. Pure and exported
 * so this parsing (the actual fix for the "multiple lines per poll"
 * behaviour BTTT's peer.ts predates) is unit-testable without a real
 * RTCPeerConnection.
 */
export function splitIceCandidates(raw: string, alreadyConsumed: number): { newLines: string[]; total: number } {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  return { newLines: lines.slice(alreadyConsumed), total: lines.length };
}

function makeHandle(role: PeerRole, dc: RTCDataChannel, pc: RTCPeerConnection): PeerHandle {
  const msgCbs = new Set<(m: WireMessage) => void>();
  const closeCbs = new Set<() => void>();
  dc.addEventListener("message", (e) => {
    try {
      const msg = JSON.parse(e.data) as WireMessage;
      // Snapshot: a handler commonly unregisters itself and registers the
      // next turn's from inside this loop.
      for (const cb of [...msgCbs]) cb(msg);
    } catch (err) {
      console.warn("[pvp] dropped malformed message", err);
    }
  });
  dc.addEventListener("close", () => { for (const cb of [...closeCbs]) cb(); });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      for (const cb of [...closeCbs]) cb();
    }
  });
  return {
    role,
    get dataChannel() { return dc; },
    send(msg) {
      if (dc.readyState !== "open") throw new Error("datachannel not open");
      dc.send(JSON.stringify(msg));
    },
    close() {
      try { dc.close(); } catch { /* noop */ }
      try { pc.close(); } catch { /* noop */ }
    },
    onMessage(cb) { msgCbs.add(cb); },
    offMessage(cb) { msgCbs.delete(cb); },
    onClose(cb) { closeCbs.add(cb); },
    offClose(cb) { closeCbs.delete(cb); },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

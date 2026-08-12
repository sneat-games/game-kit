// Short human-friendly room IDs for the share-link invite flow, and the
// relay handshake that reserves one for a match.
//
// Format: 6 characters from an unambiguous alphabet (no 0/O/1/I) so a friend
// can read the code out loud or copy it without optical confusion. Because
// the namespace is small (~31^6 ≈ 887M), collisions are possible and the
// relay MUST reject a reserve for any {gameId, roomId} pair it already
// knows (see webrtc-relay/index.ts) — `reserveRoomId` probes for uniqueness
// and retries a handful of times before giving up.
//
// Extracted from bidding-tictactoe/web/src/pvp/room.ts. The relay is now
// shared across every Sneat game (see the shared `webrtc-relay` repo), so
// every route is namespaced by `gameId`; BTTT's own room.ts pointed at a
// per-game relay deployment and had no such prefix.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split(""); // 31 chars, no 0/O/1/I
const CODE_LEN = 6;
const MAX_RETRY = 10;

export const ROOM_ID_LENGTH = CODE_LEN;

export function newRoomId(): string {
  const out: string[] = [];
  const buf = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (let i = 0; i < CODE_LEN; i++) {
    out.push(ALPHABET[buf[i] % ALPHABET.length]);
  }
  return out.join("");
}

/**
 * The shared relay's default base URL. Only consulted when the caller (this
 * module's `reserveRoomId`, or peer.ts's `hostPeer`/`guestPeer`) is not
 * given an explicit `relayBase`. Exported so both modules apply the exact
 * same default instead of two copies drifting apart.
 *
 * Every game also ships to CrazyGames and itch.io (see docs/DESIGN.md), so
 * this can NOT key off `.sneat.games` — a game embedded on
 * crazygames.com or html.itch.zone is still a real origin that needs the
 * production relay. The only case that wants the LOCAL relay
 * (src/test-relay.mjs, which mimics the same routes in-process) is actually
 * running locally: localhost or a loopback IP. Everything else — the game's
 * own *.sneat.games domain, a CrazyGames/itch.io iframe origin, a custom
 * domain — gets the production relay.
 */
export function defaultRelayBase(): string {
  const hostname = typeof window !== "undefined" ? window.location?.hostname : undefined;
  if (hostname === "localhost" || hostname?.startsWith("127.")) {
    return "http://localhost:8787";
  }
  return "https://webrtc.sneat.games";
}

export interface ReserveRoomIdOptions {
  /** Namespaces the room code so it can't collide with another game's rooms
   *  on the shared relay (e.g. "dots-and-boxes", "hex"). */
  gameId: string;
  /** Overrides the relay's base URL; see `defaultRelayBase`. */
  relayBase?: string;
}

/** Probe the relay to reserve a roomId for `gameId`. Returns a roomId the
 *  relay has confirmed is unused, or throws after MAX_RETRY attempts. */
export async function reserveRoomId(opts: ReserveRoomIdOptions): Promise<string> {
  const relayBase = opts.relayBase ?? defaultRelayBase();
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const id = newRoomId();
    const res = await fetch(`${relayBase}/reserve/${encodeURIComponent(opts.gameId)}/${id}`, {
      method: "POST",
    });
    if (res.ok) return id;
    if (res.status === 409) continue; // already taken — retry with a new code
    throw new Error(`reserve ${id}: ${res.status}`);
  }
  throw new Error("could not reserve a unique room id");
}

/** Read roomId from a share-link fragment `#room=<id>`. Returns null when no
 *  fragment is present or the code is malformed — this rejects a typo'd
 *  hand-typed link without ever round-tripping the relay. */
export function roomIdFromLocation(href: string): string | null {
  const hash = href.indexOf("#");
  if (hash < 0) return null;
  const qs = href.slice(hash + 1);
  const p = new URLSearchParams(qs);
  const r = p.get("room");
  if (!r) return null;
  if (r.length !== CODE_LEN) return null;
  for (const ch of r) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return r;
}

/** Build a share link with a `#room=<id>` fragment for a given base URL. */
export function shareLinkFor(base: string, roomId: string): string {
  return `${base.replace(/\/$/, "")}/#room=${encodeURIComponent(roomId)}`;
}

// BTTT never had a turn-inbox.test.ts of its own; this is new coverage for
// the generalised inbox (assign + seq'd moves added on top of the original
// commit/reveal buffering), written against a fake PeerHandle in the style
// of BTTT's room.test.ts / match-screen.test.ts.
import { describe, it, expect, vi } from "vitest";
import type { PeerHandle, WireMessage } from "./peer.js";
import { openTurnInbox } from "./turn-inbox.js";

function fakePeer(): PeerHandle & { emit(msg: WireMessage): void; fireClose(): void } {
  const msgCbs = new Set<(m: WireMessage) => void>();
  const closeCbs = new Set<() => void>();
  return {
    role: "host",
    dataChannel: {} as RTCDataChannel,
    send: vi.fn(),
    close: vi.fn(),
    onMessage: (cb) => { msgCbs.add(cb); },
    offMessage: (cb) => { msgCbs.delete(cb); },
    onClose: (cb) => { closeCbs.add(cb); },
    offClose: (cb) => { closeCbs.delete(cb); },
    emit(msg) { for (const cb of [...msgCbs]) cb(msg); },
    fireClose() { for (const cb of [...closeCbs]) cb(); },
  };
}

describe("turn-inbox commit", () => {
  it("hasCommit is false until the opponent's commit for this turn lands", () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 3);
    expect(inbox.hasCommit()).toBe(false);
    peer.emit({ kind: "commit", turn: 3, hash: "abc" });
    expect(inbox.hasCommit()).toBe(true);
  });

  it("ignores a commit for a different turn", () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 3);
    peer.emit({ kind: "commit", turn: 4, hash: "abc" });
    expect(inbox.hasCommit()).toBe(false);
  });

  it("commit() resolves immediately once already buffered", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    peer.emit({ kind: "commit", turn: 0, hash: "h1", public: { cell: 4 } });
    await expect(inbox.commit()).resolves.toEqual({ hash: "h1", public: { cell: 4 } });
  });

  it("commit() resolves later, when the message arrives after the call", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    const p = inbox.commit();
    peer.emit({ kind: "commit", turn: 0, hash: "h2" });
    await expect(p).resolves.toEqual({ hash: "h2", public: undefined });
  });

  it("onCommit fires immediately if already committed, else on arrival, and is unsubscribable", () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    const late = vi.fn();
    const unsub = inbox.onCommit(late);
    expect(late).not.toHaveBeenCalled();
    peer.emit({ kind: "commit", turn: 0, hash: "h" });
    expect(late).toHaveBeenCalledTimes(1);

    unsub(); // no-op here since it already fired and cleared itself

    const immediate = vi.fn();
    inbox.onCommit(immediate); // commit already landed -> fires synchronously
    expect(immediate).toHaveBeenCalledTimes(1);
  });
});

describe("turn-inbox reveal", () => {
  it("reveal() resolves with bid/move/salt, scoped to this turn", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 1);
    peer.emit({ kind: "reveal", turn: 2, bid: 9, salt: "s" }); // wrong turn, ignored
    const p = inbox.reveal();
    peer.emit({ kind: "reveal", turn: 1, bid: 5, move: { cell: 4 }, salt: "s1" });
    await expect(p).resolves.toEqual({ bid: 5, move: { cell: 4 }, salt: "s1" });
  });
});

describe("turn-inbox assign (auction-for-control)", () => {
  it("assign() resolves with the mover chosen by the auction winner", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 5);
    const p = inbox.assign();
    peer.emit({ kind: "assign", turn: 5, mover: 1 });
    await expect(p).resolves.toEqual({ mover: 1 });
  });
});

describe("turn-inbox move (seq'd for free-runs)", () => {
  it("resolves each seq independently, in whatever order they arrive", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    const p1 = inbox.move(1);
    // Out-of-order arrival: seq 2 lands before seq 1.
    peer.emit({ kind: "move", turn: 0, seq: 2, move: { edge: "b" } });
    peer.emit({ kind: "move", turn: 0, seq: 1, move: { edge: "a" } });
    await expect(p1).resolves.toEqual({ seq: 1, move: { edge: "a" } });
    await expect(inbox.move(2)).resolves.toEqual({ seq: 2, move: { edge: "b" } });
  });

  it("treats a seq-less move (classic single-move turns) as seq 0", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 7);
    const p = inbox.move(0);
    peer.emit({ kind: "move", turn: 7, move: { cell: 4 } });
    await expect(p).resolves.toEqual({ seq: undefined, move: { cell: 4 } });
  });
});

describe("turn-inbox closed()", () => {
  it("resolves on an explicit leave message", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    const p = inbox.closed();
    peer.emit({ kind: "leave" });
    await expect(p).resolves.toBeUndefined();
  });

  it("resolves when the peer connection closes", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    const p = inbox.closed();
    peer.fireClose();
    await expect(p).resolves.toBeUndefined();
  });

  it("resolves immediately once already gone", async () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    peer.fireClose();
    await expect(inbox.closed()).resolves.toBeUndefined();
  });
});

describe("turn-inbox close()", () => {
  it("detaches from the peer so later messages are not buffered", () => {
    const peer = fakePeer();
    const inbox = openTurnInbox(peer, 0);
    inbox.close();
    peer.emit({ kind: "commit", turn: 0, hash: "h" });
    expect(inbox.hasCommit()).toBe(false);
  });
});

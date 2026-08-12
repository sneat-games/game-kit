// Per-turn inbox for the commit-reveal (and assign/move) exchange.
//
// A turn must start listening BEFORE it starts waiting: the opponent can
// commit while the local player is still choosing, and `peer.onMessage`
// delivers only to handlers registered at the moment a message arrives. A
// handler installed after the fact never sees it, and the turn deadlocks.
// The inbox is opened at the top of the turn, buffers whatever lands for
// that turn number, and is closed in a `finally` so it cannot outlive it.
//
// Generalised from bidding-tictactoe/web/src/pvp/turn-inbox.ts to also
// buffer `assign` (auction-for-control's "who moves next", used by Dots &
// Boxes) and `move` (used by every classic mode, and by D&B's free-run
// after each completed box). Moves carry an optional `seq` so a free-run of
// several moves in one turn — the mover keeps drawing edges as long as they
// keep completing boxes — arrive at the other peer in the order they were
// made rather than however the network happens to deliver them.

import type { PeerHandle, WireMessage } from "./peer.js";

export interface OpponentCommit {
  hash: string;
  public?: unknown;
}

export interface OpponentReveal {
  bid: number;
  move?: unknown;
  salt: string;
}

export interface OpponentAssign {
  mover: 0 | 1;
}

export interface OpponentMove {
  seq?: number;
  move: unknown;
}

export interface TurnInbox {
  /** True once the opponent's commit for this turn has landed. */
  hasCommit(): boolean;
  /** Resolves with the opponent's commit, immediately if already buffered. */
  commit(): Promise<OpponentCommit>;
  /** Resolves with the opponent's reveal, immediately if already buffered. */
  reveal(): Promise<OpponentReveal>;
  /** Resolves with the auction winner's mover assignment (auction-for-
   *  control games only), immediately if already buffered. */
  assign(): Promise<OpponentAssign>;
  /** Resolves with the move carrying sequence number `seq` — used by
   *  free-run turns where several moves land for the same turn number, in
   *  order. Immediately if that seq is already buffered. */
  move(seq: number): Promise<OpponentMove>;
  /** Run `fn` when the opponent's commit lands (or now, if it already has).
   *  Returns an unsubscribe function. */
  onCommit(fn: () => void): () => void;
  /** Resolves if the peer goes away — the channel closed or the match was
   *  abandoned. Never rejects. */
  closed(): Promise<void>;
  /** Detach every listener. Always call this when the turn ends. */
  close(): void;
}

export function openTurnInbox(peer: PeerHandle, turn: number): TurnInbox {
  let commitMsg: OpponentCommit | null = null;
  let revealMsg: OpponentReveal | null = null;
  let assignMsg: OpponentAssign | null = null;
  const moveMsgs = new Map<number, OpponentMove>();
  let gone = false;

  const commitWaiters = new Set<(c: OpponentCommit) => void>();
  const revealWaiters = new Set<(r: OpponentReveal) => void>();
  const assignWaiters = new Set<(a: OpponentAssign) => void>();
  const moveWaiters = new Map<number, Set<(m: OpponentMove) => void>>();
  const commitSubs = new Set<() => void>();
  const closeWaiters = new Set<() => void>();

  const onMessage = (msg: WireMessage) => {
    if (msg.kind === "commit" && msg.turn === turn) {
      if (commitMsg) return;
      commitMsg = { hash: msg.hash, public: msg.public };
      for (const w of [...commitWaiters]) w(commitMsg);
      commitWaiters.clear();
      for (const s of [...commitSubs]) s();
    } else if (msg.kind === "reveal" && msg.turn === turn) {
      if (revealMsg) return;
      revealMsg = { bid: msg.bid, move: msg.move, salt: msg.salt };
      for (const w of [...revealWaiters]) w(revealMsg);
      revealWaiters.clear();
    } else if (msg.kind === "assign" && msg.turn === turn) {
      if (assignMsg) return;
      assignMsg = { mover: msg.mover };
      for (const w of [...assignWaiters]) w(assignMsg);
      assignWaiters.clear();
    } else if (msg.kind === "move" && msg.turn === turn) {
      // A free-run turn (Dots & Boxes) sends several moves under the same
      // turn number, one per completed box; classic modes send exactly one
      // and simply omit `seq`, which this treats as seq 0.
      const seq = msg.seq ?? 0;
      if (moveMsgs.has(seq)) return;
      const m: OpponentMove = { seq: msg.seq, move: msg.move };
      moveMsgs.set(seq, m);
      const waiters = moveWaiters.get(seq);
      if (waiters) {
        for (const w of [...waiters]) w(m);
        moveWaiters.delete(seq);
      }
    } else if (msg.kind === "leave") {
      onGone();
    }
  };

  const onClose = () => onGone();

  function onGone() {
    if (gone) return;
    gone = true;
    for (const w of [...closeWaiters]) w();
    closeWaiters.clear();
  }

  peer.onMessage(onMessage);
  peer.onClose(onClose);

  return {
    hasCommit: () => commitMsg !== null,
    commit: () =>
      commitMsg
        ? Promise.resolve(commitMsg)
        : new Promise<OpponentCommit>((resolve) => commitWaiters.add(resolve)),
    reveal: () =>
      revealMsg
        ? Promise.resolve(revealMsg)
        : new Promise<OpponentReveal>((resolve) => revealWaiters.add(resolve)),
    assign: () =>
      assignMsg
        ? Promise.resolve(assignMsg)
        : new Promise<OpponentAssign>((resolve) => assignWaiters.add(resolve)),
    move: (seq: number) => {
      const existing = moveMsgs.get(seq);
      if (existing) return Promise.resolve(existing);
      return new Promise<OpponentMove>((resolve) => {
        let set = moveWaiters.get(seq);
        if (!set) {
          set = new Set();
          moveWaiters.set(seq, set);
        }
        set.add(resolve);
      });
    },
    onCommit(fn) {
      if (commitMsg) {
        fn();
        return () => {};
      }
      commitSubs.add(fn);
      return () => commitSubs.delete(fn);
    },
    closed: () =>
      gone ? Promise.resolve() : new Promise<void>((resolve) => closeWaiters.add(resolve)),
    close() {
      peer.offMessage(onMessage);
      peer.offClose(onClose);
      commitWaiters.clear();
      revealWaiters.clear();
      assignWaiters.clear();
      moveWaiters.clear();
      commitSubs.clear();
      closeWaiters.clear();
    },
  };
}

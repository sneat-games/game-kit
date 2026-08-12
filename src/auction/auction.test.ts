// Ported from bidding-tictactoe/web/src/engine/btttplay.test.ts — every
// bid-related case (higher-bid, tie-break alternation, errors,
// state-unchanged-on-error, conservation), minus the board-specific ones
// (cell placement, win detection), which have no counterpart here.
import { describe, it, expect } from "vitest";
import {
  newAuction,
  resolveAuction,
  BidNegativeError,
  BidExceedsBudgetError,
  type AuctionState,
} from "./auction.js";

describe("newAuction", () => {
  it("starts both players at the given budget with the first tie going to player 0", () => {
    const s = newAuction(10);
    expect(s.budgets).toEqual([10, 10]);
    expect(s.tieToFirst).toBe(true);
  });
});

describe("resolveAuction higher-bid wins, transfers first-price", () => {
  it("player 0 wins the turn, pays the bid to player 1", () => {
    const s = newAuction(10);
    const { winner, tieBreak, next } = resolveAuction(s, [5, 3]);
    expect(winner).toBe(0);
    expect(tieBreak).toBe(false);
    expect(next.budgets[0]).toBe(5); // paid the bid
    expect(next.budgets[1]).toBe(15); // received 5 from player 0: 10 + 5
    expect(next.budgets[0] + next.budgets[1]).toBe(20); // total conserved
  });

  it("player 1 wins the turn, pays the bid to player 0", () => {
    const s = newAuction(10);
    const { winner, next } = resolveAuction(s, [3, 5]);
    expect(winner).toBe(1);
    expect(next.budgets).toEqual([15, 5]);
  });
});

describe("resolveAuction tie-break alternates", () => {
  it("first tie -> player 0 (transfers 5 to player 1), second tie -> player 1 (transfers 4 back)", () => {
    let s: AuctionState = newAuction(10); // tieToFirst = true
    let res = resolveAuction(s, [5, 5]);
    expect(res.tieBreak).toBe(true);
    expect(res.winner).toBe(0);
    s = res.next;
    expect(s.tieToFirst).toBe(false);
    expect(s.budgets).toEqual([5, 15]); // player 0 transferred 5 to player 1

    res = resolveAuction(s, [4, 4]);
    expect(res.tieBreak).toBe(true);
    expect(res.winner).toBe(1);
    s = res.next;
    expect(s.budgets).toEqual([9, 11]); // player 1 transferred 4 to player 0
    expect(s.tieToFirst).toBe(true);
    expect(s.budgets[0] + s.budgets[1]).toBe(20); // total conserved
  });
});

describe("resolveAuction errors", () => {
  it("rejects a negative bid", () => {
    const s = newAuction(10);
    expect(() => resolveAuction(s, [-1, 1])).toThrow(BidNegativeError);
  });

  it("rejects a bid above the player's own budget", () => {
    const s = newAuction(10);
    expect(() => resolveAuction(s, [11, 1])).toThrow(BidExceedsBudgetError);
  });
});

describe("resolveAuction error leaves state unchanged", () => {
  it("a thrown error never mutates the state object passed in", () => {
    let s: AuctionState = newAuction(10);
    s = resolveAuction(s, [5, 5]).next; // tie -> flips tieToFirst
    const before = { budgets: [...s.budgets], tieToFirst: s.tieToFirst };
    expect(() => resolveAuction(s, [2, -1])).toThrow(BidNegativeError);
    expect(() => resolveAuction(s, [999, 1])).toThrow(BidExceedsBudgetError);
    // The state object handed to resolveAuction is read-only input; a failed
    // call must not have touched it.
    expect(s.budgets).toEqual(before.budgets);
    expect(s.tieToFirst).toBe(before.tieToFirst);
  });
});

describe("resolveAuction budget runs out", () => {
  it("a player who transfers away everything can still bid 0 (only wins via tie-break)", () => {
    let s: AuctionState = newAuction(5);
    s = resolveAuction(s, [5, 0]).next;
    expect(s.budgets[0]).toBe(0); // player 0 paid 5 to player 1
    expect(s.budgets[1]).toBe(10); // player 1 received 5: 5 + 5

    const res = resolveAuction(s, [0, 1]);
    expect(res.winner).toBe(1);
    s = res.next;
    // player 1 transferred 1 to player 0: [0, 10] -> [1, 9]
    expect(s.budgets).toEqual([1, 9]);
    // Bidding more than the (now 1) budget must error.
    expect(() => resolveAuction(s, [2, 0])).toThrow(BidExceedsBudgetError);
  });
});

describe("resolveAuction conservation invariant", () => {
  it("total budget is conserved across many random rounds", () => {
    let s: AuctionState = newAuction(100);
    const total = s.budgets[0] + s.budgets[1];
    for (let round = 0; round < 500; round++) {
      const bid0 = Math.floor(Math.random() * (s.budgets[0] + 1));
      const bid1 = Math.floor(Math.random() * (s.budgets[1] + 1));
      const { next } = resolveAuction(s, [bid0, bid1]);
      expect(next.budgets[0] + next.budgets[1]).toBe(total);
      expect(next.budgets[0]).toBeGreaterThanOrEqual(0);
      expect(next.budgets[1]).toBeGreaterThanOrEqual(0);
      s = next;
    }
  });
});

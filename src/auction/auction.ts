// The generic hidden-bid ("auction") core, extracted from Bidding
// Tic-Tac-Toe's server-go/btttplay port (bidding-tictactoe/web/src/engine/
// btttplay.ts). This file keeps only the bidding math — who wins a turn and
// how the budgets move — with every board/mark/outcome concern stripped out.
// Board placement, win detection, and everything else game-specific stay in
// each game's own engine; they call `resolveAuction` once per turn and place
// the winner's move themselves.
//
// # The rule (mirrors btttplay exactly)
//
// Each turn both players secretly submit a bid, staked from their own
// budget. The HIGHER bid wins the turn. First-price TRANSFER: the winner
// pays their own bid, and that amount is ADDED to the loser's budget — so
// the total budget across both players is conserved across the whole match
// (nothing is spent to "the bank"; it only moves between the two players).
// Equal bids are decided by an ALTERNATING tie-break: the first tie goes to
// whichever player `tieToFirst` currently favours, and it flips after every
// tie-break, so neither side keeps a permanent tie advantage.
//
// The engine is coin-agnostic and board-agnostic: "budget" is a plain
// integer and there is no concept of a cell or a win condition here at all.

export interface AuctionState {
  /** Remaining budget for [player 0, player 1]. */
  readonly budgets: readonly [number, number];
  /** Which player the NEXT tied turn is awarded to. Flips every time a
   *  tie-break is used, so the tie advantage alternates across the match. */
  readonly tieToFirst: boolean;
}

/** A fresh auction: both players start with the same budget, and the first
 *  tie (if any) goes to player 0. */
export function newAuction(budget: number): AuctionState {
  return { budgets: [budget, budget], tieToFirst: true };
}

// Error classes mirror btttplay's sentinels so callers can use `instanceof`
// to discriminate a validation failure from a programming error.
export class BidNegativeError extends Error {
  constructor() {
    super("auction: bid must be >= 0");
    this.name = "BidNegativeError";
  }
}
export class BidExceedsBudgetError extends Error {
  constructor() {
    super("auction: bid exceeds remaining budget");
    this.name = "BidExceedsBudgetError";
  }
}

export interface AuctionOutcome {
  /** The player who won the turn. */
  winner: 0 | 1;
  /** True when the bids were equal and the alternating tie-break decided
   *  the turn. */
  tieBreak: boolean;
  /** The auction state after this turn: budgets transferred, tie-break
   *  parity flipped if one was used. */
  next: AuctionState;
}

/**
 * Resolve one turn from both players' hidden bids. Compares the bids
 * (higher wins; equal bids use the alternating tie-break), TRANSFERS the
 * winner's bid to the loser (so total budget is conserved across the
 * match), and flips `tieToFirst` if a tie-break was used.
 *
 * Both bids must be non-negative and within the respective player's
 * budget — a bid is a real commitment, so a player cannot bid what they
 * cannot afford. On any error the state is unchanged (this function never
 * mutates its input; `s` is always safe to reuse after a thrown error).
 */
export function resolveAuction(
  s: AuctionState,
  bids: readonly [number, number],
): AuctionOutcome {
  if (bids[0] < 0 || bids[1] < 0) throw new BidNegativeError();
  if (bids[0] > s.budgets[0] || bids[1] > s.budgets[1]) {
    throw new BidExceedsBudgetError();
  }

  let winner: 0 | 1;
  let tieBreak = false;
  if (bids[0] > bids[1]) {
    winner = 0;
  } else if (bids[1] > bids[0]) {
    winner = 1;
  } else {
    tieBreak = true;
    winner = s.tieToFirst ? 0 : 1;
  }

  const loser = winner === 0 ? 1 : 0;
  const winBid = bids[winner];
  const budgets: [number, number] = [s.budgets[0], s.budgets[1]];
  // First-price transfer: the winner pays their bid, and that bid is added
  // to the loser's budget. Total budget across both players is conserved.
  budgets[winner] -= winBid;
  budgets[loser] += winBid;
  const tieToFirst = tieBreak ? !s.tieToFirst : s.tieToFirst;

  return {
    winner,
    tieBreak,
    next: { budgets, tieToFirst },
  };
}

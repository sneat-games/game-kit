// Bid panel card — the top-right panel of the match screen (see
// match-shell.ts), sharing a column (and therefore a width) with the game
// log below it.
//
// It owns the bid controls (the linked slider + number from bid-input.ts)
// and the turn countdown. Committing what happens next (clicking a board
// cell, drawing an edge, etc.) is entirely game-owned — this panel never
// needs a submit button of its own: pick a number here, act on the board
// there.
//
// The countdown shows the bid that will be submitted for the player if they
// let it run out, so an auto-bid is never a surprise.
//
// Genericized from bidding-tictactoe/web/src/ui/bid-panel.ts — logic is
// unchanged; only the turn-clock import moved to this kit's clock/ module.

import { createBidInput, type BidInput } from "./bid-input.js";
import { startCountdown, type Countdown } from "../clock/turn-clock.js";

export interface ClockOptions {
  ms: number;
  /** Short line above the bar, e.g. "Opponent has bid — answer within". */
  label: string;
  /** The bid submitted on the player's behalf when this clock expires. */
  autoBid: number;
  onExpire(): void;
}

export interface BidPanel {
  el: HTMLElement;
  /** Rebuild the bid controls for a new turn's budget. Stops any clock. */
  beginTurn(opts: { max: number; initial?: number }): void;
  /** The bid currently dialled in. */
  value(): number;
  /** Start (or replace) the countdown. */
  runClock(opts: ClockOptions): void;
  /** Cancel the countdown and hide it. */
  stopClock(): void;
  /** Disable the controls and explain what the player is waiting for. */
  setWaiting(message: string): void;
}

export interface BidPanelOptions {
  /**
   * The line shown under the bid controls each turn. Defaults to the
   * game-agnostic "Make your move to commit."
   *
   * Games whose move is a specific, nameable gesture should say so — a grid
   * game's "Click a cell to commit." tells a first-time player what to do;
   * "make your move" only tells them that a move exists. This option is why
   * a game can share this panel WITHOUT flattening its own copy: when BTTT
   * adopted the kit's bid-panel it silently inherited the generic line and
   * lost its more precise one, which is exactly the kind of quiet regression
   * that makes teams keep private copies instead of reusing.
   */
  moveHint?: string;
}

export function createBidPanel(opts: BidPanelOptions = {}): BidPanel {
  const moveHint = opts.moveHint ?? "Make your move to commit.";
  const el = document.createElement("section");
  el.className = "card bid-panel";
  el.setAttribute("aria-label", "Your bid");
  el.setAttribute("data-bid-panel", "");

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = "Your bid";

  const slot = document.createElement("div");
  slot.className = "bid-panel__input";

  const hint = document.createElement("p");
  hint.className = "bid-panel__hint";
  hint.setAttribute("data-bid-hint", "");

  const clockBox = document.createElement("div");
  clockBox.className = "bid-panel__clock";
  clockBox.setAttribute("data-clock", "");
  clockBox.hidden = true;

  const clockHead = document.createElement("div");
  clockHead.className = "bid-panel__clock-head";
  const clockLabel = document.createElement("span");
  clockLabel.className = "bid-panel__clock-label";
  const clockSecs = document.createElement("span");
  clockSecs.className = "bid-panel__clock-secs";
  clockSecs.setAttribute("data-clock-secs", "");
  clockHead.append(clockLabel, clockSecs);

  const track = document.createElement("div");
  track.className = "bar-track bar-track--clock";
  const fill = document.createElement("div");
  fill.className = "bar-fill bar-fill--clock";
  track.append(fill);

  const auto = document.createElement("p");
  auto.className = "bid-panel__auto";
  auto.setAttribute("data-auto-bid", "");

  clockBox.append(clockHead, track, auto);
  el.append(title, slot, hint, clockBox);

  let input: BidInput | null = null;
  let clock: Countdown | null = null;

  function stopClock() {
    clock?.stop();
    clock = null;
    clockBox.hidden = true;
    // The bar is re-shown full by the next runClock; resetting here keeps a
    // stale sliver from flashing when it is.
    fill.style.width = "100%";
    clockBox.classList.remove("bid-panel__clock--urgent");
  }

  function beginTurn(opts: { max: number; initial?: number }) {
    stopClock();
    slot.innerHTML = "";
    input = createBidInput({
      max: opts.max,
      initial: opts.initial ?? Math.floor(opts.max / 2),
    });
    slot.append(input.el);
    hint.textContent = moveHint;
    el.classList.remove("bid-panel--waiting");
  }

  function runClock(opts: ClockOptions) {
    clock?.stop();
    clockBox.hidden = false;
    clockLabel.textContent = opts.label;
    auto.textContent = `No bid → you auto-bid ${opts.autoBid}`;
    clock = startCountdown({
      ms: opts.ms,
      onTick(left) {
        clockSecs.textContent = `${Math.ceil(left / 1000)}s`;
        fill.style.width = `${((left / opts.ms) * 100).toFixed(1)}%`;
        clockBox.classList.toggle("bid-panel__clock--urgent", left <= 3_000);
      },
      onExpire() {
        clock = null;
        opts.onExpire();
      },
    });
  }

  function setWaiting(message: string) {
    stopClock();
    input?.disable(true);
    hint.textContent = message;
    el.classList.add("bid-panel--waiting");
  }

  return {
    el,
    beginTurn,
    value: () => input?.value() ?? 0,
    runClock,
    stopClock,
    setWaiting,
  };
}

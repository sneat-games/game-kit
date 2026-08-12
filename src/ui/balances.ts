// Balances card — the classic top-left panel of a bidding-mode match
// screen (see match-shell.ts), showing both players' remaining auction
// budget as a bar against the initial budget. Classic (non-bidding) modes
// use score-card.ts instead.
//
// Balances are public information under first-price-transfer bidding: the
// bid is hidden, the bankroll is not. Keeping them on screen is also what
// makes the stall default in clock/turn-clock.ts's `stallBid` predictable —
// a player can read off what their auto-bid would be before the clock
// fires.
//
// Genericized from bidding-tictactoe/web/src/ui/balances.ts: players are
// 0/1 (host/guest — see pvp/peer.ts) rather than X/O, styled with the
// player-identity tokens `--p1`/`--p2` instead of BTTT's mark colours.

export interface Balances {
  el: HTMLElement;
  /** Redraw both bars from the post-turn budgets `[player 0, player 1]`. */
  update(budgets: readonly [number, number]): void;
}

export function createBalances(opts: {
  initialBudget: number;
  p1Label: string;
  p2Label: string;
}): Balances {
  const el = document.createElement("section");
  el.className = "card balances";
  el.setAttribute("aria-label", "Balances");
  el.setAttribute("data-balances", "");

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = "Balances";

  const rows = document.createElement("div");
  rows.className = "balances__rows";

  el.append(title, rows);

  function update(budgets: readonly [number, number]) {
    rows.innerHTML = "";
    rows.append(
      balanceBar(opts.p1Label, budgets[0], opts.initialBudget, "p1"),
      balanceBar(opts.p2Label, budgets[1], opts.initialBudget, "p2"),
    );
  }

  update([opts.initialBudget, opts.initialBudget]);

  return { el, update };
}

function balanceBar(label: string, value: number, max: number, cls: "p1" | "p2"): HTMLElement {
  const row = document.createElement("div");
  row.className = `balances__row balances__row--${cls}`;
  row.setAttribute("data-balance", cls);

  const lbl = document.createElement("span");
  lbl.className = "balances__label";
  lbl.textContent = `${label}: ${value}/${max}`;

  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = `bar-fill bar-fill--${cls}`;
  // A budget can exceed the initial one — the winner's bid is transferred to
  // the loser — so clamp the bar at full rather than overflowing the track.
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  fill.style.width = `${(pct * 100).toFixed(1)}%`;
  track.append(fill);

  row.append(lbl, track);
  return row;
}

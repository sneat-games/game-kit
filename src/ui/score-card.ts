// Score card — the classic-mode counterpart of balances.ts. Where a
// bidding-mode match shows both players' remaining auction budget, a
// classic (non-bidding) match has no budget to show — only a running score
// (boxes claimed, stones on a winning path, whatever the game counts). Same
// card slot, same width, same colour-coded-by-player convention.
//
// New in this kit — BTTT has no classic mode, so there is no BTTT source to
// port.

export interface ScoreCard {
  el: HTMLElement;
  /** Redraw both rows from the current scores `[player 0, player 1]`. */
  update(scores: readonly [number, number]): void;
}

export function createScoreCard(opts: {
  p1Label: string;
  p2Label: string;
}): ScoreCard {
  const el = document.createElement("section");
  el.className = "card score-card";
  el.setAttribute("aria-label", "Score");
  el.setAttribute("data-score-card", "");

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = "Score";

  const rows = document.createElement("div");
  rows.className = "score-card__rows";

  el.append(title, rows);

  function update(scores: readonly [number, number]) {
    rows.innerHTML = "";
    rows.append(
      scoreRow(opts.p1Label, scores[0], "p1"),
      scoreRow(opts.p2Label, scores[1], "p2"),
    );
  }

  update([0, 0]);

  return { el, update };
}

function scoreRow(label: string, value: number, cls: "p1" | "p2"): HTMLElement {
  const row = document.createElement("div");
  row.className = `score-card__row score-card__row--${cls}`;
  row.setAttribute("data-score", cls);

  const chip = document.createElement("span");
  chip.className = `score-card__chip score-card__chip--${cls}`;
  chip.setAttribute("aria-hidden", "true");

  const lbl = document.createElement("span");
  lbl.className = "score-card__label";
  lbl.textContent = label;

  const val = document.createElement("span");
  val.className = "score-card__value";
  val.textContent = String(value);

  row.append(chip, lbl, val);
  return row;
}

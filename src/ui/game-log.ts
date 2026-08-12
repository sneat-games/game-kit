// Game log panel — the bottom-right card of the match screen (see
// match-shell.ts), a scrollable list of past turns with progress bars.
//
// Generalized from bidding-tictactoe/web/src/ui/game-log.ts: BTTT's log
// knew about X/O marks, cells, and bids. This one knows nothing about the
// game — `append` takes a fully-formed entry (a head line, an optional tie
// flag, and zero or more generic "bar rows" — label, value, a 0..1 bar
// fraction, which player it belongs to, and whether it won/should be
// dimmed). A bidding game supplies bid-size rows the same way BTTT did; a
// classic game can log a plain move with no rows at all.
//
// The log is created once per match and `clear()`-ed on rematch.

export interface GameLogRow {
  /** e.g. "You bid", "P2", or a player's display name. */
  label: string;
  /** Pre-formatted value text, e.g. "30" or "5 of 10". */
  value: string;
  /** Bar fill as a fraction of whatever the caller considers "full" for
   *  this row (typically the player's own budget at the start of the
   *  turn) — clamped to [0, 1]. */
  fraction: number;
  player: 0 | 1;
  /** Highlights the row (bold label + a small checkmark) instead of by
   *  hue, since the bar colour is already spoken for by `player`. */
  won?: boolean;
  /** De-emphasises the row (e.g. the losing bid, or a superseded entry). */
  dim?: boolean;
}

export interface GameLogEntry {
  turn: number;
  /** The entry's headline. A plain string is wrapped in a `T{n}` prefix
   *  span; pass a Node for anything richer (colour-coded chips, etc.) — the
   *  game owns that formatting, exactly as it owns board rendering. */
  head: string | Node;
  tie?: boolean;
  rows?: GameLogRow[];
}

export interface GameLog {
  el: HTMLElement;
  append(entry: GameLogEntry): void;
  clear(): void;
}

export function createGameLog(): GameLog {
  const el = document.createElement("aside");
  el.className = "card game-log";
  el.setAttribute("aria-label", "Game log");
  el.setAttribute("data-game-log", "");

  const header = document.createElement("h3");
  header.textContent = "Game log";
  header.className = "card__title";

  const entries = document.createElement("div");
  entries.className = "game-log__entries";
  entries.setAttribute("data-entries", "");

  el.append(header, entries);

  return {
    el,
    append(entry) {
      // Newest first, so the most recent turn is always visible without
      // scrolling.
      entries.prepend(renderEntry(entry));
    },
    clear() {
      entries.innerHTML = "";
    },
  };
}

function renderEntry(entry: GameLogEntry): HTMLElement {
  const card = document.createElement("div");
  card.className = "game-log__entry";

  const head = document.createElement("div");
  head.className = "game-log__entry-head";

  const turnSpan = document.createElement("span");
  turnSpan.className = "game-log__turn";
  turnSpan.textContent = `T${entry.turn + 1}`;
  head.append(turnSpan, document.createTextNode(" "));

  if (typeof entry.head === "string") {
    head.append(document.createTextNode(entry.head));
  } else {
    head.append(entry.head);
  }

  if (entry.tie) {
    const tieBadge = document.createElement("span");
    tieBadge.className = "game-log__tie";
    tieBadge.textContent = "tie";
    head.append(tieBadge);
  }
  card.append(head);

  for (const row of entry.rows ?? []) {
    card.append(renderRow(row));
  }
  return card;
}

function renderRow(row: GameLogRow): HTMLElement {
  const el = document.createElement("div");
  const state = row.won ? "won" : row.dim ? "dim" : "plain";
  el.className = `game-log__bid game-log__bid--${state}`;

  const lbl = document.createElement("span");
  lbl.className = "game-log__bid-label";
  lbl.textContent = `${row.label}: ${row.value}`;
  if (row.won) {
    const marker = document.createElement("span");
    marker.className = "game-log__bid-won-marker";
    marker.title = "won the turn";
    marker.textContent = "✓";
    lbl.append(document.createTextNode(" "), marker);
  }

  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = `bar-fill bar-fill--p${row.player + 1}`;
  const pct = Math.max(0, Math.min(1, row.fraction));
  fill.style.width = `${(pct * 100).toFixed(1)}%`;
  track.append(fill);

  el.append(lbl, track);
  return el;
}

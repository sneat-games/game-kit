// The match screen every mode of every game renders into: one 2x2 grid.
//
//   ┌──────────────┬──────────────┐
//   │ topLeft      │ topRight     │
//   ├──────────────┼──────────────┤
//   │ board        │ log          │
//   └──────────────┴──────────────┘
//
// `topLeft`, `topRight` and `log` are elements the CALLER builds and owns —
// balances.ts or score-card.ts for topLeft; bid-panel.ts or a plain status
// element for topRight; game-log.ts for log — because their content differs
// by mode (bidding vs classic) and by game. This module only lays out the
// grid and manages the three things that get rebuilt every turn: the board
// slot, the note line under it, and the end-of-match controls.
//
// The left column keeps three stable slots — the board, the note, and the
// controls. Only the board is rebuilt per turn: a note wiped by the next
// turn's render would be on screen for a single frame, which is how the
// turn result used to go unread in every turn but the last (see
// bidding-tictactoe/web/src/ui/match-screen.ts, where this was first
// fixed — this module keeps that fix, generalized).
//
// BOARD RENDERING IS 100% GAME-OWNED: this module exposes an empty
// `boardSlot` div and never touches its contents. Drawing cells, edges,
// stones — and the eventual match-over banner (see theme.css's
// `.match-over` family for the styling contract) — is each game's job,
// exactly as board/mark semantics stayed out of the auction/ module.
//
// Genericized from bidding-tictactoe/web/src/ui/match-screen.ts, which
// hard-wired balances+bidPanel+log (bidding-only) and owned board
// rendering itself (tic-tac-toe only).

export interface MatchShellOptions {
  root: HTMLElement;
  topLeft: HTMLElement;
  topRight: HTMLElement;
  log: HTMLElement;
}

export interface MatchShell {
  el: HTMLElement;
  /** Holds the board — what the game's own input-wiring queries for
   *  clickable cells/edges. */
  boardSlot: HTMLElement;
  /** Where the end-of-match banner and buttons go. Cleared on reset. */
  controls: HTMLElement;
  /** Persistent in-match actions (e.g. "New game"). Survives every board
   *  re-render; hide it externally while the end-of-match controls are up. */
  actions: HTMLElement;
  /** Set the line under the board. It survives until the next call or a
   *  reset — in particular, it survives the board being re-rendered. */
  setNote(content: string | Node[], kind?: "result" | "error"): void;
  /** Reset for a rematch: clears the board slot, controls and note, and
   *  un-hides `actions`. Does NOT touch topLeft/topRight/log — those own
   *  their own reset (e.g. `balances.update(...)`, `log.clear()`). */
  reset(): void;
}

export function createMatchShell(opts: MatchShellOptions): MatchShell {
  const el = document.createElement("div");
  el.className = "match";

  const boardArea = document.createElement("div");
  boardArea.className = "match__board";

  const boardSlot = document.createElement("div");
  boardSlot.className = "match__board-slot";

  const note = document.createElement("p");
  note.className = "turn-result";
  note.setAttribute("data-note", "");
  note.hidden = true;

  const controls = document.createElement("div");
  controls.className = "match__controls";

  const actions = document.createElement("div");
  actions.className = "match__actions";
  actions.setAttribute("data-actions", "");

  boardArea.append(boardSlot, note, controls, actions);

  // Source order is the mobile stacking order, and also the 2x2 grid's
  // auto-placement order on wide screens (see .match in theme.css).
  el.append(
    wrap("match__top-left", opts.topLeft),
    wrap("match__top-right", opts.topRight),
    boardArea,
    wrap("match__log", opts.log),
  );

  opts.root.innerHTML = "";
  opts.root.append(el);

  function setNote(content: string | Node[], kind: "result" | "error" = "result") {
    note.hidden = false;
    note.className = kind === "error" ? "error" : "turn-result";
    if (typeof content === "string") {
      note.textContent = content;
    } else {
      note.replaceChildren(...content);
    }
  }

  return {
    el,
    boardSlot,
    controls,
    actions,
    setNote,
    reset() {
      boardSlot.innerHTML = "";
      controls.innerHTML = "";
      actions.hidden = false;
      note.hidden = true;
      note.textContent = "";
    },
  };
}

function wrap(className: string, child: HTMLElement): HTMLElement {
  const div = document.createElement("div");
  div.className = className;
  div.append(child);
  return div;
}

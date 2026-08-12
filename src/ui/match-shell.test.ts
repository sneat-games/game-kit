// Adapted from bidding-tictactoe/web/src/ui/match-screen.test.ts. The kit's
// match-shell no longer owns balances/bidPanel/log/board (those are
// caller-owned, or entirely game-owned for the board) — so this exercises
// layout, the note line, controls/actions and reset() against plain stand-in
// elements instead of the concrete BTTT cards.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMatchShell } from "./match-shell.js";

function stub(name: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute(`data-${name}`, "");
  return el;
}

function shell() {
  const root = document.createElement("div");
  document.body.append(root);
  return createMatchShell({ root, topLeft: stub("top-left"), topRight: stub("top-right"), log: stub("log") });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("match shell layout", () => {
  it("lays out top-left, top-right, board and log in that order", () => {
    const s = shell();
    const regions = [...s.el.children].map((c) => c.className);
    expect(regions).toEqual(["match__top-left", "match__top-right", "match__board", "match__log"]);
  });

  it("wraps the caller-supplied elements without altering them", () => {
    const s = shell();
    const [topLeft, topRight, board, log] = [...s.el.children];
    expect(topLeft.querySelector("[data-top-left]")).not.toBeNull();
    expect(topRight.querySelector("[data-top-right]")).not.toBeNull();
    expect(board).toBe(s.boardSlot.parentElement);
    expect(log.querySelector("[data-log]")).not.toBeNull();
  });

  it("exposes an empty boardSlot for the game to render into", () => {
    const s = shell();
    expect(s.boardSlot.className).toBe("match__board-slot");
    expect(s.boardSlot.children).toHaveLength(0);
  });
});

describe("the note under the board", () => {
  const note = (s: ReturnType<typeof shell>) =>
    s.boardSlot.parentElement!.querySelector<HTMLElement>("[data-note]")!;

  it("starts hidden", () => {
    expect(note(shell()).hidden).toBe(true);
  });

  it("survives the game re-rendering the board slot", () => {
    // The turn result used to be wiped by the following turn's board
    // render, which put it on screen for a single frame in every turn but
    // the last. The board slot is a sibling the game owns; mutating it must
    // not touch the note.
    const s = shell();
    s.boardSlot.append(document.createElement("span"));
    s.setNote("P1 won the turn, took the centre, paid 30.");
    s.boardSlot.innerHTML = ""; // simulate the game's next-turn re-render
    s.boardSlot.append(document.createElement("span"));
    expect(note(s).hidden).toBe(false);
    expect(note(s).textContent).toBe("P1 won the turn, took the centre, paid 30.");
  });

  it("replaces the previous note rather than appending", () => {
    const s = shell();
    s.setNote("first");
    s.setNote("second");
    expect(s.boardSlot.parentElement!.querySelectorAll("[data-note]")).toHaveLength(1);
    expect(note(s).textContent).toBe("second");
  });

  it("accepts rich nodes as well as plain strings", () => {
    const s = shell();
    const strong = document.createElement("strong");
    strong.textContent = "the centre";
    s.setNote([document.createTextNode("P1 took "), strong]);
    expect(note(s).querySelector("strong")!.textContent).toBe("the centre");
  });

  it("switches styling between a result and an error", () => {
    const s = shell();
    s.setNote("P1 won the turn.");
    expect(note(s).className).toBe("turn-result");
    s.setNote("Invalid move: bid exceeds remaining budget", "error");
    expect(note(s).className).toBe("error");
  });

  it("clears on reset", () => {
    const s = shell();
    s.setNote("P1 won the turn.");
    s.reset();
    expect(note(s).hidden).toBe(true);
    expect(note(s).textContent).toBe("");
  });
});

describe("end-of-match controls and actions", () => {
  it("keep to their own slots and clear/reveal correctly on reset", () => {
    const s = shell();
    s.boardSlot.append(document.createElement("div"));
    s.controls.append(document.createElement("button"));
    expect(s.controls.children).toHaveLength(1);
    s.actions.hidden = true; // simulate hiding in-match actions while the match-over banner is up
    s.reset();
    expect(s.controls.children).toHaveLength(0);
    expect(s.boardSlot.children).toHaveLength(0);
    expect(s.actions.hidden).toBe(false);
  });
});

describe("match shell does not touch caller-owned slots", () => {
  it("leaves topLeft/topRight/log content alone on reset", () => {
    const s = shell();
    const topLeftContent = document.createElement("span");
    s.el.querySelector(".match__top-left")!.append(topLeftContent);
    s.reset();
    expect(s.el.querySelector(".match__top-left")!.contains(topLeftContent)).toBe(true);
  });
});

describe("layout stylesheet contract", () => {
  // jsdom applies no stylesheet, so the width guarantees are asserted
  // against the CSS itself: the left column IS the board's width and the
  // right column is ONE width shared by top-right and log.
  const css = readFileSync(resolve(process.cwd(), "src/ui/theme.css"), "utf8");

  it("derives the board width from a per-game cell count (not hard-coded to 3x3)", () => {
    expect(css).toMatch(
      /--board-width:\s*calc\(var\(--board-cells\)\s*\*\s*var\(--cell-size\)\s*\+\s*\(var\(--board-cells\)\s*-\s*1\)\s*\*\s*var\(--cell-gap\)\)/,
    );
  });

  it("sizes the match columns as board-width + one side width", () => {
    expect(css).toMatch(/\.match\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/grid-template-columns:\s*var\(--board-width\) var\(--side-width\)/);
  });

  it("collapses to a single column on narrow screens", () => {
    const wide = css.indexOf("@media (min-width: 720px)");
    expect(wide).toBeGreaterThan(-1);
    // The two-column rule is inside the media query, so the default is the
    // single-column stack.
    expect(css.indexOf("var(--board-width) var(--side-width)")).toBeGreaterThan(wide);
  });
});

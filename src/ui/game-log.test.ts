// Ported from bidding-tictactoe/web/src/ui/game-log.test.ts, adapted to the
// generic entry shape (head/rows instead of TurnResult/Move/budgets).
import { describe, it, expect, beforeEach } from "vitest";
import { createGameLog, type GameLogEntry } from "./game-log.js";

const entry = (over: Partial<GameLogEntry> = {}): GameLogEntry => ({
  turn: 0,
  head: "P1 took the centre",
  rows: [
    { label: "P1 bid", value: "30", fraction: 0.3, player: 0, won: true },
    { label: "P2 bid", value: "12", fraction: 0.12, player: 1, dim: true },
  ],
  ...over,
});

function log() {
  const l = createGameLog();
  document.body.append(l.el);
  return l;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("game log entries", () => {
  it("colours each bar by player, not by who won", () => {
    const l = log();
    l.append(entry());
    const fills = [...l.el.querySelectorAll(".bar-fill")].map((f) => f.className);
    expect(fills[0]).toContain("bar-fill--p1");
    expect(fills[1]).toContain("bar-fill--p2");
  });

  it("keeps the same player colours when the other side wins", () => {
    const l = log();
    l.append(entry({
      rows: [
        { label: "P1 bid", value: "12", fraction: 0.12, player: 0, dim: true },
        { label: "P2 bid", value: "30", fraction: 0.3, player: 1, won: true },
      ],
    }));
    const fills = [...l.el.querySelectorAll(".bar-fill")].map((f) => f.className);
    expect(fills[0]).toContain("bar-fill--p1");
    expect(fills[1]).toContain("bar-fill--p2");
  });

  it("marks the winning row by weight rather than by hue", () => {
    const l = log();
    l.append(entry());
    const rows = [...l.el.querySelectorAll(".game-log__bid")].map((r) => r.className);
    expect(rows[0]).toContain("game-log__bid--won");
    expect(rows[1]).toContain("game-log__bid--dim");
    expect(l.el.querySelectorAll(".game-log__bid-won-marker")).toHaveLength(1);
  });

  it("renders the caller-supplied head text (board naming is game-owned)", () => {
    const l = log();
    l.append(entry({ head: "P1 took the centre" }));
    const head = l.el.querySelector(".game-log__entry-head")!.textContent!;
    expect(head).toContain("the centre");
    expect(head).toContain("T1");
  });

  it("accepts a rich Node for the head instead of a plain string", () => {
    const l = log();
    const chip = document.createElement("strong");
    chip.textContent = "P1";
    l.append(entry({ head: chip }));
    expect(l.el.querySelector(".game-log__entry-head strong")!.textContent).toBe("P1");
  });

  it("badges a tie-break", () => {
    const l = log();
    l.append(entry({ tie: true }));
    expect(l.el.querySelector(".game-log__tie")!.textContent).toBe("tie");
  });

  it("omits the tie badge when tie is not set", () => {
    const l = log();
    l.append(entry());
    expect(l.el.querySelector(".game-log__tie")).toBeNull();
  });

  it("sizes each bar directly from the row's fraction, clamped to [0, 1]", () => {
    const l = log();
    l.append(entry({
      rows: [
        { label: "P1 bid", value: "999", fraction: 1.5, player: 0 }, // over 1 -> clamped
        { label: "P2 bid", value: "-1", fraction: -0.2, player: 1 }, // under 0 -> clamped
      ],
    }));
    const fills = [...l.el.querySelectorAll<HTMLElement>(".bar-fill")];
    expect(parseFloat(fills[0].style.width)).toBe(100);
    expect(parseFloat(fills[1].style.width)).toBe(0);
  });

  it("renders an entry with no rows (classic, non-bidding modes)", () => {
    const l = log();
    l.append({ turn: 2, head: "P2 drew the top edge" });
    expect(l.el.querySelectorAll(".game-log__bid")).toHaveLength(0);
    expect(l.el.querySelector(".game-log__entry-head")!.textContent).toContain("T3");
  });

  it("shows newest first", () => {
    const l = log();
    l.append(entry({ turn: 0, head: "first" }));
    l.append(entry({ turn: 1, head: "second" }));
    const heads = [...l.el.querySelectorAll(".game-log__entry-head")].map((e) => e.textContent);
    expect(heads[0]).toContain("T2");
    expect(heads[1]).toContain("T1");
  });

  it("clears on a rematch", () => {
    const l = log();
    l.append(entry());
    l.clear();
    expect(l.el.querySelectorAll(".game-log__entry")).toHaveLength(0);
  });
});

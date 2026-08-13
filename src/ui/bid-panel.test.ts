// Ported from bidding-tictactoe/web/src/ui/bid-panel.test.ts. Hint copy
// changed from "Click a cell to commit." (tic-tac-toe specific) to "Make
// your move to commit." (board-agnostic — a game could be drawing an edge
// or placing a stone); the stylesheet contract now points at this kit's
// theme.css instead of BTTT's global.css.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBidPanel } from "./bid-panel.js";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function panel() {
  const p = createBidPanel();
  document.body.append(p.el);
  return p;
}

const clockBox = (p: ReturnType<typeof panel>) =>
  p.el.querySelector<HTMLElement>("[data-clock]")!;

describe("bid panel", () => {
  // A game adopting this panel must not silently inherit generic copy in
  // place of its own more precise line — that regression is what makes
  // teams keep private copies rather than reuse the kit.
  it("uses the game-agnostic move hint by default", () => {
    const p = panel();
    p.beginTurn({ max: 50 });
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Make your move to commit.");
  });

  it("lets a game name its own move gesture", () => {
    const p = createBidPanel({ moveHint: "Click a cell to commit." });
    document.body.append(p.el);
    p.beginTurn({ max: 50 });
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Click a cell to commit.");
  });

  it("restores the game's own hint after a waiting message", () => {
    const p = createBidPanel({ moveHint: "Click a cell to commit." });
    document.body.append(p.el);
    p.beginTurn({ max: 50 });
    p.setWaiting("Waiting for your opponent…");
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Waiting for your opponent…");
    p.beginTurn({ max: 40 });
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Click a cell to commit.");
  });

  it("seeds the bid at half the balance and caps it there", () => {
    const p = panel();
    p.beginTurn({ max: 80 });
    expect(p.value()).toBe(40);
    const slider = p.el.querySelector<HTMLInputElement>(".bid-input__slider")!;
    expect(slider.max).toBe("80");
  });

  it("rebuilds the controls for each turn's balance", () => {
    const p = panel();
    p.beginTurn({ max: 100 });
    p.beginTurn({ max: 30 });
    expect(p.value()).toBe(15);
    expect(p.el.querySelectorAll(".bid-input")).toHaveLength(1);
  });

  it("reports 0 before any turn has begun", () => {
    expect(panel().value()).toBe(0);
  });
});

describe("bid panel clock", () => {
  it("shows the countdown and the bid that will fire", () => {
    vi.useFakeTimers();
    const p = panel();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire: () => {} });
    expect(clockBox(p).hidden).toBe(false);
    expect(p.el.querySelector("[data-clock-secs]")!.textContent).toBe("10s");
    expect(p.el.querySelector("[data-auto-bid]")!.textContent).toContain("auto-bid 0");
  });

  it("counts down and expires once", () => {
    vi.useFakeTimers();
    const p = panel();
    const onExpire = vi.fn();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 7, onExpire });
    vi.advanceTimersByTime(4_000);
    expect(p.el.querySelector("[data-clock-secs]")!.textContent).toBe("6s");
    vi.advanceTimersByTime(10_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("flags the last three seconds as urgent", () => {
    vi.useFakeTimers();
    const p = panel();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire: () => {} });
    vi.advanceTimersByTime(5_000);
    expect(clockBox(p).classList.contains("bid-panel__clock--urgent")).toBe(false);
    vi.advanceTimersByTime(2_500);
    expect(clockBox(p).classList.contains("bid-panel__clock--urgent")).toBe(true);
  });

  it("replaces a running clock rather than stacking two", () => {
    vi.useFakeTimers();
    const p = panel();
    const first = vi.fn();
    const second = vi.fn();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 30_000, label: "Bid within", autoBid: 50, onExpire: first });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire: second });
    vi.advanceTimersByTime(40_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("hides the clock and cancels expiry on stopClock", () => {
    vi.useFakeTimers();
    const p = panel();
    const onExpire = vi.fn();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire });
    p.stopClock();
    expect(clockBox(p).hidden).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("stops the clock when a new turn begins", () => {
    vi.useFakeTimers();
    const p = panel();
    const onExpire = vi.fn();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire });
    p.beginTurn({ max: 100 });
    vi.advanceTimersByTime(30_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(clockBox(p).hidden).toBe(true);
  });
});

describe("bid panel waiting state", () => {
  it("disables the controls, hides the clock and explains the wait", () => {
    vi.useFakeTimers();
    const p = panel();
    const onExpire = vi.fn();
    p.beginTurn({ max: 100 });
    p.runClock({ ms: 10_000, label: "Answer within", autoBid: 0, onExpire });
    p.setWaiting("Waiting for your friend…");

    expect(clockBox(p).hidden).toBe(true);
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Waiting for your friend…");
    expect(p.el.querySelector<HTMLInputElement>(".bid-input__slider")!.disabled).toBe(true);
    expect(p.el.querySelector<HTMLInputElement>(".bid-input__number")!.disabled).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("re-enables the controls on the next turn", () => {
    const p = panel();
    p.beginTurn({ max: 100 });
    p.setWaiting("Waiting…");
    p.beginTurn({ max: 100 });
    expect(p.el.querySelector<HTMLInputElement>(".bid-input__slider")!.disabled).toBe(false);
    expect(p.el.querySelector("[data-bid-hint]")!.textContent).toBe("Make your move to commit.");
  });
});

describe("bid panel stylesheet contract", () => {
  const css = readFileSync(resolve(process.cwd(), "src/ui/theme.css"), "utf8");

  it("re-states [hidden] for the clock", () => {
    // `.bid-panel__clock { display: flex }` matches the UA's `[hidden]` rule
    // on specificity and beats it on origin, so without this the expired
    // countdown stays on screen for the rest of the match.
    expect(css).toMatch(/\.bid-panel__clock\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
  });
});

// BTTT had no balances.test.ts of its own; new coverage for the
// genericized (player 0/1, --p1/--p2) version.
import { describe, it, expect } from "vitest";
import { createBalances } from "./balances.js";

function mount() {
  const b = createBalances({ initialBudget: 100, p1Label: "You", p2Label: "Friend" });
  document.body.append(b.el);
  return b;
}

describe("balances", () => {
  it("renders both players against the initial budget", () => {
    const b = mount();
    const labels = [...b.el.querySelectorAll(".balances__label")].map((e) => e.textContent);
    expect(labels).toEqual(["You: 100/100", "Friend: 100/100"]);
  });

  it("colours each bar by player, p1 then p2 in source order", () => {
    const b = mount();
    const fills = [...b.el.querySelectorAll(".bar-fill")].map((f) => f.className);
    expect(fills[0]).toContain("bar-fill--p1");
    expect(fills[1]).toContain("bar-fill--p2");
  });

  it("updates both bars from post-turn budgets", () => {
    const b = mount();
    b.update([70, 130]);
    const labels = [...b.el.querySelectorAll(".balances__label")].map((e) => e.textContent);
    expect(labels).toEqual(["You: 70/100", "Friend: 130/100"]);
  });

  it("clamps a balance bar that has grown past the initial budget", () => {
    // The winner's bid is transferred to the loser, so a balance can exceed
    // the starting budget — the bar must fill, not overflow.
    const b = mount();
    b.update([0, 200]);
    const fill = b.el.querySelector<HTMLElement>(".bar-fill--p2")!;
    expect(parseFloat(fill.style.width)).toBe(100);
  });

  it("exposes data-balance attributes for both rows", () => {
    const b = mount();
    expect([...b.el.querySelectorAll("[data-balance]")].map((r) => r.getAttribute("data-balance"))).toEqual([
      "p1",
      "p2",
    ]);
  });
});

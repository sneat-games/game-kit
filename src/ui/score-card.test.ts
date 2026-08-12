// New module (BTTT has no classic mode), new tests.
import { describe, it, expect } from "vitest";
import { createScoreCard } from "./score-card.js";

function mount() {
  const s = createScoreCard({ p1Label: "You", p2Label: "Friend" });
  document.body.append(s.el);
  return s;
}

describe("score card", () => {
  it("starts both players at zero", () => {
    const s = mount();
    const values = [...s.el.querySelectorAll(".score-card__value")].map((e) => e.textContent);
    expect(values).toEqual(["0", "0"]);
    const labels = [...s.el.querySelectorAll(".score-card__label")].map((e) => e.textContent);
    expect(labels).toEqual(["You", "Friend"]);
  });

  it("updates both rows from the given scores", () => {
    const s = mount();
    s.update([3, 5]);
    const values = [...s.el.querySelectorAll(".score-card__value")].map((e) => e.textContent);
    expect(values).toEqual(["3", "5"]);
  });

  it("gives each player one colour chip via the shared player tokens", () => {
    const s = mount();
    const chips = [...s.el.querySelectorAll(".score-card__chip")].map((c) => c.className);
    expect(chips[0]).toContain("score-card__chip--p1");
    expect(chips[1]).toContain("score-card__chip--p2");
  });

  it("replaces rather than accumulates rows on repeated updates", () => {
    const s = mount();
    s.update([1, 1]);
    s.update([2, 2]);
    expect(s.el.querySelectorAll(".score-card__row")).toHaveLength(2);
  });
});

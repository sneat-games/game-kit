// New coverage: renderMenu is new in this kit (richer than BTTT's), and
// renderMenuSimple is BTTT's original three-button menu carried over with a
// generic title/subtitle instead of hard-coded copy.
import { describe, it, expect } from "vitest";
import { renderMenu, renderMenuSimple, type MenuOption } from "./menu.js";

const modes: MenuOption[] = [
  { id: "vs-bot", label: "vs Bot", desc: "Play a quick match against the bot" },
  { id: "vs-friend", label: "vs Friend", desc: "Invite a friend over WebRTC" },
];
const variants: MenuOption[] = [
  { id: "classic", label: "Classic" },
  { id: "bidding", label: "Bidding" },
];
const sizes: MenuOption[] = [
  { id: "7", label: "7×7" },
  { id: "9", label: "9×9" },
  { id: "11", label: "11×11" },
];

function mount(defaults?: { mode?: string; variant?: string; size?: string }) {
  const root = document.createElement("div");
  document.body.append(root);
  const result = renderMenu({ root, title: "Play Hex", modes, variants, sizes, defaults });
  return { root, result };
}

describe("renderMenu", () => {
  it("clears the root and renders a heading", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>stale</p>";
    document.body.append(root);
    renderMenu({ root, title: "Play Hex", modes, variants, sizes });
    expect(root.querySelector("h2")!.textContent).toBe("Play Hex");
    expect(root.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders one accessible radio group per dimension, with legends", () => {
    const { root } = mount();
    const legends = [...root.querySelectorAll(".menu__legend")].map((l) => l.textContent);
    expect(legends).toEqual(["Mode", "Variant", "Board size"]);
    expect(root.querySelectorAll('input[name="mode"]')).toHaveLength(2);
    expect(root.querySelectorAll('input[name="variant"]')).toHaveLength(2);
    expect(root.querySelectorAll('input[name="size"]')).toHaveLength(3);
  });

  it("defaults to the first option in each group when no default is given", () => {
    const { root } = mount();
    expect(root.querySelector<HTMLInputElement>('input[name="mode"]')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('input[name="variant"]')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('input[name="size"]')!.checked).toBe(true);
  });

  it("honours explicit defaults", () => {
    const { root } = mount({ mode: "vs-friend", variant: "bidding", size: "9" });
    expect(root.querySelector<HTMLInputElement>('#mode-vs-friend')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#variant-bidding')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#size-9')!.checked).toBe(true);
  });

  it("resolves with the default selection when Play is clicked without changes", async () => {
    const { root, result } = mount({ mode: "vs-bot", variant: "classic", size: "11" });
    root.querySelector<HTMLButtonElement>(".menu__play")!.click();
    await expect(result).resolves.toEqual({ mode: "vs-bot", variant: "classic", size: "11" });
  });

  it("resolves with a changed selection", async () => {
    const { root, result } = mount({ mode: "vs-bot", variant: "classic", size: "7" });
    root.querySelector<HTMLInputElement>("#mode-vs-friend")!.click();
    root.querySelector<HTMLInputElement>("#variant-bidding")!.click();
    root.querySelector<HTMLInputElement>("#size-11")!.click();
    root.querySelector<HTMLButtonElement>(".menu__play")!.click();
    await expect(result).resolves.toEqual({ mode: "vs-friend", variant: "bidding", size: "11" });
  });

  it("labels each option card for a screen reader via <label for>", () => {
    const { root } = mount();
    const label = root.querySelector<HTMLLabelElement>(".menu-card")!;
    const forId = label.getAttribute("for")!;
    expect(root.querySelector(`#${forId}`)).not.toBeNull();
  });
});

describe("renderMenuSimple", () => {
  it("resolves 'vs-bot' / 'vs-friend' / 'leave' from the matching button", async () => {
    for (const [id, want] of [
      [".menu__btn--bot", "vs-bot"],
      [".menu__btn--friend", "vs-friend"],
      [".menu__btn--leave", "leave"],
    ] as const) {
      const root = document.createElement("div");
      document.body.append(root);
      const result = renderMenuSimple(root);
      root.querySelector<HTMLButtonElement>(id)!.click();
      await expect(result).resolves.toBe(want);
      root.remove();
    }
  });

  it("renders an optional title and subtitle", () => {
    const root = document.createElement("div");
    document.body.append(root);
    renderMenuSimple(root, { title: "Play Dots & Boxes", subtitle: "Pick a mode" });
    expect(root.querySelector("h2")!.textContent).toBe("Play Dots & Boxes");
    expect(root.querySelector("p")!.textContent).toBe("Pick a mode");
  });

  it("omits the title/subtitle elements when not given", () => {
    const root = document.createElement("div");
    document.body.append(root);
    renderMenuSimple(root);
    expect(root.querySelector("h2")).toBeNull();
    expect(root.querySelector("p")).toBeNull();
  });

  it("clears the root before rendering", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>stale</p>";
    document.body.append(root);
    renderMenuSimple(root);
    expect(root.querySelectorAll(".menu")).toHaveLength(1);
  });
});

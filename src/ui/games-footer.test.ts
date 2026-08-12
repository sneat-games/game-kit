// New module (founder addendum, 2026-08-12). KNOWN_GAMES has grown by
// several more founder addendums since — rather than re-hardcode the full
// roster in every assertion (and edit it again on the next addition), most
// of these derive their expectations from KNOWN_GAMES itself, the single
// source of truth, and keep only the handful of pinned checks that matter
// (specific known entries, ordering guarantees) as literals.
import { describe, it, expect } from "vitest";
import { createGamesFooter, KNOWN_GAMES } from "./games-footer.js";

describe("KNOWN_GAMES", () => {
  it("has no duplicate ids", () => {
    const ids = KNOWN_GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a non-empty title, emoji and an https url", () => {
    for (const g of KNOWN_GAMES) {
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.emoji.length).toBeGreaterThan(0);
      expect(g.url).toMatch(/^https:\/\//);
    }
  });

  it("includes the original kit games and later additions with exact metadata", () => {
    expect(KNOWN_GAMES.find((g) => g.id === "hex")).toEqual({
      id: "hex",
      title: "Hex",
      emoji: "⬡",
      url: "https://hex.sneat.games",
    });
    expect(KNOWN_GAMES.find((g) => g.id === "reversi")).toEqual({
      id: "reversi",
      title: "Reversi",
      emoji: "⚫",
      url: "https://reversi.sneat.games",
    });
    expect(KNOWN_GAMES.find((g) => g.id === "gomoku")).toEqual({
      id: "gomoku",
      title: "Gomoku",
      emoji: "5️⃣",
      url: "https://gomoku.sneat.games",
    });
    // The founder's main game: cross-promoted from every casual game, even
    // though it does not itself consume this kit.
    expect(KNOWN_GAMES.find((g) => g.id === "chessraiders")).toEqual({
      id: "chessraiders",
      title: "Chess Raiders",
      emoji: "♞",
      url: "https://chessraiders.com",
    });
  });

  it("ends with Chess Raiders (the founder's main game gets the last cross-promo slot)", () => {
    expect(KNOWN_GAMES[KNOWN_GAMES.length - 1].id).toBe("chessraiders");
  });
});

describe("createGamesFooter", () => {
  it("renders a <footer class=games-footer> with the muted heading", () => {
    const el = createGamesFooter({ current: "hex" });
    expect(el.tagName).toBe("FOOTER");
    expect(el.className).toBe("games-footer");
    expect(el.querySelector(".games-footer__heading")!.textContent).toBe("More from Sneat Games");
  });

  it("links every other game in registry order, excluding the current one, plus 'All games' last", () => {
    const el = createGamesFooter({ current: "hex" });
    const labels = [...el.querySelectorAll(".games-footer__pill")].map((a) => a.textContent);
    const expected = KNOWN_GAMES.filter((g) => g.id !== "hex").map((g) => `${g.emoji} ${g.title}`);
    expected.push("All games");
    expect(labels).toEqual(expected);
  });

  it("uses the correct href for each pill, and opens in a new tab safely", () => {
    const el = createGamesFooter({ current: "dots-and-boxes" });
    const pills = [...el.querySelectorAll<HTMLAnchorElement>(".games-footer__pill")];
    const expectedHrefs = [
      ...KNOWN_GAMES.filter((g) => g.id !== "dots-and-boxes").map((g) => `${g.url}/`),
      "https://sneat.games/",
    ];
    expect(pills.map((a) => a.href)).toEqual(expectedHrefs);
    for (const a of pills) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toBe("noopener");
    }
  });

  it("always appends the 'All games' pill last, linking to the landing page", () => {
    const el = createGamesFooter({ current: "bidding-tictactoe" });
    const pills = [...el.querySelectorAll<HTMLAnchorElement>(".games-footer__pill")];
    const last = pills[pills.length - 1];
    expect(last.textContent).toBe("All games");
    expect(last.href).toBe("https://sneat.games/");
  });

  it("links every known game plus 'All games' when current matches none", () => {
    const el = createGamesFooter({ current: "unknown-game" });
    expect(el.querySelectorAll(".games-footer__pill")).toHaveLength(KNOWN_GAMES.length + 1);
  });

  it("excludes exactly the current game when it matches a known entry", () => {
    const el = createGamesFooter({ current: "gomoku" });
    const pills = [...el.querySelectorAll(".games-footer__pill")];
    expect(pills).toHaveLength(KNOWN_GAMES.length); // (N-1) other games + "All games"
    expect(pills.some((p) => p.textContent?.includes("Gomoku"))).toBe(false);
  });
});

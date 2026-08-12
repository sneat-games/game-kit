// New module (founder addendum, 2026-08-12): cross-promotion footer.
import { describe, it, expect } from "vitest";
import { createGamesFooter, KNOWN_GAMES } from "./games-footer.js";

describe("KNOWN_GAMES", () => {
  it("is the single source of truth for the casual games plus Chess Raiders", () => {
    expect(KNOWN_GAMES.map((g) => g.id)).toEqual([
      "bidding-tictactoe",
      "dots-and-boxes",
      "hex",
      "reversi",
      "chessraiders",
    ]);
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
    // The founder's main game: cross-promoted from every casual game, even
    // though it does not itself consume this kit.
    expect(KNOWN_GAMES.find((g) => g.id === "chessraiders")).toEqual({
      id: "chessraiders",
      title: "Chess Raiders",
      emoji: "♞",
      url: "https://chessraiders.com",
    });
  });
});

describe("createGamesFooter", () => {
  it("renders a <footer class=games-footer> with the muted heading", () => {
    const el = createGamesFooter({ current: "hex" });
    expect(el.tagName).toBe("FOOTER");
    expect(el.className).toBe("games-footer");
    expect(el.querySelector(".games-footer__heading")!.textContent).toBe("More from Sneat Games");
  });

  it("links every other game, excluding the current one", () => {
    const el = createGamesFooter({ current: "hex" });
    const labels = [...el.querySelectorAll(".games-footer__pill")].map((a) => a.textContent);
    expect(labels).toEqual([
      "⭕ Bidding Tic-Tac-Toe",
      "🔲 Dots & Boxes",
      "⚫ Reversi",
      "♞ Chess Raiders",
      "All games",
    ]);
  });

  it("uses the correct href for each pill, and opens in a new tab safely", () => {
    const el = createGamesFooter({ current: "dots-and-boxes" });
    const pills = [...el.querySelectorAll<HTMLAnchorElement>(".games-footer__pill")];
    expect(pills.map((a) => a.href)).toEqual([
      "https://bidding-tictactoe.sneat.games/",
      "https://hex.sneat.games/",
      "https://reversi.sneat.games/",
      "https://chessraiders.com/",
      "https://sneat.games/",
    ]);
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
    expect(el.querySelectorAll(".games-footer__pill")).toHaveLength(6);
  });
});

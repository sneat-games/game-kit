// Cross-promotion footer (founder, 2026-08-12): every Sneat game shows a
// compact "More from Sneat Games" strip linking the OTHER games plus the
// sneat.games landing page. `KNOWN_GAMES` is the single source of truth for
// the registry (id, title, emoji, url) — a game passes its own id as
// `current` and gets everyone else back.
//
// Since 2026-10 the games live at https://sneat.games/<slug>/ (see
// pwa/host.ts), so every url is `gameUrl(<slug>)`. The slug is the old host
// label, which is not always the id: greed-game -> `greed`.

import { gameUrl } from "../pwa/host.js";

export interface SneatGame {
  id: string;
  title: string;
  emoji: string;
  url: string;
}

export const KNOWN_GAMES: readonly SneatGame[] = [
  { id: "bidding-tictactoe", title: "Bidding Tic-Tac-Toe", emoji: "⭕", url: gameUrl("bidding-tictactoe") },
  { id: "dots-and-boxes", title: "Dots & Boxes", emoji: "🔲", url: gameUrl("dots-and-boxes") },
  { id: "hex", title: "Hex", emoji: "⬡", url: gameUrl("hex") },
  { id: "reversi", title: "Reversi", emoji: "⚫", url: gameUrl("reversi") },
  // Wave B (founder-approved 2026-08-12): same shape as D&B/Hex/Reversi.
  { id: "four-in-a-row", title: "Four in a Row", emoji: "🔴", url: gameUrl("four-in-a-row") },
  { id: "gomoku", title: "Gomoku", emoji: "5️⃣", url: gameUrl("gomoku") },
  {
    id: "ultimate-tictactoe",
    title: "Ultimate Tic-Tac-Toe",
    emoji: "🎯",
    url: gameUrl("ultimate-tictactoe"),
  },
  { id: "domineering", title: "Domineering", emoji: "🧱", url: gameUrl("domineering") },
  { id: "y", title: "Y", emoji: "🔺", url: gameUrl("y") },
  { id: "greed-game", title: "The Greed Game", emoji: "💰", url: gameUrl("greed") },
  // The founder's main game — not itself built on this kit (its own site is
  // separate), but every casual game cross-promotes it.
  { id: "chessraiders", title: "Chess Raiders", emoji: "♞", url: "https://chessraiders.com" },
];

/** Build the footer element. Every KNOWN_GAMES entry except `opts.current`
 *  gets a pill link, followed by a final pill to the sneat.games landing
 *  page. The caller appends the returned element wherever its layout wants
 *  it — this module renders one element, nothing more. */
export function createGamesFooter(opts: { current: string }): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "games-footer";
  footer.setAttribute("data-games-footer", "");

  const heading = document.createElement("p");
  heading.className = "games-footer__heading";
  heading.textContent = "More from Sneat Games";
  footer.append(heading);

  const links = document.createElement("div");
  links.className = "games-footer__links";

  for (const game of KNOWN_GAMES) {
    if (game.id === opts.current) continue;
    links.append(pill(game.title, game.url, game.emoji));
  }
  links.append(pill("All games", "https://sneat.games/"));

  footer.append(links);
  return footer;
}

/**
 * One pill. The emoji is its OWN element rather than part of the label
 * string for two reasons: a plain "<emoji> <title>" text node renders with
 * no visible gap for colour-emoji glyphs (the pill's flex `gap` cannot
 * apply inside a single anonymous flex item, and the emoji font eats the
 * space), and a decorative glyph should not be announced — so it is
 * aria-hidden and the accessible name stays just the title.
 */
function pill(title: string, href: string, emoji?: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "games-footer__pill";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  if (emoji) {
    const icon = document.createElement("span");
    icon.className = "games-footer__emoji";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = emoji;
    a.append(icon);
  }
  const label = document.createElement("span");
  label.className = "games-footer__label";
  label.textContent = title;
  a.append(label);
  return a;
}

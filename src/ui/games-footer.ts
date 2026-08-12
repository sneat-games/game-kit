// Cross-promotion footer (founder, 2026-08-12): every Sneat game shows a
// compact "More from Sneat Games" strip linking the OTHER games plus the
// sneat.games landing page. `KNOWN_GAMES` is the single source of truth for
// the registry (id, title, emoji, url) — a game passes its own id as
// `current` and gets everyone else back.

export interface SneatGame {
  id: string;
  title: string;
  emoji: string;
  url: string;
}

export const KNOWN_GAMES: readonly SneatGame[] = [
  { id: "bidding-tictactoe", title: "Bidding Tic-Tac-Toe", emoji: "⭕", url: "https://bidding-tictactoe.sneat.games" },
  { id: "dots-and-boxes", title: "Dots & Boxes", emoji: "🔲", url: "https://dots-and-boxes.sneat.games" },
  { id: "hex", title: "Hex", emoji: "⬡", url: "https://hex.sneat.games" },
  { id: "reversi", title: "Reversi", emoji: "⚫", url: "https://reversi.sneat.games" },
  // Wave B (founder-approved 2026-08-12): same shape as D&B/Hex/Reversi.
  { id: "four-in-a-row", title: "Four in a Row", emoji: "🔴", url: "https://four-in-a-row.sneat.games" },
  { id: "gomoku", title: "Gomoku", emoji: "5️⃣", url: "https://gomoku.sneat.games" },
  {
    id: "ultimate-tictactoe",
    title: "Ultimate Tic-Tac-Toe",
    emoji: "🎯",
    url: "https://ultimate-tictactoe.sneat.games",
  },
  { id: "domineering", title: "Domineering", emoji: "🧱", url: "https://domineering.sneat.games" },
  { id: "y", title: "Y", emoji: "🔺", url: "https://y.sneat.games" },
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
    links.append(pill(`${game.emoji} ${game.title}`, game.url));
  }
  links.append(pill("All games", "https://sneat.games/"));

  footer.append(links);
  return footer;
}

function pill(label: string, href: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "games-footer__pill";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label;
  return a;
}

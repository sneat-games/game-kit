// Where a game is running, and where its canonical home is.
//
// Since 2026-10 every game lives in a directory of the apex site,
// `https://sneat.games/<slug>/`, instead of on its own `<host>.sneat.games`
// subdomain (one assets-only Worker instead of ten host Workers). The slug
// is the old host label (`greed`, `y`, `bidding-tictactoe`, ...), so one
// zone redirect maps every old subdomain onto its directory.
//
// Two gates used to test `hostname.endsWith(".sneat.games")`, which is FALSE
// for the apex itself: the service-worker gate (no offline mode at
// /<slug>/) and every game's invite-link base (invites would point back at
// the retired subdomain). Both now go through `isSneatGamesHost`.

/** The apex that hosts every game under `/<slug>/`. */
export const SNEAT_GAMES_ORIGIN = "https://sneat.games";

/**
 * True for the sneat.games apex and any `*.sneat.games` subdomain — the
 * game's own deploy surface. False for CrazyGames/itch.io iframes,
 * localhost, and look-alikes such as `evilsneat.games`.
 */
export function isSneatGamesHost(hostname: string = window.location.hostname): boolean {
  const h = hostname.toLowerCase();
  return h === "sneat.games" || h.endsWith(".sneat.games");
}

/** True on a local dev/preview machine (localhost or a loopback IP). */
export function isLocalHost(hostname: string = window.location.hostname): boolean {
  return hostname === "localhost" || hostname.startsWith("127.") || hostname === "[::1]";
}

/** The canonical URL of a game: `https://sneat.games/<slug>/`. */
export function gameUrl(slug: string): string {
  return `${SNEAT_GAMES_ORIGIN}/${encodeURIComponent(slug)}/`;
}

/**
 * The base URL an invite (`#room=<id>`) link should use.
 *
 * On the game's own surface (sneat.games, a `*.sneat.games` host, or a
 * local preview) that is the page the host is on, so a link works wherever
 * the game is served. Off it (CrazyGames, itch.io) the embedding origin is
 * not a working link for anyone else, so it falls back to the canonical
 * `https://sneat.games/<slug>/`.
 */
export function inviteBaseUrl(
  slug: string,
  loc: Pick<Location, "hostname" | "origin" | "pathname"> = window.location,
): string {
  if (isSneatGamesHost(loc.hostname) || isLocalHost(loc.hostname)) {
    return `${loc.origin}${loc.pathname}`;
  }
  return gameUrl(slug);
}

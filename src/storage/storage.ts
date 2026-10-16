// Browser storage on the shared sneat.games origin, and the one-time import
// of saves from the retired `<host>.sneat.games` subdomains.
//
// Since 2026-10 all games share ONE origin (`https://sneat.games/<slug>/`),
// so they share one localStorage. The rule that keeps them from trampling
// each other:
//
//   every key a game writes is game-prefixed (`<gameId>:<name>`, see
//   `gameStorageKey`); only `sneat-games-*` keys are shared on purpose
//   (today just the theme).
//
// The keys that existed before the move are listed verbatim in
// `LEGACY_STORAGE_KEYS`. Two predate the rule (`dnb-stats-v1`,
// `dom-stats-v1`) and keep their names: renaming would need its own
// migration for no benefit, and they collide with nothing.
//
// Migration flow (the landing repo, sneat-games/sneat.games, owns the other
// half): a returning player's old subdomain serves `/__migrate.html`, which
// reads exactly these keys and navigates to
// `https://sneat.games/<slug>/#migrate=<base64url(JSON)>`. The game calls
// `consumeMigratedStorage()` first thing in `bootstrap()`; it writes each
// allowlisted key that is still ABSENT here (a save made on the new origin
// always wins) and strips the parameter from the URL, keeping any `room=`.

/** Theme preference — the one key every game shares deliberately. */
export const THEME_STORAGE_KEY = "sneat-games-theme";

/** The URL-fragment parameter `/__migrate.html` hands saves over in. */
export const MIGRATION_FRAGMENT_PARAM = "migrate";

/**
 * Every localStorage key a game wrote on its old subdomain (verified
 * against each game repo's origin/main, 2026-10-16). Nothing else is
 * imported. Keep in step with `LEGACY_KEYS` in sneat.games'
 * `public/__migrate.html`.
 */
export const LEGACY_STORAGE_KEYS: readonly string[] = [
  THEME_STORAGE_KEY,
  "ultimate-tictactoe:standings:vs-bot",
  "four-in-a-row:standings:vs-bot",
  "gomoku:standings:vs-bot",
  "y:standings:vs-bot",
  "reversi:standings:vs-bot",
  "greed-game:standings:vs-bot",
  "hex:standings:vs-bot",
  "dnb-stats-v1",
  "dom-stats-v1",
];

/** Longest value accepted from a fragment. Real saves are < 100 chars. */
const MAX_VALUE_LENGTH = 4096;

/**
 * The namespaced localStorage key for a game's own data:
 * `gameStorageKey("reversi", "standings:vs-bot")` → `"reversi:standings:vs-bot"`.
 */
export function gameStorageKey(gameId: string, name: string): string {
  if (!gameId || gameId.includes(":")) throw new Error(`invalid gameId: ${JSON.stringify(gameId)}`);
  if (!name) throw new Error("storage key name must not be empty");
  return `${gameId}:${name}`;
}

/** base64url (RFC 4648 §5, unpadded) of a UTF-8 string. */
export function encodeMigrationPayload(saves: Record<string, string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(saves));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Inverse of `encodeMigrationPayload`. Returns null on any malformed input. */
export function decodeMigrationPayload(payload: string): Record<string, string> | null {
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

export interface ConsumeMigratedStorageOptions {
  /** Defaults to `window.location`. */
  location?: Pick<Location, "hash" | "pathname" | "search">;
  /** Defaults to `window.localStorage`. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  /** Defaults to `(url) => history.replaceState(history.state, "", url)`. */
  replaceUrl?: (url: string) => void;
}

/**
 * Import saves handed over by the old subdomain's `/__migrate.html`, once.
 *
 * Returns the keys actually written. Never throws: a broken hand-over must
 * not stop the game from booting. Safe to call on every boot — without a
 * `#migrate=` parameter it does nothing.
 */
export function consumeMigratedStorage(opts: ConsumeMigratedStorageOptions = {}): string[] {
  const loc = opts.location ?? window.location;
  const hash = loc.hash.startsWith("#") ? loc.hash.slice(1) : loc.hash;
  if (!hash) return [];
  const params = new URLSearchParams(hash);
  const payload = params.get(MIGRATION_FRAGMENT_PARAM);
  if (payload === null) return [];

  const written: string[] = [];
  try {
    const storage = opts.storage ?? window.localStorage;
    const saves = decodeMigrationPayload(payload) ?? {};
    for (const key of LEGACY_STORAGE_KEYS) {
      const value = saves[key];
      if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) continue;
      if (storage.getItem(key) !== null) continue; // a save made here wins
      storage.setItem(key, value);
      written.push(key);
    }
    if (written.includes(THEME_STORAGE_KEY) && typeof document !== "undefined") {
      // The pre-paint theme script already ran with nothing stored.
      const theme = saves[THEME_STORAGE_KEY];
      if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {
    console.warn("[storage] migrated saves not imported", e);
  }

  // Strip the parameter even when the import failed, so a reload or a
  // copied link never re-runs it. Other fragment params (`room=`) stay.
  params.delete(MIGRATION_FRAGMENT_PARAM);
  const rest = params.toString();
  const url = `${loc.pathname}${loc.search}${rest ? `#${rest}` : ""}`;
  try {
    (opts.replaceUrl ?? ((u: string) => window.history.replaceState(window.history.state, "", u)))(url);
  } catch (e) {
    console.warn("[storage] could not strip #migrate from the URL", e);
  }
  return written;
}

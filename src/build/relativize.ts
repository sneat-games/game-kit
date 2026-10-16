// Pure string rewrites behind the `sneat-relativize-dist` bin (see
// bin/sneat-relativize-dist.mjs, which does the file I/O). Moved here from
// nine identical per-game copies of `web/scripts/relativize-dist.mjs`.
//
// Why: Astro always emits ROOT-ABSOLUTE URLs for hashed assets
// (`/_astro/...`) and for @vite-pwa/astro's manifest link and icons, and
// neither Astro's `base` nor `vite.base` fixes that cleanly. A game must be
// playable from any directory — `https://sneat.games/<slug>/`, a CrazyGames
// game path, an itch.io bundle, a `file://` open of dist/ — so a postbuild
// pass makes every URL relative.
//
// The service worker needs the same treatment. @vite-pwa/astro defaults
// `navigateFallback` to the site base `/` and precaches `index.html` under
// the URL `/`, so the generated `sw.js` contains `{url:"/"}` and
// `createHandlerBoundToURL("/")`. Served from `/reversi/`, that worker would
// precache and answer every navigation with `https://sneat.games/` — the
// landing page, not the game. Workbox resolves both URLs against the
// worker's own location (`new URL(url, location.href)` in
// PrecacheController), so `./` means "this game's index".

/** `href="/x"` / `src="/x"` → `href="./x"`; leaves `//host` and absolute URLs alone. */
export function relativizeHtml(html: string): string {
  return html.replace(/((?:href|src)=")\/(?!\/)/g, "$1./");
}

/** Make start_url, scope and icon URLs in a web app manifest relative. */
export function relativizeManifest(json: string): string {
  const manifest = JSON.parse(json) as {
    start_url?: unknown;
    scope?: unknown;
    icons?: { src?: unknown }[];
  };
  const rel = (u: string) => (u === "/" ? "." : `./${u.slice(1)}`);
  if (typeof manifest.start_url === "string" && manifest.start_url.startsWith("/")) {
    manifest.start_url = rel(manifest.start_url);
  }
  if (typeof manifest.scope === "string" && manifest.scope.startsWith("/")) {
    manifest.scope = rel(manifest.scope);
  }
  if (Array.isArray(manifest.icons)) {
    for (const icon of manifest.icons) {
      if (typeof icon.src === "string" && icon.src.startsWith("/") && !icon.src.startsWith("//")) {
        icon.src = icon.src.slice(1);
      }
    }
  }
  return JSON.stringify(manifest);
}

/**
 * Point a generated workbox `sw.js` at the game's own directory: every
 * root-absolute precache entry (`url:"/..."`) and navigation fallback
 * (`createHandlerBoundToURL("/...")`) becomes `./...`.
 */
export function relativizeServiceWorker(js: string): string {
  return js
    .replace(/(\burl:\s*")\/(?!\/)/g, "$1./")
    .replace(/(createHandlerBoundToURL\(\s*")\/(?!\/)/g, "$1./");
}

/**
 * Root-absolute references still present in a built file — what the bin
 * fails the build on, so a new Astro/vite-pwa output shape cannot slip a
 * `/` URL past us silently.
 */
export function rootAbsoluteRefs(kind: "html" | "sw", text: string): string[] {
  const re =
    kind === "html"
      ? /(?:href|src)="\/(?!\/)[^"]*"/g
      : /(?:\burl:\s*"\/(?!\/)[^"]*"|createHandlerBoundToURL\(\s*"\/(?!\/)[^"]*"\))/g;
  return text.match(re) ?? [];
}

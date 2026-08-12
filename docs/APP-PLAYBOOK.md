# Building a Sneat game app on the kit — playbook

Read this with [DESIGN.md](DESIGN.md) before building any game's `web/`
app. Everything here is a lesson already paid for by the two reference
apps — **`sneat-games/hex`** (stone placement, connection win, swap
prompt) and **`sneat-games/dots-and-boxes`** (edge input, auction for
control, free-runs). Copy from whichever is closer to your game; do not
reinvent the shell.

## Reference apps

| Your game is… | Copy the structure of |
|---|---|
| place a piece on a cell, win by pattern/connection | `hex/web` |
| pick a line/edge, or a turn with sub-moves | `dots-and-boxes/web` |

Both have: `src/main.ts` (boot + routing + SW + footer), `src/ui/menu.ts`,
`src/ui/board.ts` (+ `board-geometry.ts` in D&B), per-mode session files
(`vs-bot-classic`, `vs-bot-bidding`, `vs-friend*`), `standings.ts`,
`host-worker/`, `.github/workflows/web-ci.yml`, `e2e/*.spec.ts`,
`spec/features/web-app/README.md`.

## Hard-won gotchas — every one of these cost a real debugging session

1. **Installing the kit: use the explicit spec.** `npm install
   "github:sneat-games/game-kit#vX.Y.Z"`. Editing `package.json` by hand
   and running `npm install` silently keeps the OLD kit — the lockfile
   pins the resolved commit SHA, and npm will not re-resolve a git dep
   whose lock entry still satisfies it. Verify after installing:
   `grep -c "<a string from the new version>" node_modules/@sneat/game-kit/dist/theme.css`.
2. **Service worker: `*.sneat.games` ONLY.** Never register on
   `localhost`/`127.*`. The worker precaches built asset hashes, so a
   local preview keeps serving the PREVIOUS build after a rebuild, and a
   landed fix looks broken. (If you ever inherit a stale one:
   `navigator.serviceWorker.getRegistrations()` → `unregister()`, then
   `caches.keys()` → `caches.delete()`.) Also never inside a CG/itch
   iframe.
3. **Set `--board-width` in your board CSS.** The kit's `.match` grid
   sizes its left column from that variable; leave it unset and the game
   log overlaps the board *and intercepts its clicks*.
4. **Do not destroy the board when the match ends.** Tear it down only
   when the NEXT match starts, or the win highlight (drawn at the moment
   the match ends) vanishes before the result banner appears.
5. **Render the invite UI BEFORE awaiting `hostPeer`/`guestPeer`.** Both
   block until the DataChannel is open; await them first and the host
   stares at a blank screen with no room code to share.
6. **Playwright: one dedicated port per repo** (not 4321) plus
   `reuseExistingServer: false` — sibling game apps run concurrently on
   this machine and a shared port silently tests the WRONG app. Prefer
   `workers: 1, retries: 1`: parallel WebRTC + SVG suites produce
   resource-contention timeouts that look like product bugs.
7. **Astro caches aggressively.** After a kit bump: `rm -rf .astro
   node_modules/.vite dist` before rebuilding, or the old CSS/JS is
   rebundled.
8. **A stale dev server lies.** Before concluding "the app auto-plays a
   move" or similar, confirm nothing else is already serving that port
   (`lsof -ti :PORT`) — a leftover server from another repo/build
   produced exactly that false alarm once.
9. **Updates need BOTH sides wired — the worker and the page.** With
   `injectRegister: false`, `registerType: "autoUpdate"` is INERT:
   vite-plugin-pwa implements it in the registration code it did not
   inject, so the generated worker skips waiting only when messaged, and
   nothing messages it. All nine PWA games shipped a bare
   `navigator.serviceWorker.register()`, so every returning player stayed
   frozen on the build they first loaded — two landed fixes reached
   nobody who had already played.

   - **Worker side**, in `astro.config.mjs`'s `workbox` block: set
     `skipWaiting: true` and `clientsClaim: true` explicitly. This is
     what actually rescues an ALREADY-STUCK client, because the browser
     re-fetches `sw.js` by byte comparison on navigation, independently
     of page JS.
   - **Page side**: register via the kit's `registerServiceWorker()`, so
     the running page reloads once when the new worker takes over
     instead of continuing on stale JS.

   Both are required, and the order matters for a fleet already in the
   wild: a page-side-only fix cannot reach a stuck client, because the
   fix ships inside the very JS the old worker refuses to stop serving.
   Verify after any deploy that the LIVE page runs the new bundle, not
   merely that the server offers it (see the release check below).

## Non-negotiables (all games)

- Both variants (classic + bidding) × both modes (vs Bot + vs Friend).
- Kit theme + `createThemeToggle()`, pre-paint inline theme script in
  `Layout.astro` (no flash of wrong theme), per-game `--accent`.
- `createGamesFooter({ current: "<gameId>" })` in the footer.
- Standings preview panel (REAL local vs-bot W/L from localStorage +
  mocked ladder badged "Powered by Competios — coming soon").
- PWA (`@vite-pwa/astro`) + committed 192/512 icons; SW gated per (2).
- `host-worker/` per BTTT (`<game>-game`, custom domain) — build
  it, do NOT deploy.
- Relative-path `dist/` so the same build zips for CrazyGames/itch.io
  (D&B's `scripts/relativize-dist.mjs` is the working solution).
- SpecScore `spec/features/web-app/README.md` authored via the
  `specscore` CLI (`specscore feature new`, then `specscore spec lint`);
  never hand-edit status/frontmatter/index rows.
- Playwright journeys: classic vs bot → terminal screen **→ "Back to
  menu" → the menu is visible again → a NEW match starts**; bidding vs
  bot → terminal screen with conserved balances; PvP across two browser
  contexts against the kit's `test-relay.mjs`; theme toggle persistence.
  **Never end a journey at the terminal banner.** That exact stopping
  point — one click short of the post-match controls — let a dead "Back
  to menu" button ship in EIGHT games at once: every suite asserted the
  banner and stopped, so nobody's `bootstrap` was ever driven past the
  end of a single session. A journey ends where the player's session
  ends, not where the match does.
- `npm run typecheck && lint && test && build && e2e` all green before
  pushing; `git fetch && git merge --ff-only origin/main` first.

## Release check — "deployed" is not "delivered"

`wrangler deploy` succeeding proves the SERVER has the new build. It says
nothing about what a RETURNING player runs, because a service worker
answers from its own precache. After deploying, load the real domain in a
browser that has visited before and assert on the DOM, not the origin:

```js
document.querySelector('script[src]').src        // the hash actually running
navigator.serviceWorker.getRegistrations()       // .waiting must not stay true
```

If the running hash differs from the one `curl https://<host>/` reports,
the update did not land — see gotcha 9. Grepping the served bundle is not
enough on its own either: the cross-promotion registry ships whole and is
filtered at runtime, so a bundle can contain a link the footer never
renders.

## Board rendering house style

Bespoke SVG per game — the board is the game's identity (DESIGN.md
"uniform chrome, unique hearts"). Always: generous invisible hit targets,
hover/focus preview of the move in the mover's colour, last-move marker,
win highlight with the rest dimmed, keyboard-reachable cells with real
aria-labels, everything themed through CSS vars, and all motion behind
`prefers-reduced-motion`.

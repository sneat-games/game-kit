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

## Non-negotiables (all games)

- Both variants (classic + bidding) × both modes (vs Bot + vs Friend).
- Kit theme + `createThemeToggle()`, pre-paint inline theme script in
  `Layout.astro` (no flash of wrong theme), per-game `--accent`.
- `createGamesFooter({ current: "<gameId>" })` in the footer.
- Standings preview panel (REAL local vs-bot W/L from localStorage +
  mocked ladder badged "Powered by Competios — coming soon").
- PWA (`@vite-pwa/astro`) + committed 192/512 icons; SW gated per (2).
- `host-worker/` per BTTT (`<game>-sneat-games`, custom domain) — build
  it, do NOT deploy.
- Relative-path `dist/` so the same build zips for CrazyGames/itch.io
  (D&B's `scripts/relativize-dist.mjs` is the working solution).
- SpecScore `spec/features/web-app/README.md` authored via the
  `specscore` CLI (`specscore feature new`, then `specscore spec lint`);
  never hand-edit status/frontmatter/index rows.
- Playwright journeys: classic vs bot → terminal screen; bidding vs bot →
  terminal screen with conserved balances; PvP across two browser
  contexts against the kit's `test-relay.mjs`; theme toggle persistence.
- `npm run typecheck && lint && test && build && e2e` all green before
  pushing; `git fetch && git merge --ff-only origin/main` first.

## Board rendering house style

Bespoke SVG per game — the board is the game's identity (DESIGN.md
"uniform chrome, unique hearts"). Always: generous invisible hit targets,
hover/focus preview of the move in the mover's colour, last-move marker,
win highlight with the rest dimmed, keyboard-reachable cells with real
aria-labels, everything themed through CSS vars, and all motion behind
`prefers-reduced-motion`.

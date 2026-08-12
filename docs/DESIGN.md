# Sneat Games web kit — cross-game architecture

Design of `@sneat/game-kit` and the two new games built on it
(`sneat-games/dots-and-boxes`, `sneat-games/hex`), plus the UI uplift of
`sneat-games/bidding-tictactoe` (BTTT). Decided with the founder on
2026-08-12.

## Goals

- Two new HTML games, each in its own **private** repo, deployed to
  `dots-and-boxes.sneat.games` and `hex.sneat.games` (Cloudflare Workers,
  BTTT host-worker pattern).
- Each game supports **classic** and **bidding** modes, **vs Bot** (simple
  bot) and **vs Friend** (WebRTC, BTTT pattern) — MVP.
- Maximum code reuse across BTTT / D&B / Hex via this **public MIT** kit,
  extracted from BTTT's battle-tested vanilla TS (founder owns BTTT
  copyright; BTTT itself is GPL-3.0 — relicensing own code is fine).
- Beautiful, unique UI; **dark & light themes with a toggle**; borrow ideas
  from dotsandboxes.org / playhex.org but do better.
- Future: ongoing leaderboard powered by `sneat-co/competios`
  (design-only now — see §9).
- All games listed on the `sneat.games` landing page.

## Founder decisions (2026-08-12)

1. **Vanilla TS kit** — no framework (Vue considered, declined: extraction
   beats rewrite; boards are bespoke SVG anyway).
2. **D&B bidding rule: auction-for-control** — the auction winner CHOOSES
   who must draw the next edge (self or opponent). See §6.
3. Kit repo **public**, games **private**.
4. Hex classic includes the **swap (pie) rule**; bidding mode has no swap.
5. **Playwright** for e2e, never Cypress.
6. Do NOT fork PlayHex (AGPL, heavy Vue+Node+MySQL stack, no bidding).
7. Deploys to `*.sneat.games` subdomains; shared signaling relay
   `webrtc.sneat.games` (repo `sneat-games/webrtc-relay`) — new games use
   it with `gameId` = `dots-and-boxes` / `hex`; BTTT migrates later.

## Repos & deployment

| Repo | Visibility | Deploys to | Worker name |
|---|---|---|---|
| `game-kit` | public (MIT) | npm git-dep only | — |
| `dots-and-boxes` | private | dots-and-boxes.sneat.games | `dots-and-boxes-sneat-games` |
| `hex` | private | hex.sneat.games | `hex-sneat-games` |
| `bidding-tictactoe` | public (GPL-3.0) | bidding-tictactoe.sneat.games | existing |
| `webrtc-relay` | public | webrtc.sneat.games | existing, shared |
| `sneat.games` | public | sneat.games | existing landing |

Games consume the kit as an npm git dependency pinned to a tag:
`"@sneat/game-kit": "github:sneat-games/game-kit#v0.x.y"`. The kit builds
on install via `prepare` (tsc → `dist/` ESM + d.ts); `theme.css` is
exported as a plain CSS file.

## Kit modules (`src/`)

- `auction/` — the generic hidden-bid core, extracted from `btttplay`:
  budgets `[number, number]`, **first-price transfer** (winner pays own bid
  to loser; total conserved), **alternating tie-break** (`tieToFirst`
  flips on every tied turn). `resolveAuction(state, bidA, bidB) →
  { winner: 0|1, tieBreak, next }` + validation errors mirroring BTTT
  (`BidNegativeError`, `BidExceedsBudgetError`). Board placement stays in
  each game's engine.
- `clock/` — `startCountdown` (wall-clock driven), `stallBid`, deadline
  constants (`LATE_BID_MS` 10s, `VS_BOT_LATE_BID_MS` 20s, `STALL_MS` 30s).
  Self-enforced: a client only ever auto-submits its OWN move.
- `pvp/` — `room.ts` (6-char code from `A-HJ-NP-Z2-9`, `/reserve` on the
  shared relay, `gameId`-namespaced), `peer.ts` (WebRTC handshake via
  relay, `PeerHandle`, generic `WireMessage<M>`), `commit-reveal.ts`
  (sha256 + salt over an opaque payload string — games choose what is
  public at commit time), `turn-inbox.ts` (per-turn buffer).
- `ui/` — `theme.ts` (dark/light/system, localStorage, toggle button),
  `theme.css` (design tokens, both palettes, base components: cards,
  buttons, bars, badges, menu, match grid), `bid-input`, `bid-panel`,
  `balances`, `score-card` (classic-mode counterpart of balances),
  `game-log` (generic entries; games supply nodes), `confirm-button`,
  `match-shell` (the 2×2 grid with a game-owned board slot), `menu`
  (mode/size/variant select).
- No CrazyGames code in the kit — BTTT keeps its own wrapper.
- `ui/games-footer.ts` — cross-promotion (founder, 2026-08-12): every
  game shows a compact "More from Sneat Games" footer strip linking the
  OTHER games + the sneat.games landing. The registry of games (id,
  title, emoji, url) lives in the kit as the single source of truth;
  the component takes the current game's id and renders the rest.

## Design system (`theme.css`)

- Tokens on `:root` (light) + `[data-theme="dark"]`; default follows
  `prefers-color-scheme`; toggle persists to
  `localStorage["sneat-games-theme"]`.
- Neutral slate ramp. Per-game accent: BTTT indigo `#4f46e5`, D&B amber
  `#f59e0b`, Hex teal `#0891b2` (game sets `--accent`).
- Player colours consistent across games: P1 emerald, P2 rose — always
  paired with a non-colour channel (glyph/pattern/label) for a11y.
- Typography: self-hosted variable font **Outfit** for display, system
  stack for body. Rounded radii (12/8), soft borders + subtle shadows.
- Micro-interactions: edge-draw, box-fill pop, stone drop, win-path glow;
  all gated by `prefers-reduced-motion`.

## PvP protocol v1

Transport = WebRTC DataChannel; signaling via shared relay
(`/signal/{gameId}/{roomId}/{role}/{type}`). Messages:

- `hello` (host→guest): `{ game, protocol: 1, config }` where config =
  `{ mode: "classic"|"bidding", size, budget? }`. Guest replies
  `hello-ack` or refuses on mismatch. Host is P1.
- Classic: `{ kind: "move", turn, move }` — plain moves (swap is a move).
- Bidding (Hex, BTTT-style pace): commit `{ turn, hash }` / reveal
  `{ turn, bid, move, salt }` — move fully hidden until reveal
  (improvement over BTTT, which exposes the target cell at commit).
- Bidding (D&B, auction-for-control): commit/reveal carry the **bid
  only**; then the winner sends `{ kind: "assign", turn, mover: 0|1 }`;
  the mover sends `move` messages (free-run continues after each
  completed box) until a non-completing edge ends the turn.
- `rematch-request` / `rematch-accept` / `leave` as in BTTT.
- Timeouts: same self-enforced clocks as BTTT for bids; assignment
  auto-defaults to "self" after 10s; placement clock 15s auto-plays the
  bot picker's move. A silent peer for 45s abandons the match (never
  auto-resolved).

## Game rules

### Dots & Boxes (grid = boxes `3×3 | 5×5 | 7×7`, default 5×5)

Classic: draw one edge per turn; completing a box scores it and grants
another turn (a double-completion grants one extra turn); board full →
majority wins (odd box counts → no draw).

Bidding (**auction-for-control**, unique to us): both players secretly
bid (first-price transfer). The winner **chooses who must draw the next
edge** — themselves or the opponent. Whoever draws: completing a box
scores for the DRAWER and forces the drawer to draw again (classic chain
rule), then a new auction. Zugzwang becomes an economy: you can pay to
force your opponent to open a chain.

### Hex (size `7 | 9 | 11`, default 11, rhombus)

Classic: P1 connects top↔bottom, P2 left↔right; alternate placement; swap
rule — on move 2, P2 may steal P1's first stone instead of placing. No
draws (a filled Hex board always has a winner).

Bidding: no swap; each turn both commit (bid + cell) BTTT-style; auction
winner places their committed stone. First side to connect wins.

Board orientation is responsive (founder, 2026-08-12): landscape/desktop
renders the standard wide rhombus; **portrait rotates the board 90°** so
the long axis is vertical, with each player's edge colours rotating with
it. The renderer takes an orientation flag from a viewport query and
re-renders on change.

## Distribution: CrazyGames + itch.io (founder, 2026-08-12)

All games are also published to **CrazyGames** and **itch.io** as static
HTML5 zips (BTTT's existing CG pipeline is the template). Consequences:

- The CrazyGames SDK wrapper (BTTT `web/src/crazygames/sdk.ts` — inject
  on demand, only on a CG surface, env-gated, timeout-bounded) moves
  INTO the kit; games call it exactly as BTTT does.
- The game runs on foreign origins there (CG domains, `html.itch.zone`),
  so nothing may assume `*.sneat.games`: the relay base defaults to
  `https://webrtc.sneat.games` on every non-localhost origin
  (localhost/127.* → `http://localhost:8787`); builds use relative asset
  paths; the PWA service worker registers ONLY on `*.sneat.games` (and
  never inside CG/itch iframes).
- Invite links use a per-game `canonicalUrl` (its sneat.games subdomain)
  when the current origin is not `*.sneat.games`, so a host playing on
  itch/CG still hands out a working link; cross-surface PvP works — both
  peers meet at the same relay `gameId`/room regardless of surface.
- Each game's build produces a zippable `dist/` (`npm run build` +
  `zip -r <game>.zip dist/`), and the README documents the CG Developer
  Portal + itch.io (HTML project, "This file will be played in the
  browser") upload steps.

## Offline (founder, 2026-08-12)

Bots run **in the browser** — single-player is fully offline-capable.
Both new games ship as installable PWAs: a service worker
(`@vite-pwa/astro`) precaches the app shell + assets, plus a
`manifest.webmanifest` and icons. The SW registers only on the
production origin (and localhost preview), never in dev. PvP requires
network by nature; the menu shows a friendly offline notice on the
vs-Friend option when `navigator.onLine` is false.

### Reversi (added by founder 2026-08-12; 8×8 standard board)

Web version of the existing Telegram-bot Reversi, living under `web/` in
the existing **public MIT** repo `sneat-games/reversi` (BTTT pattern:
`server-go/revgame` stays the rule-of-record; the TS engine in
`web/src/engine` mirrors it fixture-for-fixture). Deploys to
`reversi.sneat.games` (worker `reversi-sneat-games`), relay gameId
`reversi`, accent green, cross-promo footer entry added.

Classic: standard Reversi/Othello — flips in 8 directions, a player with
no legal move passes, two consecutive passes (or a full board) end the
game, most discs wins (draws possible).

Bidding: both players commit (bid + cell) against the same board
BTTT-style; the auction winner places their disc (their committed move is
always still legal — both committed against the identical position); the
loser's move is discarded, first-price transfer as everywhere. **Pass
handling:** the auction only runs when BOTH players have at least one
legal move; when exactly one player can move, they move for free (no
auction, no payment — there is nothing to compete for); when neither can,
the game ends. Discs decide the winner; budgets are only the control
economy, as in all bidding games.

Bot: faithful TS port of `revgame`'s `SimpleAI` — corner-first greedy
(any corner capture beats all else; otherwise the move maximising own
score; random tie-break among equals). Bid sizing reuses the restrained
BTTT shape (decisive = a corner is takeable or the game ends this move).

Player colours: discs are near-black / near-ivory with visible rims in
both themes; the game overrides `--p1`/`--p2` accordingly so log bars and
balances match the discs (contrast via rims/borders, not hue alone).

## Wave B games (founder approved 2026-08-12)

Five more kit games, same shape as D&B/Hex (private repo, subdomain,
classic + bidding, vs bot + vs friend, PWA, CG/itch, cross-promo):

| Repo | Subdomain / gameId | Accent | Board |
|---|---|---|---|
| `four-in-a-row` | four-in-a-row.sneat.games | blue #2563eb | 7×6 |
| `gomoku` | gomoku.sneat.games | violet #7c3aed | 15×15 |
| `ultimate-tictactoe` | ultimate-tictactoe.sneat.games | pink #db2777 | 9×(3×3) |
| `domineering` | domineering.sneat.games | orange #ea580c | 6×6/8×8/10×10 |
| `y-game` | y.sneat.games / gameId `y` | lime #65a30d | triangle side 9/11/13 |

- **Four in a Row**: gravity drops into columns; 4+ in a line (h/v/diag)
  wins; full board draws. Classic alternates; classic play is solved
  (first player wins) — the bidding mode is the "fair" headline mode.
  Bidding: commit (bid + column) BTTT-style; winner drops.
- **Gomoku**: freestyle rule — five OR MORE in a row wins (documented
  choice; casual convention). No swap2 in classic — bidding is our
  fairness fix. Bidding: commit (bid + cell).
- **Ultimate Tic-Tac-Toe**: move = (local board, cell); you must play in
  the macro cell matching the LAST move's local cell unless that board
  is closed (won or full) → then anywhere open. Winning a local board
  claims its macro cell; a drawn local board counts for neither. Macro
  3-in-a-row wins; when no legal moves remain, most local boards won
  wins, tie = draw. Bidding: commit (bid + move) — the constraint is
  derived from board state so it binds both players identically.
- **Domineering**: P1 places vertical 2×1 dominoes, P2 horizontal.
  Classic alternates; the first player unable to place on their turn
  loses; no draws. Bidding: auction per placement (commit bid +
  placement); a player with no legal placement of their orientation
  LOSES immediately — checked after every placement, and when one
  placement strands both players the non-placer loses. This preserves
  the classic last-to-move-wins spirit under auctions; Domineering is
  the purest tempo game, which is exactly what the auction prices.
- **Y**: triangular board, hex connectivity, rows 1..N (row r has r
  cells); connect ALL THREE sides; corners belong to both adjacent
  sides; a full board always has a winner (Y theorem). Classic has the
  pie rule — and because both players share the same goal, the swap is
  a plain ownership flip, no mirroring (unlike Hex). Bidding: commit
  (bid + cell), no swap.

## Bots (MVP: "simple, random-with-manners")

- D&B: take a completing edge if any; else prefer a safe edge (one that
  does not create a 3-sided box); else random. Bidding: BTTT-style
  restrained sizing (fractions of balance, `opponentBudget + 1` on
  decisive turns when richer); control choice: draw self if a completing
  edge exists, else hand the move over when only unsafe edges remain.
- Hex: uniform random empty cell with a mild centre bias; random swap
  50%. Bidding: BTTT-style sizing (decisive = a winning connection is one
  move away for either side).

## Testing

- Engines: vitest, fixture-style like `btttplay.test.ts` (outcome tables,
  conservation invariants, error cases, swap legality, chain/free-run
  sequences).
- Kit: vitest for auction/clock/commit-reveal/inbox + jsdom for UI bits.
- e2e: **Playwright** per game. Journeys (journey-first): (1) menu → vs
  Bot classic → play to a terminal screen; (2) vs Bot bidding → auction
  flow visible → terminal screen; (3) host ↔ guest full PvP match across
  two browser contexts against a local relay stub (`test-relay.mjs` in
  the kit — an in-process HTTP mimic of webrtc-relay).

## Leaderboard (design-only; NOT in MVP)

Competios today has contests/brackets but **no standings/rating code**;
Glicko-2 "rating pools" exist as Draft specs. UI ships as a designed,
data-stubbed **Standings** screen per game (header trophy button):
rating, W/L, streak, best-win; states for empty/unranked/active. Result
submission will eventually go through a lightweight game→competios path
(to be specified competios-side; the heavyweight bot-provider token flow
is not suitable). No wiring in MVP — screens carry a "preview" badge.

## Delivery plan

Wave 1: kit (this repo) + both engines (in their repos) in parallel.
Wave 2: game apps (Astro, UI, PvP, workers, e2e) + BTTT UI uplift.
Wave 3: sneat.games listing, deploy (needs `wrangler login`), polish.

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

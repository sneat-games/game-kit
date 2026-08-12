# Ongoing leaderboard — UI/UX design (not in MVP)

Design of the competios-powered standings surface every Sneat casual web
game ships as a **preview stub** now and wires up once competios delivers
rating pools. Companion to [DESIGN.md](DESIGN.md) §9; grounded in the
2026-08-12 competios exploration (no standings/rating code exists yet;
Glicko-2 "rating pools" and "Cup standing" are Draft specs; the only
result-ingestion path today is the heavyweight bot-provider token flow,
unsuitable for casual human games).

## Principles

1. **Local first, honest always.** The panel never fakes server data.
   Local vs-bot stats (W/L/draw per variant, streak) are REAL, tracked in
   `localStorage`, useful from day one. The ladder section is explicitly
   badged "Preview — powered by Competios, coming soon" until live.
2. **Anonymous-first, account-at-the-edge** (founder's signup-at-submit
   principle: an account exists to CONNECT PLAYERS). Playing needs no
   account, local stats need no account; joining the cross-player ladder
   is the moment identity appears — one "Join the ladder" action, sign-in
   at submit, progress preserved.
3. **One ladder per (game, variant).** Classic and bidding are different
   skills; a Glicko-2 rating pool keyed by `(gameId:variant, playerId)`
   matches competios's Draft `rating-pools-and-history` spec exactly
   (pool ID = e.g. `hex:bidding`). Cross-game aggregation is a later
   competios projection, not a game concern.
4. **Standings are a projection, not a game surface.** Games submit
   results and render standings; competios owns computation, history and
   tie-breaks. No rating math in game clients, ever.

## Information architecture

Header trophy button (🏆, aria "Standings") → slide-over panel, two tabs:

- **Your stats** (live now): per-variant rows — games, W/L/D, current
  streak (🔥 when ≥3), best win (vs bot tier when tiers exist). A quiet
  "resets if you clear site data; join the ladder to keep them" hint —
  the honest bridge to identity.
- **Ladder** (stub now): top-10 table + "your row" pinned when ranked.
  Columns: rank, player, rating, ±30-day trend sparkline, W/L. States:
  - *Preview* (now): mocked rows at 40% opacity under a centered
    "Powered by Competios — coming soon" card; no fake personal rank.
  - *Empty* (live, no players yet): "Be the first on the <game> ladder"
    + Join CTA.
  - *Unranked* (live, signed out / not joined): real top-10, Join CTA
    where "your row" would be.
  - *Provisional* (< 10 rated games): rating shown as `~1500?` with a
    "provisional — N more games" note (Glicko-2 RD is the source; the
    UI word is "provisional", never a deviation number).
  - *Active*: full row, rank movement chevrons since last visit.
- Post-match hook: the match-over banner gains one line when the ladder
  is live — "Ladder: +12 → 1512 (#8)" for ranked players, or a single
  unobtrusive "Play ranked?" chip for anonymous PvP winners.

## Visual language

Kit tokens only (works in both themes): stat tiles echo competios's
`.stats` pattern (accent left border, bold number, small muted label) so
the eventual competios-hosted cup pages and in-game panels feel related;
rank 1-3 get subtle gold/silver/bronze accents on the rank chip only
(no full-row colouring); the player's own row uses `--accent` at 8%
background. Sparklines are inline SVG, `--p1` for up, `--p2` for down.
Reduced-motion: no sparkline draw animation.

## Data contract (proposal to competios — to be specified there)

Games need a *lightweight* human-results path (the bot-provider
`ExecutionEvent` flow is explicitly unsuitable). Proposed minimum:

- `POST /v1/games/{gameId}/results` — `{variant, mode: "pvp",
  players: [id, id], winner: 0|1|null, playedAt, matchProof?}` with a
  signed game token; PvP-only (vs-bot never rates), both clients submit,
  competios dedupes/reconciles (same pair, same match key) — a
  first-class Idea to file in competios's SpecScore tree when this
  leaves preview. Trust level: casual ("both peers agreed") is enough
  for a casual ladder and is stated on the ladder page.
- `GET /v1/games/{gameId}/pools/{variant}/standings?around={playerId}`
  → top-N + neighbourhood rows, cacheable, unauthenticated.

Identity: Sneat account (Firebase per competios's existing web flow);
the game holds only the opaque `playerId` competios's RosterMember
pattern expects.

## Rollout

1. Now: stub panel in every game (this design, Preview state).
2. Competios ships rating pools (Draft → implemented) + the lightweight
   results path above (needs a competios Idea/Feature — file at that
   point, per prefer-specscore-for-specs).
3. One pilot game (suggest BTTT — public, existing audience) flips
   `LADDER_LIVE`; states Empty→Active exercise; then the rest.

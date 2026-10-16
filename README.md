# @sneat/game-kit

Shared vanilla-TypeScript kit for Sneat turn-based web games
(Bidding Tic-Tac-Toe, Dots & Boxes, Hex): hidden-bid auction core,
turn clocks, WebRTC PvP transport over the shared `webrtc.sneat.games`
relay, commit–reveal protocol, and the Sneat Games design system
(dark & light themes).

See [docs/DESIGN.md](docs/DESIGN.md) for the cross-game architecture.

Consumed as an npm git dependency:

```json
"@sneat/game-kit": "github:sneat-games/game-kit#v0.2.0"
```

Games are served from `https://sneat.games/<slug>/`; see
[docs/DESIGN.md "Hosting"](docs/DESIGN.md) for what that requires
(`sneat-relativize-dist`, page-relative service worker, `inviteBaseUrl`,
`consumeMigratedStorage`).

## Releasing

Bump `version` in `package.json` + `package-lock.json` in a
`chore(release): vX.Y.Z` commit, land it, then tag that commit on main
`vX.Y.Z` and push the tag. There is no auto-tagging here: games pin the
tag (`github:sneat-games/game-kit#vX.Y.Z`), and npm builds `dist/` from
source through the `prepare` script on install.

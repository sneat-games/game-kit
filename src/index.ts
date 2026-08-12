// @sneat/game-kit — public API. Every module below is documented at its own
// definition; this file only decides what is exported. See docs/DESIGN.md
// for the cross-game architecture this kit was extracted for.

export * from "./auction/auction.js";

export * from "./clock/turn-clock.js";

export * from "./pvp/room.js";
export * from "./pvp/peer.js";
export * from "./pvp/commit-reveal.js";
export * from "./pvp/turn-inbox.js";

export * from "./ui/bid-input.js";
export * from "./ui/bid-panel.js";
export * from "./ui/confirm-button.js";
export * from "./ui/balances.js";
export * from "./ui/game-log.js";
export * from "./ui/score-card.js";
export * from "./ui/match-shell.js";
export * from "./ui/menu.js";
export * from "./ui/theme.js";
export * from "./ui/games-footer.js";

export * from "./pwa/service-worker.js";

export * from "./crazygames/sdk.js";

// theme.css and test-relay.mjs are not re-exported here — they are consumed
// directly via the package's "./theme.css" and "./test-relay" exports (see
// package.json), not through JS/TS imports.

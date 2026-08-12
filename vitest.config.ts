import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
    globals: true,
    // Engine-ish modules (auction/clock/pvp) are pure logic and run fine in
    // node; the ui/ modules touch the DOM and need jsdom. Per-file
    // `// @vitest-environment jsdom` annotations exist for exceptions, but
    // this glob covers the whole ui/ directory so individual files don't
    // each need to remember it.
    environment: "node",
    environmentMatchGlobs: [["src/ui/**/*.test.ts", "jsdom"]],
    // src/pwa/*.test.ts carries its own `// @vitest-environment jsdom`
    // annotation — it needs a DOM but is not a ui/ module.
  },
});

// Copies the static assets `tsc` does not touch into dist/, so the published
// package matches the `exports` map in package.json:
//   - theme.css: the design-system stylesheet (the "./theme.css" export).
//   - test-relay.mjs: the in-memory signaling-relay stub games point their
//     Playwright webServer at (the "./test-relay" export). It ships as plain
//     JS with no dependencies and runs directly under node, so there is
//     nothing for tsc to compile — it is copied byte-for-byte.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

for (const [from, to] of [
  ["src/ui/theme.css", "dist/theme.css"],
  ["src/test-relay.mjs", "dist/test-relay.mjs"],
]) {
  copyFileSync(join(root, from), join(root, to));
  console.log(`copied ${from} -> ${to}`);
}

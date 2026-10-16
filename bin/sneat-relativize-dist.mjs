#!/usr/bin/env node
// sneat-relativize-dist [distDir=dist]
//
// Postbuild pass every game runs after `astro build` so its dist/ works from
// any directory (https://sneat.games/<slug>/, CrazyGames, itch.io, file://).
// The rewrites themselves are pure functions in src/build/relativize.ts
// (unit-tested there); this file only walks the files.
//
//   - every *.html: root-absolute href/src → relative
//   - manifest.webmanifest: start_url/scope/icons → relative
//   - sw.js: precache `url:"/"` and `createHandlerBoundToURL("/")` → "./"
//
// It then FAILS the build if any root-absolute reference survived, so a new
// Astro or vite-pwa output shape cannot quietly ship a game that serves the
// sneat.games landing page from its own service worker.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  relativizeHtml,
  relativizeManifest,
  relativizeServiceWorker,
  rootAbsoluteRefs,
} from "../dist/build/relativize.js";

const dist = resolve(process.argv[2] ?? "dist");
if (!existsSync(dist)) {
  console.error(`sneat-relativize-dist: ${dist} does not exist — run \`astro build\` first`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const problems = [];
for (const file of walk(dist)) {
  const rel = relative(dist, file);
  if (file.endsWith(".html")) {
    const after = relativizeHtml(readFileSync(file, "utf8"));
    writeFileSync(file, after);
    for (const ref of rootAbsoluteRefs("html", after)) problems.push(`${rel}: ${ref}`);
    console.log(`sneat-relativize-dist: ${rel}`);
  } else if (rel === "manifest.webmanifest") {
    writeFileSync(file, relativizeManifest(readFileSync(file, "utf8")));
    console.log(`sneat-relativize-dist: ${rel}`);
  } else if (rel === "sw.js") {
    const after = relativizeServiceWorker(readFileSync(file, "utf8"));
    writeFileSync(file, after);
    for (const ref of rootAbsoluteRefs("sw", after)) problems.push(`${rel}: ${ref}`);
    console.log(`sneat-relativize-dist: ${rel}`);
  }
}

if (problems.length) {
  console.error("sneat-relativize-dist: root-absolute references survived:\n  " + problems.join("\n  "));
  process.exit(1);
}

import { describe, it, expect } from "vitest";
import { relativizeHtml, relativizeManifest, relativizeServiceWorker, rootAbsoluteRefs } from "./relativize.js";

// A trimmed copy of the sw.js @vite-pwa/astro generated for reversi
// (origin/main 844df48, built 2026-10-16).
const GENERATED_SW =
  'define(["./workbox-9c191d2f"],function(e){"use strict";self.skipWaiting(),e.clientsClaim(),' +
  'e.precacheAndRoute([{url:"manifest.webmanifest",revision:"f0"},{url:"/",revision:"ea"},' +
  '{url:"_astro/index.CSIXNgDW.css",revision:null}],{directoryIndex:"index.html"}),' +
  'e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/")))});';

describe("relativizeHtml", () => {
  it("rewrites root-absolute href/src only", () => {
    const html =
      '<link href="/_astro/a.css"><script src="/_astro/b.js"></script>' +
      '<link href="//cdn.example/x"><a href="https://sneat.games/">x</a><img src="./ok.png">';
    expect(relativizeHtml(html)).toBe(
      '<link href="./_astro/a.css"><script src="./_astro/b.js"></script>' +
        '<link href="//cdn.example/x"><a href="https://sneat.games/">x</a><img src="./ok.png">',
    );
  });
});

describe("relativizeManifest", () => {
  it("makes start_url, scope and icons relative", () => {
    const out = JSON.parse(
      relativizeManifest(
        JSON.stringify({
          start_url: "/",
          scope: "/app/",
          icons: [{ src: "/icons/a.png" }, { src: "//cdn/x.png" }, { src: "rel.png" }, {}],
        }),
      ),
    );
    expect(out).toEqual({
      start_url: ".",
      scope: "./app/",
      icons: [{ src: "icons/a.png" }, { src: "//cdn/x.png" }, { src: "rel.png" }, {}],
    });
  });

  it("leaves already-relative and missing fields alone", () => {
    expect(JSON.parse(relativizeManifest(JSON.stringify({ start_url: "." })))).toEqual({ start_url: "." });
  });
});

describe("relativizeServiceWorker", () => {
  it("points the precached index and the navigation fallback at the game's own directory", () => {
    const out = relativizeServiceWorker(GENERATED_SW);
    expect(out).toContain('{url:"./",revision:"ea"}');
    expect(out).toContain('createHandlerBoundToURL("./")');
    expect(out).toContain('{url:"manifest.webmanifest"');
    expect(rootAbsoluteRefs("sw", out)).toEqual([]);
  });

  it("is idempotent", () => {
    const once = relativizeServiceWorker(GENERATED_SW);
    expect(relativizeServiceWorker(once)).toBe(once);
  });
});

describe("rootAbsoluteRefs", () => {
  it("finds what the rewrites must remove", () => {
    expect(rootAbsoluteRefs("sw", GENERATED_SW)).toEqual(['url:"/"', 'createHandlerBoundToURL("/")']);
    expect(rootAbsoluteRefs("html", '<a href="/x"></a><a href="//y"></a>')).toEqual(['href="/x"']);
  });
});

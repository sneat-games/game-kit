// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { gameUrl, inviteBaseUrl, isLocalHost, isSneatGamesHost } from "./host.js";

describe("isSneatGamesHost", () => {
  it.each(["sneat.games", "SNEAT.GAMES", "reversi.sneat.games", "signal.bidding-tictactoe.sneat.games"])(
    "accepts %s",
    (h) => expect(isSneatGamesHost(h)).toBe(true),
  );

  it.each(["localhost", "127.0.0.1", "html.itch.zone", "games.crazygames.com", "evilsneat.games", "sneat.games.evil.com"])(
    "rejects %s",
    (h) => expect(isSneatGamesHost(h)).toBe(false),
  );

  it("reads window.location by default", () => {
    expect(isSneatGamesHost()).toBe(false); // jsdom is localhost
  });
});

describe("isLocalHost", () => {
  it.each(["localhost", "127.0.0.1", "127.1.2.3", "[::1]"])("accepts %s", (h) => expect(isLocalHost(h)).toBe(true));
  it.each(["sneat.games", "html.itch.zone"])("rejects %s", (h) => expect(isLocalHost(h)).toBe(false));
  it("reads window.location by default", () => expect(isLocalHost()).toBe(true));
});

describe("gameUrl", () => {
  it("is the slug directory on the apex", () => {
    expect(gameUrl("reversi")).toBe("https://sneat.games/reversi/");
    expect(gameUrl("y")).toBe("https://sneat.games/y/");
  });
});

describe("inviteBaseUrl", () => {
  const at = (href: string) => {
    const u = new URL(href);
    return { hostname: u.hostname, origin: u.origin, pathname: u.pathname };
  };

  it("keeps the page URL on the apex (the bug: endsWith('.sneat.games') missed it)", () => {
    expect(inviteBaseUrl("reversi", at("https://sneat.games/reversi/"))).toBe("https://sneat.games/reversi/");
  });

  it("keeps the page URL on a legacy subdomain and on localhost", () => {
    expect(inviteBaseUrl("reversi", at("https://reversi.sneat.games/"))).toBe("https://reversi.sneat.games/");
    expect(inviteBaseUrl("reversi", at("http://localhost:4795/"))).toBe("http://localhost:4795/");
  });

  it("falls back to the canonical directory inside a portal iframe", () => {
    expect(inviteBaseUrl("greed", at("https://html.itch.zone/html/123/index.html"))).toBe(
      "https://sneat.games/greed/",
    );
  });

  it("reads window.location by default", () => {
    expect(inviteBaseUrl("hex")).toBe(`${window.location.origin}${window.location.pathname}`);
  });
});

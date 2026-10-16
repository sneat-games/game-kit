// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LEGACY_STORAGE_KEYS,
  THEME_STORAGE_KEY,
  consumeMigratedStorage,
  decodeMigrationPayload,
  encodeMigrationPayload,
  gameStorageKey,
} from "./storage.js";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  window.history.replaceState(null, "", "/");
});

describe("LEGACY_STORAGE_KEYS", () => {
  // The allowlist is a contract with sneat.games' public/__migrate.html and
  // with every game's storage module: changing it is a migration decision,
  // not a refactor. Update both sides together.
  it("is exactly the keys the ten games wrote before the move", () => {
    expect([...LEGACY_STORAGE_KEYS].sort()).toEqual(
      [
        "sneat-games-theme",
        "ultimate-tictactoe:standings:vs-bot",
        "four-in-a-row:standings:vs-bot",
        "gomoku:standings:vs-bot",
        "y:standings:vs-bot",
        "reversi:standings:vs-bot",
        "greed-game:standings:vs-bot",
        "hex:standings:vs-bot",
        "dnb-stats-v1",
        "dom-stats-v1",
      ].sort(),
    );
  });

  it("game-prefixes every key except the shared sneat-games-* ones and the two pre-rule stats keys", () => {
    for (const k of LEGACY_STORAGE_KEYS) {
      expect(k.startsWith("sneat-games-") || k.includes(":") || /^(dnb|dom)-stats-v1$/.test(k)).toBe(true);
    }
  });
});

describe("gameStorageKey", () => {
  it("prefixes with the game id", () => {
    expect(gameStorageKey("reversi", "standings:vs-bot")).toBe("reversi:standings:vs-bot");
  });
  it("rejects ids that would break the namespace", () => {
    expect(() => gameStorageKey("", "x")).toThrow();
    expect(() => gameStorageKey("a:b", "x")).toThrow();
    expect(() => gameStorageKey("a", "")).toThrow();
  });
});

describe("migration payload", () => {
  it("round-trips unicode through base64url with no padding or URL-unsafe chars", () => {
    const saves = { a: "ü✓", b: '{"wins":1}', c: "?>>" };
    const enc = encodeMigrationPayload(saves);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeMigrationPayload(enc)).toEqual(saves);
  });
  it("returns null for garbage, arrays and non-objects", () => {
    expect(decodeMigrationPayload("%%%")).toBeNull();
    expect(decodeMigrationPayload(encodeMigrationPayload([] as unknown as Record<string, string>))).toBeNull();
    expect(decodeMigrationPayload(btoa("42"))).toBeNull();
  });
  it("drops non-string values", () => {
    const enc = btoa(JSON.stringify({ a: "x", b: 1 }));
    expect(decodeMigrationPayload(enc)).toEqual({ a: "x" });
  });
});

describe("consumeMigratedStorage", () => {
  function arrive(hash: string) {
    window.history.replaceState(null, "", `/reversi/${hash}`);
  }

  it("does nothing without a #migrate parameter", () => {
    arrive("#room=ABCDEF");
    expect(consumeMigratedStorage()).toEqual([]);
    expect(window.location.hash).toBe("#room=ABCDEF");
  });

  it("does nothing without any fragment", () => {
    arrive("");
    expect(consumeMigratedStorage()).toEqual([]);
  });

  it("imports allowlisted keys, ignores others, and strips only its own parameter", () => {
    const payload = encodeMigrationPayload({
      "reversi:standings:vs-bot": '{"wins":3,"losses":1,"draws":0}',
      [THEME_STORAGE_KEY]: "dark",
      "evil-key": "x",
    });
    arrive(`#migrate=${payload}&room=ABCDEF`);
    const written = consumeMigratedStorage();
    expect(written.sort()).toEqual(["reversi:standings:vs-bot", THEME_STORAGE_KEY].sort());
    expect(localStorage.getItem("reversi:standings:vs-bot")).toBe('{"wins":3,"losses":1,"draws":0}');
    expect(localStorage.getItem("evil-key")).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.location.pathname).toBe("/reversi/");
    expect(window.location.hash).toBe("#room=ABCDEF");
  });

  it("never overwrites a save already made on the new origin", () => {
    localStorage.setItem("reversi:standings:vs-bot", "new");
    arrive(`#migrate=${encodeMigrationPayload({ "reversi:standings:vs-bot": "old" })}`);
    expect(consumeMigratedStorage()).toEqual([]);
    expect(localStorage.getItem("reversi:standings:vs-bot")).toBe("new");
    expect(window.location.hash).toBe("");
  });

  it("rejects oversized values", () => {
    arrive(`#migrate=${encodeMigrationPayload({ "hex:standings:vs-bot": "x".repeat(5000) })}`);
    expect(consumeMigratedStorage()).toEqual([]);
  });

  it("does not set data-theme for an imported 'system'-like value", () => {
    arrive(`#migrate=${encodeMigrationPayload({ [THEME_STORAGE_KEY]: "weird" })}`);
    expect(consumeMigratedStorage()).toEqual([THEME_STORAGE_KEY]);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("strips a malformed payload without throwing", () => {
    arrive("#migrate=%%%");
    expect(consumeMigratedStorage()).toEqual([]);
    expect(window.location.hash).toBe("");
  });

  it("survives a storage that throws, and a URL rewrite that throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const replaceUrl = vi.fn(() => {
      throw new Error("no history");
    });
    const written = consumeMigratedStorage({
      location: { hash: `#migrate=${encodeMigrationPayload({ "y:standings:vs-bot": "1" })}`, pathname: "/y/", search: "" },
      storage,
      replaceUrl,
    });
    expect(written).toEqual([]);
    expect(replaceUrl).toHaveBeenCalledWith("/y/");
  });

  it("accepts a hash without a leading '#'", () => {
    const replaceUrl = vi.fn();
    consumeMigratedStorage({
      location: { hash: `migrate=${encodeMigrationPayload({ "dnb-stats-v1": "{}" })}`, pathname: "/dots-and-boxes/", search: "?a=1" },
      replaceUrl,
    });
    expect(localStorage.getItem("dnb-stats-v1")).toBe("{}");
    expect(replaceUrl).toHaveBeenCalledWith("/dots-and-boxes/?a=1");
  });
});

// New module (BTTT is dark-only, no theme.ts to port from).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getThemePreference,
  setTheme,
  initTheme,
  getResolvedTheme,
  createThemeToggle,
} from "./theme.js";

/** jsdom does not implement matchMedia; stub it so getResolvedTheme's
 *  system-fallback branch is testable. */
function stubMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("dark") ? prefersDark : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: originalMatchMedia });
});

describe("getThemePreference", () => {
  it("defaults to 'system' when nothing is stored", () => {
    expect(getThemePreference()).toBe("system");
  });

  it("reads back a stored 'light' or 'dark'", () => {
    localStorage.setItem("sneat-games-theme", "dark");
    expect(getThemePreference()).toBe("dark");
    localStorage.setItem("sneat-games-theme", "light");
    expect(getThemePreference()).toBe("light");
  });

  it("treats a garbage stored value as 'system'", () => {
    localStorage.setItem("sneat-games-theme", "purple");
    expect(getThemePreference()).toBe("system");
  });
});

describe("setTheme", () => {
  it("sets data-theme and persists an explicit choice", () => {
    setTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("sneat-games-theme")).toBe("dark");

    setTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("sneat-games-theme")).toBe("light");
  });

  it("clears the attribute and storage for 'system'", () => {
    setTheme("dark");
    setTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("sneat-games-theme")).toBeNull();
  });
});

describe("initTheme", () => {
  it("applies whatever preference was already stored", () => {
    localStorage.setItem("sneat-games-theme", "dark");
    initTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("leaves data-theme unset for 'system'", () => {
    initTheme();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("getResolvedTheme", () => {
  it("returns the explicit data-theme when one is set, regardless of OS preference", () => {
    stubMatchMedia(true);
    setTheme("light");
    expect(getResolvedTheme()).toBe("light");
  });

  it("falls back to prefers-color-scheme when no explicit choice is set", () => {
    stubMatchMedia(true);
    expect(getResolvedTheme()).toBe("dark");
    stubMatchMedia(false);
    expect(getResolvedTheme()).toBe("light");
  });
});

describe("createThemeToggle", () => {
  it("labels itself for the theme a click would switch TO", () => {
    stubMatchMedia(false); // resolves light
    const t = createThemeToggle();
    expect(t.el.dataset.theme).toBe("light");
    expect(t.el.getAttribute("aria-label")).toBe("Switch to dark theme");
  });

  it("cycles and persists on click, moving away from system on the first click", () => {
    stubMatchMedia(false); // system currently resolves light
    const t = createThemeToggle();
    t.el.click();
    expect(getThemePreference()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(t.el.dataset.theme).toBe("dark");
    expect(t.el.getAttribute("aria-label")).toBe("Switch to light theme");

    t.el.click();
    expect(getThemePreference()).toBe("light");
    expect(t.el.dataset.theme).toBe("light");
  });

  it("is a real <button> with an accessible label from the start", () => {
    stubMatchMedia(true);
    const t = createThemeToggle();
    expect(t.el.tagName).toBe("BUTTON");
    expect(t.el.getAttribute("aria-label")).toBeTruthy();
    expect(t.el.className).toBe("theme-toggle");
  });
});

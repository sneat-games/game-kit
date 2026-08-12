// Dark/light/system theming. New in this kit — BTTT is dark-only.
//
// The stored preference is one of "light" | "dark" | (unset, meaning
// "system"). An explicit choice sets `data-theme` on `<html>`, which wins
// outright in theme.css (both the plain `[data-theme="dark"]` block and the
// `prefers-color-scheme` media query, which is scoped with
// `:not([data-theme="light"])` so an explicit light choice overrides a dark
// OS preference too). "System" removes the attribute entirely and lets the
// media query alone decide — this is the only representation of "system":
// there is no `data-theme="system"` value written anywhere.

const STORAGE_KEY = "sneat-games-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** The stored preference, or "system" if nothing valid is stored. */
export function getThemePreference(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/** Apply and persist a theme preference. "system" clears any explicit
 *  override and any localStorage entry; "light"/"dark" sets `data-theme`
 *  on `<html>` and is remembered across visits. */
export function setTheme(pref: ThemePreference): void {
  if (pref === "system") {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute("data-theme");
  } else {
    localStorage.setItem(STORAGE_KEY, pref);
    document.documentElement.setAttribute("data-theme", pref);
  }
}

/** Apply whatever preference is already stored. Call once at startup —
 *  ideally before first paint (a small inline script in the page's <head>)
 *  — to avoid a flash of the wrong theme. */
export function initTheme(): void {
  setTheme(getThemePreference());
}

/** The theme actually in effect right now: the explicit `data-theme` choice
 *  if one is set, else whatever `prefers-color-scheme` currently resolves
 *  to. */
export function getResolvedTheme(): ResolvedTheme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export interface ThemeToggle {
  el: HTMLButtonElement;
}

const SUN_ICON =
  '<svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></g></svg>';
const MOON_ICON =
  '<svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" fill="currentColor"/></svg>';

/**
 * A button that shows the icon for the theme it will switch TO (moon while
 * light, sun while dark — see theme.css's `.theme-toggle[data-theme=...]`
 * rules) and cycles light<->dark on click. Starting from "system", the
 * first click moves to whichever of light/dark is NOT the current resolved
 * theme, so the click always visibly changes something even though
 * "system" itself is never one of the two states a click lands on.
 */
export function createThemeToggle(): ThemeToggle {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "theme-toggle";
  el.innerHTML = SUN_ICON + MOON_ICON;

  function render() {
    const resolved = getResolvedTheme();
    el.dataset.theme = resolved;
    el.setAttribute("aria-label", resolved === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  render();

  el.addEventListener("click", () => {
    const next: ResolvedTheme = getResolvedTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    render();
  });

  return { el };
}

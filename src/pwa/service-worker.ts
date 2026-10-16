// Service-worker registration that actually DELIVERS updates.
//
// Why this module exists (2026-08-13, found in production on all nine PWA
// games at once): every app registered the built worker with a bare
// `navigator.serviceWorker.register("/sw.js")`. That looks complete, and the
// Astro config even says `registerType: "autoUpdate"` — but with
// `injectRegister: false` that option is INERT. vite-plugin-pwa implements
// "autoUpdate" inside the registration code it would otherwise inject: the
// generated worker only ever calls `skipWaiting()` in response to a
// `{type:"SKIP_WAITING"}` message, and it sets no `clientsClaim`. Nobody
// sent that message, so the new worker installed, parked in `waiting`, and
// the OLD precache kept serving the OLD `index.html` — which points at the
// OLD hashed JS.
//
// The visible symptom: a returning player stays frozen on whatever build
// they first loaded, forever, no matter how many times we deploy. They only
// move forward by closing every tab of the origin (which is what finally
// releases a waiting worker). Two shipped fixes — the dead "Back to menu"
// button and the cross-promotion footer — could not reach anyone who had
// already played.
//
// The flow below is the standard workbox update dance, written out because
// we register by hand (we deliberately gate on hostname, see `defaultGate`):
//
//   register -> "updatefound" -> new worker reaches "installed"
//     -> a controller already exists?  => this is an UPDATE, not a first
//        install, so tell the waiting worker to take over
//     -> worker activates -> "controllerchange" -> reload ONCE
//
// The controller check is what keeps a first-time visit from reloading
// itself pointlessly, and `reloading` is what keeps a reload from looping.

import { isSneatGamesHost } from "./host.js";

export interface RegisterServiceWorkerOptions {
  /**
   * Worker script URL. Defaults to `sw.js` resolved against the page
   * (`document.baseURI`), i.e. the game's OWN built worker in its own
   * directory: `/reversi/sw.js` at `https://sneat.games/reversi/`.
   *
   * Never the site root: since the games moved under sneat.games/<slug>/,
   * the root `/sw.js` belongs to the landing (a kill switch for the retired
   * subdomains), and a worker registered there would control every game.
   */
  scriptUrl?: string;
  /**
   * Registration scope. Defaults to the page's own directory (`./` against
   * `document.baseURI`), so each game's worker controls only `/<slug>/`.
   */
  scope?: string;
  /**
   * Whether to register at all. Defaults to "sneat.games or *.sneat.games
   * only" (see `isSneatGamesHost`) — never in
   * a CrazyGames/itch.io iframe, and deliberately never on localhost, where
   * a precaching worker keeps serving the PREVIOUS build after a rebuild and
   * makes a landed fix look broken (APP-PLAYBOOK gotcha 2).
   */
  shouldRegister?: () => boolean;
  /**
   * Called once the updated worker has taken control. Defaults to a full
   * reload, which is the only reset guaranteed to pick up new HTML, CSS and
   * JS together. Pass your own to show a "new version — refresh?" prompt
   * instead of reloading under the player's fingers mid-match.
   */
  onUpdateApplied?: () => void;
}

function defaultGate(): boolean {
  return isSneatGamesHost(window.location.hostname);
}

/**
 * True when a registration would take over the apex's root scope. That
 * happens only when a game page is opened without its trailing slash
 * (`/reversi` instead of `/reversi/`), which makes `./` resolve to `/`.
 * The static host redirects those URLs, but if one slips through we would
 * rather skip offline mode than let one game's worker control the landing
 * and every other game.
 */
function claimsApexRoot(scope: string): boolean {
  const u = new URL(scope, document.baseURI);
  return u.hostname === "sneat.games" && u.pathname === "/";
}

/**
 * Register the built service worker and keep it up to date.
 *
 * Returns the registration, or `null` when the gate said no or the browser
 * has no service-worker support. Never throws: a PWA feature failing must
 * not take the game down with it.
 */
export async function registerServiceWorker(
  opts: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  const gate = opts.shouldRegister ?? defaultGate;
  if (!gate()) return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  const container = navigator.serviceWorker;

  // Reload exactly once, when a worker WE promoted takes over. Scoped to
  // this call rather than module state so a second registration (or a test)
  // starts clean.
  let reloading = false;
  const onControllerChange = () => {
    if (reloading) return;
    reloading = true;
    (opts.onUpdateApplied ?? (() => window.location.reload()))();
  };

  try {
    const scriptUrl = opts.scriptUrl ?? new URL("sw.js", document.baseURI).href;
    const scope = opts.scope ?? new URL("./", document.baseURI).href;
    if (claimsApexRoot(scope)) {
      console.warn("[pwa] not registering a game service worker at the sneat.games root scope");
      return null;
    }
    const registration = await container.register(scriptUrl, { scope });

    // Only listen once we know registration succeeded, so a failed register
    // leaves no stray listener behind.
    container.addEventListener("controllerchange", onControllerChange);

    // A worker left waiting by an earlier visit: promote it now. Without
    // this, the very players most affected — returning ones — would need
    // yet another visit before the update took.
    if (registration.waiting && container.controller) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // `controller` is null on a first-ever install; reloading then would
        // be a pointless flash on a page that is already current.
        if (installing.state === "installed" && container.controller) {
          installing.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    return registration;
  } catch (e) {
    console.warn("[pwa] service worker registration failed", e);
    return null;
  }
}

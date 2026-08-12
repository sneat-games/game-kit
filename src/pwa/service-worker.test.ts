// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerServiceWorker } from "./service-worker.js";

/** A ServiceWorker stand-in that records what was posted to it. */
class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
  posted: unknown[] = [];
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  /** Drive the lifecycle the way the browser does. */
  advanceTo(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  /** Simulate the browser finding a new worker at `sw.js`. */
  findUpdate(worker: FakeWorker) {
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }
}

class FakeContainer extends EventTarget {
  controller: unknown = null;
  registration = new FakeRegistration();
  registerError: Error | null = null;
  registerCalls: string[] = [];
  register(url: string) {
    this.registerCalls.push(url);
    if (this.registerError) return Promise.reject(this.registerError);
    return Promise.resolve(this.registration);
  }
  /** The browser event fired when a new worker takes over the page. */
  takeControl() {
    this.dispatchEvent(new Event("controllerchange"));
  }
}

let container: FakeContainer;

function installContainer(c: FakeContainer | undefined) {
  if (c === undefined) {
    // Simulate a browser with no service-worker support at all.
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, "serviceWorker", { value: c, configurable: true });
}

const always = () => true;

beforeEach(() => {
  container = new FakeContainer();
  installContainer(container);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerServiceWorker", () => {
  it("does not register when the gate says no", async () => {
    const reg = await registerServiceWorker({ shouldRegister: () => false });
    expect(reg).toBeNull();
    expect(container.registerCalls).toEqual([]);
  });

  it("gates on *.sneat.games by default, not on localhost", async () => {
    // The default gate reads window.location.hostname; jsdom's default is
    // "localhost", which is exactly the host we must NOT register on
    // (APP-PLAYBOOK gotcha 2: a precaching worker serves the previous build).
    expect(window.location.hostname).toBe("localhost");
    const reg = await registerServiceWorker();
    expect(reg).toBeNull();
    expect(container.registerCalls).toEqual([]);
  });

  it("returns null (and does not throw) when the browser has no support", async () => {
    installContainer(undefined);
    await expect(registerServiceWorker({ shouldRegister: always })).resolves.toBeNull();
  });

  it("returns null (and does not throw) when registration fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    container.registerError = new Error("boom");
    await expect(registerServiceWorker({ shouldRegister: always })).resolves.toBeNull();
  });

  it("registers the default worker URL", async () => {
    await registerServiceWorker({ shouldRegister: always });
    expect(container.registerCalls).toEqual(["/sw.js"]);
  });

  // The regression this module exists for. Before the fix, an updated worker
  // installed and sat in `waiting` forever, so the player kept running the
  // build they first loaded.
  it("promotes an updated worker so it stops waiting", async () => {
    container.controller = {}; // a controller exists => this is an update
    await registerServiceWorker({ shouldRegister: always });

    const next = container.registration.findUpdate(new FakeWorker());
    next.advanceTo("installed");

    expect(next.posted).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it("applies the update exactly once when the new worker takes control", async () => {
    const onUpdateApplied = vi.fn();
    container.controller = {};
    await registerServiceWorker({ shouldRegister: always, onUpdateApplied });

    const next = container.registration.findUpdate(new FakeWorker());
    next.advanceTo("installed");
    container.takeControl();
    container.takeControl(); // a second event must not reload again

    expect(onUpdateApplied).toHaveBeenCalledTimes(1);
  });

  it("does not promote or reload on a first-ever install", async () => {
    const onUpdateApplied = vi.fn();
    container.controller = null; // no controller => nothing to replace
    await registerServiceWorker({ shouldRegister: always, onUpdateApplied });

    const first = container.registration.findUpdate(new FakeWorker());
    first.advanceTo("installed");

    expect(first.posted).toEqual([]);
    expect(onUpdateApplied).not.toHaveBeenCalled();
  });

  it("promotes a worker left waiting by an earlier visit", async () => {
    // The returning player is precisely who was stuck; make sure they are
    // unstuck on this visit rather than the next one.
    const waiting = new FakeWorker();
    waiting.state = "installed";
    container.registration.waiting = waiting;
    container.controller = {};

    await registerServiceWorker({ shouldRegister: always });

    expect(waiting.posted).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it("ignores a waiting worker when nothing is controlling the page yet", async () => {
    const waiting = new FakeWorker();
    container.registration.waiting = waiting;
    container.controller = null;

    await registerServiceWorker({ shouldRegister: always });

    expect(waiting.posted).toEqual([]);
  });

  it("does not react to lifecycle states other than 'installed'", async () => {
    container.controller = {};
    await registerServiceWorker({ shouldRegister: always });

    const next = container.registration.findUpdate(new FakeWorker());
    next.advanceTo("activating");
    next.advanceTo("redundant");

    expect(next.posted).toEqual([]);
  });
});

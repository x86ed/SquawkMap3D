import test from "node:test";
import assert from "node:assert/strict";
import {
  VIEW_MODE_STORAGE_KEY,
  getInitialViewMode,
  getStoredViewMode,
  storeViewMode,
} from "../components/map/viewMode";
import { ViewModeControl } from "../components/map/viewModeControl";

const g = global as unknown as { window?: unknown; document?: unknown };
const ORIGINAL_WINDOW = g.window;
const ORIGINAL_DOCUMENT = g.document;

function stubWindowLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  g.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return store;
}

test.afterEach(() => {
  if (ORIGINAL_WINDOW === undefined) delete g.window;
  else g.window = ORIGINAL_WINDOW;
  if (ORIGINAL_DOCUMENT === undefined) delete g.document;
  else g.document = ORIGINAL_DOCUMENT;
});

test("storage key matches the spec", () => {
  assert.equal(VIEW_MODE_STORAGE_KEY, "squawkmap3d:viewMode");
});

test("getInitialViewMode defaults to 3d when nothing is stored", () => {
  stubWindowLocalStorage();
  assert.equal(getStoredViewMode(), null);
  assert.equal(getInitialViewMode(), "3d");
});

test("getInitialViewMode defaults to 3d for an invalid stored value", () => {
  const store = stubWindowLocalStorage();
  store.set(VIEW_MODE_STORAGE_KEY, "4d");
  assert.equal(getStoredViewMode(), null);
  assert.equal(getInitialViewMode(), "3d");
  store.set(VIEW_MODE_STORAGE_KEY, "2D");
  assert.equal(getInitialViewMode(), "3d");
});

test("storeViewMode then getInitialViewMode round-trips 2d and 3d", () => {
  const store = stubWindowLocalStorage();
  storeViewMode("2d");
  assert.equal(store.get(VIEW_MODE_STORAGE_KEY), "2d");
  assert.equal(getInitialViewMode(), "2d");
  storeViewMode("3d");
  assert.equal(getInitialViewMode(), "3d");
});

test("defaults to 3d without error when window is undefined (SSR)", () => {
  delete g.window;
  assert.equal(getStoredViewMode(), null);
  assert.doesNotThrow(() => storeViewMode("2d"));
  assert.equal(getInitialViewMode(), "3d");
});

test("defaults to 3d without error when localStorage throws", () => {
  const throwing = () => {
    throw new Error("denied");
  };
  g.window = { localStorage: { getItem: throwing, setItem: throwing } };
  assert.equal(getInitialViewMode(), "3d");
  assert.doesNotThrow(() => storeViewMode("2d"));
});

// --- ViewModeControl: minimal DOM stub (no jsdom in this repo) ---

class FakeEl {
  className = "";
  type = "";
  textContent = "";
  title = "";
  children: FakeEl[] = [];
  attrs = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();
  removed = false;
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  appendChild(c: FakeEl) {
    this.children.push(c);
    return c;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  remove() {
    this.removed = true;
  }
  click() {
    (this.listeners.get("click") ?? []).forEach((fn) => fn());
  }
}

function stubDocument(): void {
  g.document = { createElement: () => new FakeEl() };
}

test("ViewModeControl: label shows the current mode, aria-label names the target", () => {
  stubDocument();
  let mode: "2d" | "3d" = "3d";
  const control = new ViewModeControl({ getMode: () => mode, onToggle: () => {} });
  const container = control.onAdd({} as never) as unknown as FakeEl;
  const button = container.children[0];
  assert.match(container.className, /maplibregl-ctrl-group/);
  assert.equal(button.textContent, "3D");
  assert.equal(button.attrs.get("aria-label"), "Switch to 2D view");
  assert.equal(button.title, "Switch to 2D view");

  mode = "2d";
  control.setMode("2d");
  assert.equal(button.textContent, "2D");
  assert.equal(button.attrs.get("aria-label"), "Switch to 3D view");
});

test("ViewModeControl: initial label reflects getMode() (restored 2d)", () => {
  stubDocument();
  const control = new ViewModeControl({ getMode: () => "2d", onToggle: () => {} });
  const button = (control.onAdd({} as never) as unknown as FakeEl).children[0];
  assert.equal(button.textContent, "2D");
});

test("ViewModeControl: click calls onToggle once per click", () => {
  stubDocument();
  let calls = 0;
  const control = new ViewModeControl({ getMode: () => "3d", onToggle: () => calls++ });
  const button = (control.onAdd({} as never) as unknown as FakeEl).children[0];
  button.click();
  button.click();
  assert.equal(calls, 2);
});

test("ViewModeControl: attaches no map listeners (compass untouched) and onRemove cleans up", () => {
  stubDocument();
  const onCalls: string[] = [];
  const map = new Proxy({}, { get: (_t, prop) => () => onCalls.push(String(prop)) });
  const control = new ViewModeControl({ getMode: () => "3d", onToggle: () => {} });
  const container = control.onAdd(map as never) as unknown as FakeEl;
  assert.deepEqual(onCalls, []);
  control.onRemove();
  assert.equal(container.removed, true);
  assert.doesNotThrow(() => control.setMode("2d"));
});

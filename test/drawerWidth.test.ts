import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAWER_WIDTH_STORAGE_KEY,
  clampDrawerWidth,
  readStoredDrawerWidth,
  writeStoredDrawerWidth,
} from "../components/map/drawer/drawerWidth";

test("clampDrawerWidth leaves an in-range width unchanged", () => {
  assert.equal(clampDrawerWidth(500, 1600), 500);
});

test("clampDrawerWidth clamps below the 360px minimum", () => {
  assert.equal(clampDrawerWidth(200, 1600), 360);
});

test("clampDrawerWidth clamps above the 900px cap on a wide viewport", () => {
  assert.equal(clampDrawerWidth(1200, 2000), 900);
});

test("clampDrawerWidth clamps to 90% of viewport width when that's tighter than 900px", () => {
  assert.equal(clampDrawerWidth(800, 700), 630);
});

test("clampDrawerWidth at the desktop breakpoint's edge still allows the full 360-900 range", () => {
  // The resize handle only renders at/above the 641px desktop breakpoint
  // (LayerDrawer.tsx's DESKTOP_MEDIA_QUERY), where 90% of the viewport
  // (~577px) is comfortably above the 360px floor — no conflict in practice.
  assert.equal(clampDrawerWidth(200, 641), 360);
  assert.equal(clampDrawerWidth(900, 641), Math.min(900, 641 * 0.9));
});

// `readStoredDrawerWidth`/`writeStoredDrawerWidth` guard on `typeof window`;
// stub a minimal `window.localStorage` the same way `aircraft.test.ts` stubs
// `global.fetch`, restoring the original afterward.
const ORIGINAL_WINDOW = (global as unknown as { window?: unknown }).window;

function stubWindowLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (global as unknown as { window: unknown }).window = {
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
  if (ORIGINAL_WINDOW === undefined) {
    delete (global as unknown as { window?: unknown }).window;
  } else {
    (global as unknown as { window: unknown }).window = ORIGINAL_WINDOW;
  }
});

test("readStoredDrawerWidth returns null when nothing is stored", () => {
  stubWindowLocalStorage();
  assert.equal(readStoredDrawerWidth(), null);
});

test("writeStoredDrawerWidth then readStoredDrawerWidth round-trips the value", () => {
  const store = stubWindowLocalStorage();
  writeStoredDrawerWidth(620);
  assert.equal(store.get(DRAWER_WIDTH_STORAGE_KEY), "620");
  assert.equal(readStoredDrawerWidth(), 620);
});

test("writeStoredDrawerWidth rounds fractional widths", () => {
  stubWindowLocalStorage();
  writeStoredDrawerWidth(500.7);
  assert.equal(readStoredDrawerWidth(), 501);
});

test("readStoredDrawerWidth returns null for unparsable stored data", () => {
  const store = stubWindowLocalStorage();
  store.set(DRAWER_WIDTH_STORAGE_KEY, "not-a-number");
  assert.equal(readStoredDrawerWidth(), null);
});

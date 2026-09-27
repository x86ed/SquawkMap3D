import test from "node:test";
import assert from "node:assert/strict";
import type { Aircraft } from "../components/map/aircraft";

// Each test re-imports a fresh module instance (module-level manifest state
// would otherwise leak between tests) — mirrors aircraftModelCard.test.ts.
async function freshAircraftModelsModule() {
  return import(`../components/map/aircraftModels.ts?t=${Date.now()}-${Math.random()}`);
}

const ORIGINAL_FETCH = global.fetch;

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

function stubManifest(entries: unknown[]): void {
  global.fetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith("manifest.json")) {
      return { ok: true, json: async () => entries } as unknown as Response;
    }
    return { ok: false } as unknown as Response; // .glb loads — preload swallows the failure
  }) as typeof fetch;
}

function aircraft(overrides: Partial<Aircraft>): Aircraft {
  return { hex: "abc123", ...overrides };
}

test("resolveVariantModelKey narrows to the variant key when vendored", async () => {
  const { loadAircraftModelManifest, resolveModelKey, resolveVariantModelKey } = await freshAircraftModelsModule();
  stubManifest([{ type: "C182", variants: ["FLOATS"] }]);
  await loadAircraftModelManifest();

  const baseKey = resolveModelKey(aircraft({ typeDesignator: "C182" }));
  assert.equal(baseKey, "C182");
  assert.equal(resolveVariantModelKey(baseKey!, "FLOATS"), "C182-FLOATS");
});

test("resolveVariantModelKey falls back to the base key when the variant isn't vendored", async () => {
  const { loadAircraftModelManifest, resolveModelKey, resolveVariantModelKey } = await freshAircraftModelsModule();
  stubManifest([{ type: "C182", variants: ["FLOATS"] }]);
  await loadAircraftModelManifest();

  const baseKey = resolveModelKey(aircraft({ typeDesignator: "C182" }));
  assert.equal(resolveVariantModelKey(baseKey!, "SKIS"), "C182");
});

test("resolveVariantModelKey returns the base key unchanged when no variant is set", async () => {
  const { loadAircraftModelManifest, resolveModelKey, resolveVariantModelKey } = await freshAircraftModelsModule();
  stubManifest([{ type: "C182", variants: ["FLOATS"] }]);
  await loadAircraftModelManifest();

  const baseKey = resolveModelKey(aircraft({ typeDesignator: "C182" }));
  assert.equal(resolveVariantModelKey(baseKey!, undefined), "C182");
});

test("resolveVariantModelKey returns the base key unchanged for a type with no vendored variants at all", async () => {
  const { loadAircraftModelManifest, resolveModelKey, resolveVariantModelKey } = await freshAircraftModelsModule();
  stubManifest([{ type: "B738" }]);
  await loadAircraftModelManifest();

  const baseKey = resolveModelKey(aircraft({ typeDesignator: "B738" }));
  assert.equal(baseKey, "B738");
  assert.equal(resolveVariantModelKey(baseKey!, "FREIGHTER"), "B738");
});

// Regression: an aircraft with no `variant` (the overwhelming majority)
// must resolve to exactly the same key as before this change existed —
// resolveVariantModelKey is a pure pass-through for that case.
test("an aircraft with no variant resolves to the same key with or without resolveVariantModelKey applied", async () => {
  const { loadAircraftModelManifest, resolveModelKey, resolveVariantModelKey } = await freshAircraftModelsModule();
  stubManifest([{ type: "C182", variants: ["FLOATS"] }, { type: "B738" }]);
  await loadAircraftModelManifest();

  for (const typeDesignator of ["C182", "B738"]) {
    const baseKey = resolveModelKey(aircraft({ typeDesignator }));
    assert.equal(resolveVariantModelKey(baseKey!, undefined), baseKey);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  loadAircraftModelManifest,
  isExactModelMatch,
  modelAuthor,
} from "../components/map/aircraftModels";
import { getCompassTrackModel, DEFAULT_COMPASS_MODEL_KEY } from "../components/map/overlay/compassCard/compassTrackModel";

const originalFetch = globalThis.fetch;

/**
 * Loads a fake manifest for this test file's scope only — mirrors real
 * production shape today: `B738` is both the `A3` category's real fallback
 * (`aircraftShapes.ts`'s `CATEGORY_FALLBACK_KEY`) and a real, authored
 * vendored model, exactly the case the "wake-class placeholder shouldn't
 * inherit credit" fix targets.
 */
async function loadFakeManifest(): Promise<void> {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        { type: "B738", author: "squawk-7500" },
        { type: "A319" },
      ]),
      { status: 200 },
    )) as typeof fetch;
  await loadAircraftModelManifest();
  globalThis.fetch = originalFetch;
}

test("isExactModelMatch/modelAuthor: category-fallback vs. exact match", async () => {
  await loadFakeManifest();

  assert.equal(isExactModelMatch("B738"), true);
  assert.equal(isExactModelMatch("A319"), true); // exact match, just no author
  assert.equal(isExactModelMatch("ZZZZ"), false); // not vendored at all
  assert.equal(modelAuthor("B738"), "squawk-7500");
  assert.equal(modelAuthor("A319"), undefined);
});

test("getCompassTrackModel: unmatched type falling back to an authored category placeholder is NOT credited", async () => {
  await loadFakeManifest();

  // Category A3's real fallback key is "B738" (aircraftShapes.ts's
  // CATEGORY_FALLBACK_KEY) — this aircraft's own type isn't vendored at
  // all, so it resolves to B738's model, which DOES have a real author.
  const model = getCompassTrackModel("ZZZZ", "A3", undefined, "unidentified");

  assert.equal(model.modelUrl, "/aircraft-models/B738.glb"); // the fallback model is still shown
  assert.equal(model.modelerName, ""); // but its author is NOT attributed to this aircraft
  assert.equal(model.modelerProfileUrl, "");
});

test("getCompassTrackModel: exact type match with a real author IS credited", async () => {
  await loadFakeManifest();

  const model = getCompassTrackModel("B738", "A3", undefined, "unidentified");

  assert.equal(model.modelerName, "squawk-7500");
  assert.equal(model.modelerProfileUrl, "https://adsb.win/operators/squawk-7500");
});

test("getCompassTrackModel: exact type match with no author is uncredited (not the fallback bug, just genuinely unauthored)", async () => {
  await loadFakeManifest();

  const model = getCompassTrackModel("A319", "A3", undefined, "unidentified");

  assert.equal(model.modelerName, "");
  assert.equal(model.modelerProfileUrl, "");
});

test("getCompassTrackModel: fully unmodeled type resolves to the pinned default, never credited", async () => {
  await loadFakeManifest();

  const model = getCompassTrackModel("ZZZZ", "B9-not-a-real-category", undefined, "unidentified");

  assert.equal(model.modelUrl, `/aircraft-models/${DEFAULT_COMPASS_MODEL_KEY}.glb`);
  assert.equal(model.modelerName, "");
  assert.equal(model.modelerProfileUrl, "");
});

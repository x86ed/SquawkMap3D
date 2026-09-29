import test from "node:test";
import assert from "node:assert/strict";
import {
  loadAircraftModelManifest,
  preloadModelScenegraphs,
  isExactModelMatch,
  modelAuthor,
} from "../components/map/aircraftModels";
import { getCompassTrackModel, DEFAULT_COMPASS_MODEL_KEY } from "../components/map/overlay/compassCard/compassTrackModel";

const originalFetch = globalThis.fetch;

/** Builds a minimal valid `.glb` binary (12-byte header + one JSON chunk,
 * no binary chunk — nothing here reads geometry) carrying `nodes` with
 * whatever `extras` the caller wants, mirroring the real vendored files'
 * shape (`node.extras.authorship.author`, see B38M.glb/generate-aircraft-
 * models-manifest.mjs). Author now comes from parsing the binary itself
 * (aircraftModels.ts's `extractModelExtras`), not from the manifest, so
 * these tests fake the .glb bytes rather than embedding `author` in the
 * fake manifest response. */
function buildFakeGlb(nodes: { name?: string; extras?: unknown }[]): ArrayBuffer {
  const json = { asset: { version: "2.0" }, nodes, scenes: [{ nodes: nodes.map((_, i) => i) }], scene: 0 };
  const jsonStr = JSON.stringify(json);
  const paddedLength = Math.ceil(jsonStr.length / 4) * 4;
  const jsonBytes = Buffer.from(jsonStr.padEnd(paddedLength, " "), "utf8");

  const totalLength = 12 + 8 + jsonBytes.length;
  const buf = Buffer.alloc(totalLength);
  buf.writeUInt32LE(0x46546c67, 0); // magic 'glTF'
  buf.writeUInt32LE(2, 4); // version
  buf.writeUInt32LE(totalLength, 8);
  buf.writeUInt32LE(jsonBytes.length, 12);
  buf.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  jsonBytes.copy(buf, 20);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const FAKE_GLB_BY_TYPE: Record<string, ArrayBuffer> = {
  B738: buildFakeGlb([{ name: "Aircraft visual hull", extras: { authorship: { author: "squawk-7500" } } }]),
  A319: buildFakeGlb([{ name: "Aircraft visual hull" }]),
};

/**
 * Loads a fake manifest + fake vendored `.glb`s for this test file's scope
 * only — mirrors real production shape today: `B738` is both the `A3`
 * category's real fallback (`aircraftShapes.ts`'s `CATEGORY_FALLBACK_KEY`)
 * and a real, authored vendored model, exactly the case the "wake-class
 * placeholder shouldn't inherit credit" fix targets.
 */
async function loadFakeManifest(): Promise<void> {
  const entries = [{ type: "B738" }, { type: "A319" }];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("manifest.json")) return new Response(JSON.stringify(entries), { status: 200 });
    for (const [type, glb] of Object.entries(FAKE_GLB_BY_TYPE)) {
      if (url.endsWith(`${type}.glb`)) return new Response(glb, { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;

  await loadAircraftModelManifest();
  // loadAircraftModelManifest kicks off the scenegraph/extras preload without
  // awaiting it (deliberately, in production — see its doc comment); tests
  // need the extras resolved before asserting, so preload directly here too.
  await preloadModelScenegraphs(entries);
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

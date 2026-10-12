import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORY_FALLBACK_KEY, UNKNOWN_FALLBACK_KEY, shapeKeyCandidates, fetchLiveShape } from "../components/map/aircraftShapes";
import { loadAircraftModelManifest, resolveModelKeyForTypeAndCategory } from "../components/map/aircraftModels";

const MODELS_MANIFEST: { type: string }[] = JSON.parse(
  readFileSync(path.join(process.cwd(), "public", "aircraft-models", "manifest.json"), "utf8"),
);
const originalFetch = globalThis.fetch;

test("special emitter categories map to their dedicated types", () => {
  assert.deepEqual(
    Object.fromEntries(["B3", "B4", "B6", "B7", "C1", "C2", "C3"].map((c) => [c, CATEGORY_FALLBACK_KEY[c]])),
    { B3: "PARA", B4: "ULAC", B6: "VFHC", B7: "FALH", C1: "FIRE", C2: "PTUG", C3: "TURB" },
  );
});

test("every category fallback key and the unknown key has a vendored model", () => {
  const types = new Set(MODELS_MANIFEST.map((m) => m.type));
  for (const key of [...Object.values(CATEGORY_FALLBACK_KEY), UNKNOWN_FALLBACK_KEY]) {
    assert.ok(types.has(key), `${key} missing from public/aircraft-models/manifest.json`);
  }
});

test("shapeKeyCandidates: exact type, then category representative, then unknown", () => {
  assert.deepEqual(shapeKeyCandidates("zzzz", "C2"), ["ZZZZ", "PTUG", "UNKN"]);
  assert.deepEqual(shapeKeyCandidates(undefined, "B3"), ["PARA", "UNKN"]);
  assert.deepEqual(shapeKeyCandidates(undefined, undefined), ["UNKN"]);
  assert.deepEqual(shapeKeyCandidates("B738", "A3"), ["B738", "UNKN"]);
});

test("resolveModelKeyForTypeAndCategory: unknown aircraft resolves to the UNKN model", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify(MODELS_MANIFEST), { status: 200 })) as typeof fetch;
  try {
    await loadAircraftModelManifest();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(resolveModelKeyForTypeAndCategory(undefined, undefined), "UNKN");
  assert.equal(resolveModelKeyForTypeAndCategory("ZZZZ", "B9"), "UNKN");
  assert.equal(resolveModelKeyForTypeAndCategory(undefined, "B3"), "PARA");
  assert.equal(resolveModelKeyForTypeAndCategory("ZZZZ", "C1"), "FIRE");
  assert.equal(resolveModelKeyForTypeAndCategory("ZZZZ", "C2"), "PTUG");
  assert.equal(resolveModelKeyForTypeAndCategory("B738", "A3"), "B738");
});

test("fetchLiveShape: only the exact-type shape carries an author", async () => {
  const files: Record<string, string> = {
    "/aircraft-shapes/B738.svg": '<svg data-author="someone"><path d="M0,0"/></svg>',
    "/aircraft-shapes/PTUG.svg": '<svg data-author="other"><path d="M0,0"/></svg>',
    "/aircraft-shapes/UNKN.svg": '<svg data-generated="true"><path d="M0,0"/></svg>',
  };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const body = files[String(input)];
    return body ? new Response(body, { status: 200 }) : new Response("", { status: 404 });
  }) as typeof fetch;
  try {
    const exact = await fetchLiveShape("B738", "A3");
    assert.equal(exact?.exact, true);
    assert.equal(exact?.author, "someone");

    const byCategory = await fetchLiveShape("ZZZZ", "C2");
    assert.equal(byCategory?.key, "PTUG");
    assert.equal(byCategory?.exact, false);
    assert.equal(byCategory?.author, undefined); // fallback is never credited

    const unknown = await fetchLiveShape(undefined, undefined);
    assert.equal(unknown?.key, "UNKN");
    assert.equal(unknown?.author, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

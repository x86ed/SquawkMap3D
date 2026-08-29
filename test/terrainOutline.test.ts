import test from "node:test";
import assert from "node:assert/strict";
import { fetchTerrainOutline } from "../components/map/terrainOutline";

const originalFeederUrl = process.env.NEXT_PUBLIC_FEEDER_URL;
const originalFetch = globalThis.fetch;

function setFeederUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_FEEDER_URL;
  } else {
    process.env.NEXT_PUBLIC_FEEDER_URL = value;
  }
}

function restore() {
  setFeederUrl(originalFeederUrl);
  globalThis.fetch = originalFetch;
}

test("fetchTerrainOutline parses well-formed rings into closed LineString features with altitudeFt", async () => {
  setFeederUrl("http://feeder.local/data/aircraft.json");
  let requestedUrl: string | undefined;
  globalThis.fetch = (async (url: string) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        rings: [
          {
            alt: 1000,
            points: [
              [40, -80],
              [41, -81],
              [42, -82],
            ],
          },
          {
            alt: 5000,
            points: [
              [40, -80],
              [41, -81],
            ],
          },
        ],
      }),
    };
  }) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.equal(requestedUrl, "/upintheair.json");
    assert.equal(result.type, "FeatureCollection");
    assert.equal(result.features.length, 2);

    const [first, second] = result.features;
    assert.equal(first.geometry.type, "LineString");
    assert.equal(first.properties?.altitudeFt, Math.round(1000 * 3.28084));
    assert.deepEqual(first.geometry.coordinates, [
      [-80, 40],
      [-81, 41],
      [-82, 42],
      [-80, 40],
    ]);

    assert.equal(second.properties?.altitudeFt, Math.round(5000 * 3.28084));
    assert.deepEqual(second.geometry.coordinates, [
      [-80, 40],
      [-81, 41],
      [-80, 40],
    ]);
  } finally {
    restore();
  }
});

test("fetchTerrainOutline returns an empty FeatureCollection and makes no request when no feeder is configured", async () => {
  setFeederUrl(undefined);
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not be called");
  }) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.equal(called, false);
    assert.deepEqual(result, { type: "FeatureCollection", features: [] });
  } finally {
    restore();
  }
});

test("fetchTerrainOutline returns an empty FeatureCollection on a non-OK (404) response, without throwing", async () => {
  setFeederUrl("http://feeder.local/data/aircraft.json");
  globalThis.fetch = (async () => ({
    ok: false,
    status: 404,
    json: async () => {
      throw new Error("should not be parsed");
    },
  })) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.deepEqual(result, { type: "FeatureCollection", features: [] });
  } finally {
    restore();
  }
});

test("fetchTerrainOutline returns an empty FeatureCollection on an unparseable response body, without throwing", async () => {
  setFeederUrl("http://feeder.local/data/aircraft.json");
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  })) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.deepEqual(result, { type: "FeatureCollection", features: [] });
  } finally {
    restore();
  }
});

test("fetchTerrainOutline returns an empty FeatureCollection when rings is missing or empty", async () => {
  setFeederUrl("http://feeder.local/data/aircraft.json");
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({}),
  })) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.deepEqual(result, { type: "FeatureCollection", features: [] });
  } finally {
    restore();
  }
});

test("fetchTerrainOutline skips rings with fewer than 2 source points", async () => {
  setFeederUrl("http://feeder.local/data/aircraft.json");
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      rings: [
        { alt: 1000, points: [[40, -80]] },
        {
          alt: 2000,
          points: [
            [40, -80],
            [41, -81],
          ],
        },
      ],
    }),
  })) as unknown as typeof fetch;

  try {
    const result = await fetchTerrainOutline();
    assert.equal(result.features.length, 1);
    assert.equal(result.features[0].properties?.altitudeFt, Math.round(2000 * 3.28084));
  } finally {
    restore();
  }
});

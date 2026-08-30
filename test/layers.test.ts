import test from "node:test";
import assert from "node:assert/strict";
import {
  addCustomLayers,
  MILITARY_FILL_LAYER_ID,
  MILITARY_LINE_LAYER_ID,
  SUA_FILL_LAYER_ID,
  SUA_LINE_LAYER_ID,
  TERRAIN_OUTLINE_LINE_LAYER_ID,
  RAINVIEWER_LAYER_ID,
  NEXRAD_LAYER_ID,
  NOAA_RADAR_LAYER_ID,
  DWD_RADOLAN_LAYER_ID,
  NOAA_INFRARED_LAYER_ID,
  AIRPORTS_LAYER_ID,
  OPENAIP_LAYER_ID,
  TFR_FILL_LAYER_ID,
  TFR_LINE_LAYER_ID,
  AIRSPACE_BOUNDARIES_LINE_LAYER_ID,
  RANGE_OUTLINE_FILL_LAYER_ID,
  RANGE_OUTLINE_LINE_LAYER_ID,
} from "../components/map/layers";

/** Minimal MapLibreMap fake — just enough surface area for `addCustomLayers`
 * to exercise (source/layer bookkeeping, layout-property reads/writes), same
 * pattern as `test/userLocation.test.ts`. `setMissingStyleImageResolver` and
 * the read/remove variants are stubbed so the airport-icon resolver
 * registration and `refreshRainViewer`'s fire-and-forget follow-up (both
 * exercised as a side effect of `addCustomLayers`) don't throw. */
function makeFakeMap() {
  const sources = new Set<string>();
  const layers = new Map<string, { layout?: Record<string, string> }>();
  return {
    getSource: (id: string) => (sources.has(id) ? {} : undefined),
    addSource: (id: string) => {
      sources.add(id);
    },
    removeSource: (id: string) => {
      sources.delete(id);
    },
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    addLayer: (layer: { id: string; layout?: Record<string, string> }) => {
      layers.set(layer.id, { layout: layer.layout });
    },
    removeLayer: (id: string) => {
      layers.delete(id);
    },
    setLayoutProperty: (id: string, prop: string, value: string) => {
      const layer = layers.get(id);
      if (layer) layer.layout = { ...(layer.layout ?? {}), [prop]: value };
    },
    getLayoutProperty: (id: string, prop: string) => layers.get(id)?.layout?.[prop],
    getStyle: () => undefined,
    setMissingStyleImageResolver: () => {},
    _layers: layers,
  };
}

function visibilityOf(map: ReturnType<typeof makeFakeMap>, id: string) {
  return map._layers.get(id)?.layout?.visibility;
}

test("addCustomLayers defaults the 8 named layers to hidden and leaves the rest visible", () => {
  // Stub an OpenAIP API key so OPENAIP_LAYER_ID's conditional add path runs
  // and its default can be asserted too (it's otherwise skipped entirely
  // when unset, same as NOAA_INFRARED_LAYER_ID below).
  const previousOpenAipKey = process.env.NEXT_PUBLIC_OPENAIP_API_KEY;
  process.env.NEXT_PUBLIC_OPENAIP_API_KEY = "test-key";
  try {
    const map = makeFakeMap();
    addCustomLayers(map as never, "light", {});

    for (const id of [
      MILITARY_FILL_LAYER_ID,
      MILITARY_LINE_LAYER_ID,
      SUA_FILL_LAYER_ID,
      SUA_LINE_LAYER_ID,
      TERRAIN_OUTLINE_LINE_LAYER_ID,
      RAINVIEWER_LAYER_ID,
      NEXRAD_LAYER_ID,
      NOAA_RADAR_LAYER_ID,
      DWD_RADOLAN_LAYER_ID,
    ]) {
      assert.equal(visibilityOf(map, id), "none", `${id} should default hidden`);
    }

    for (const id of [
      AIRPORTS_LAYER_ID,
      OPENAIP_LAYER_ID,
      TFR_FILL_LAYER_ID,
      TFR_LINE_LAYER_ID,
      AIRSPACE_BOUNDARIES_LINE_LAYER_ID,
      RANGE_OUTLINE_FILL_LAYER_ID,
      RANGE_OUTLINE_LINE_LAYER_ID,
    ]) {
      assert.equal(visibilityOf(map, id), "visible", `${id} should default visible`);
    }

    // NOAA_INFRARED_TILE_URL is hardcoded `undefined` in constants.ts (no
    // real tile source wired in yet), so `addCustomLayers` never adds this
    // layer at all regardless of the `noaaInfrared` visibility default —
    // asserting it wasn't added is the closest equivalent of "hidden" this
    // fake map can pin today.
    assert.equal(map.getLayer(NOAA_INFRARED_LAYER_ID), undefined);
  } finally {
    if (previousOpenAipKey === undefined) delete process.env.NEXT_PUBLIC_OPENAIP_API_KEY;
    else process.env.NEXT_PUBLIC_OPENAIP_API_KEY = previousOpenAipKey;
  }
});

test("an explicit visibility override wins over the flipped default, other flipped keys stay hidden", () => {
  const map = makeFakeMap();
  addCustomLayers(map as never, "light", { military: true, rainViewer: true });

  assert.equal(visibilityOf(map, MILITARY_FILL_LAYER_ID), "visible");
  assert.equal(visibilityOf(map, MILITARY_LINE_LAYER_ID), "visible");
  assert.equal(visibilityOf(map, RAINVIEWER_LAYER_ID), "visible");

  for (const id of [
    SUA_FILL_LAYER_ID,
    SUA_LINE_LAYER_ID,
    TERRAIN_OUTLINE_LINE_LAYER_ID,
    NEXRAD_LAYER_ID,
    NOAA_RADAR_LAYER_ID,
    DWD_RADOLAN_LAYER_ID,
  ]) {
    assert.equal(visibilityOf(map, id), "none", `${id} should still default hidden`);
  }
});

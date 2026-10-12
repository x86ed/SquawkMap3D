import test from "node:test";
import assert from "node:assert/strict";
import {
  AIRCRAFT_ICON_GLOW_LAYER_ID,
  AIRCRAFT_ICON_LAYER_ID,
  AIRCRAFT_MODEL_LAYER_ID,
  AIRCRAFT_TRACK_LAYER_ID,
  altitudeToRenderMeters,
  buildAircraftLayers,
} from "../components/map/aircraftLayer";
import type { IconAtlas } from "../components/map/aircraftIcons";
import type { Aircraft } from "../components/map/aircraft";

const ATLAS: IconAtlas = {
  image: "",
  mapping: { generic: { x: 0, y: 0, width: 96, height: 96, anchorX: 48, anchorY: 48, mask: true } },
};

function ac(hex: string, extra: Partial<Aircraft> = {}): Aircraft {
  return { hex, lat: 40, lon: -100, altitude: 3000, track: 45, ...extra } as Aircraft;
}

function layerParams(aircraft: Aircraft[], modelsEnabled: boolean) {
  return {
    aircraft,
    tracks: new Map(),
    iconAtlas: ATLAS,
    colorMode: "altitude" as const,
    tracksVisible: false,
    modelsEnabled,
    onAircraftClick: () => {},
    onAircraftHover: () => {},
  };
}

const dataOf = (layer: { props: unknown }) => (layer.props as { data: Aircraft[] }).data;

test("modelsEnabled=false has no scenegraph layers and every positioned aircraft in the icon layer", () => {
  const list = [
    ac("a1", { typeDesignator: "B738" }),
    ac("a2", { typeDesignator: "A320" }),
    ac("a3", { typeDesignator: "R44", category: "A7" }),
    { hex: "nopos" } as Aircraft,
  ];
  const layers = buildAircraftLayers(layerParams(list, false));
  assert.equal(layers.filter((l) => l.id.startsWith(AIRCRAFT_MODEL_LAYER_ID)).length, 0);
  const icon = layers.find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  assert.deepEqual(dataOf(icon).map((d) => d.hex), ["a1", "a2", "a3"]);
});

test("returns no layers without an atlas", () => {
  assert.deepEqual(buildAircraftLayers({ ...layerParams([ac("a")], false), iconAtlas: null }), []);
});

test("domMarkerIds are absent from the icon layer data but present in the glow layer", () => {
  const list = [ac("a1"), ac("a2"), ac("a3")];
  const layers = buildAircraftLayers({ ...layerParams(list, false), domMarkerIds: new Set(["a1", "a3"]) });
  const icon = layers.find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  const glow = layers.find((l) => l.id === AIRCRAFT_ICON_GLOW_LAYER_ID)!;
  assert.deepEqual(dataOf(icon).map((d) => d.hex), ["a2"]);
  assert.deepEqual(dataOf(glow).map((d) => d.hex), ["a1", "a2", "a3"]);
});

test("no rotor-binding or synthesized rotor layer is produced, with or without bindings", () => {
  const list = [ac("h1", { typeDesignator: "ZZZZ", category: "A7" }), ac("h2", { typeDesignator: "R44" })];
  for (const modelsEnabled of [false, true]) {
    const layers = buildAircraftLayers(layerParams(list, modelsEnabled));
    assert.equal(layers.filter((l) => /rotor/i.test(l.id)).length, 0);
  }
});

test("altitudeToRenderMeters is zero when flat and lifted otherwise", () => {
  assert.ok(altitudeToRenderMeters(30000) > 0);
  assert.equal(altitudeToRenderMeters(30000, true), 0);
});

function zOf(layer: { props: unknown }, d: unknown): number {
  return (layer.props as { getPosition: (d: unknown) => number[] }).getPosition(d)[2];
}

test("icons are lifted by altitude in 3D and flat in 2D", () => {
  const a = ac("a1", { altitude: 30000 });
  const lifted = buildAircraftLayers(layerParams([a], true)).find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  const flat = buildAircraftLayers(layerParams([a], false)).find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  assert.ok(zOf(lifted, a) > 0);
  assert.equal(zOf(flat, a), 0);
});

test("track points are flat in 2D and lifted in 3D", () => {
  const pts = [
    { lat: 40, lon: -100, altitude: 30000, timestamp: Date.now() - 1000 },
    { lat: 40.1, lon: -100, altitude: 30000, timestamp: Date.now() },
  ];
  const a = ac("a1", { altitude: 30000 });
  const tracks = new Map([["a1", pts]]) as never;
  const zs = (modelsEnabled: boolean) => {
    const layer = buildAircraftLayers({ ...layerParams([a], modelsEnabled), tracks, tracksVisible: true }).find(
      (l) => l.id === AIRCRAFT_TRACK_LAYER_ID,
    )!;
    const seg = (layer.props as unknown as { data: { path: number[][] }[] }).data[0];
    return seg.path.map((p) => p[2]);
  };
  assert.ok(zs(true).every((z) => z > 0));
  assert.ok(zs(false).every((z) => z === 0));
});

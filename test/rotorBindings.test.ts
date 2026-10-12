import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  parseRotorBinding,
  parseViewBox,
  pivotToCanvasPixels,
  rotateOffsetByTrack,
  rotorDeckAngle,
  rotorSpinDegrees,
  type RotorAtlasBinding,
} from "../components/map/rotorBindings";
import {
  ROTOR_DEFAULT_RPM,
  ROTOR_DISPLAY_REVS_PER_SECOND,
} from "../components/map/constants";
import {
  AIRCRAFT_ICON_LAYER_ID,
  AIRCRAFT_MODEL_LAYER_ID,
  AIRCRAFT_ROTOR_BINDING_LAYER_ID,
  buildAircraftLayers,
  buildRotorBindingLayer,
  collectRotorInstances,
  altitudeToRenderMeters,
  AIRCRAFT_TRACK_LAYER_ID,
} from "../components/map/aircraftLayer";
import { GENERIC_ICON_KEY, rotorBindingsByType, type IconAtlas } from "../components/map/aircraftIcons";
import type { Aircraft } from "../components/map/aircraft";

function attrs(map: Record<string, string>) {
  return { getAttribute: (n: string) => map[n] ?? null };
}

// --- parseRotorBinding ---

test("parseRotorBinding reads pivot, cw sign, rpm and id", () => {
  const b = parseRotorBinding(
    attrs({ "data-rotor": "main", "data-rotor-pivot": "144 296.35", "data-rotor-direction": "cw", "data-rotor-rpm": "300" }),
    "r1",
  );
  assert.deepEqual(b, { id: "main", pivot: [144, 296.35], sign: 1, rpm: 300 });
});

test("parseRotorBinding maps ccw to sign -1", () => {
  const b = parseRotorBinding(
    attrs({ "data-rotor": "m", "data-rotor-pivot": "0 0", "data-rotor-direction": "ccw" }),
    "r1",
  );
  assert.equal(b?.sign, -1);
});

test("parseRotorBinding defaults rpm to 600 when missing, empty, or zero", () => {
  for (const rpm of [undefined, "", "0", "abc"]) {
    const a: Record<string, string> = { "data-rotor": "m", "data-rotor-pivot": "1 2", "data-rotor-direction": "cw" };
    if (rpm !== undefined) a["data-rotor-rpm"] = rpm;
    assert.equal(parseRotorBinding(attrs(a), "r1")?.rpm, ROTOR_DEFAULT_RPM);
  }
});

test("parseRotorBinding never assumes a direction", () => {
  for (const dir of [undefined, "", "CW", "clockwise", "left"]) {
    const a: Record<string, string> = { "data-rotor": "m", "data-rotor-pivot": "1 2" };
    if (dir !== undefined) a["data-rotor-direction"] = dir;
    assert.equal(parseRotorBinding(attrs(a), "r1"), null, `direction ${String(dir)}`);
  }
});

test("parseRotorBinding rejects missing or malformed pivots", () => {
  for (const pivot of [undefined, "", "1", "1 2 3", "a b", "NaN 4"]) {
    const a: Record<string, string> = { "data-rotor": "m", "data-rotor-direction": "cw" };
    if (pivot !== undefined) a["data-rotor-pivot"] = pivot;
    assert.equal(parseRotorBinding(attrs(a), "r1"), null, `pivot ${String(pivot)}`);
  }
});

test("parseRotorBinding accepts comma-separated pivots and falls back to the given id", () => {
  const b = parseRotorBinding(
    attrs({ "data-rotor": "", "data-rotor-pivot": "10,-20", "data-rotor-direction": "cw" }),
    "r7",
  );
  assert.deepEqual(b?.pivot, [10, -20]);
  assert.equal(b?.id, "r7");
});

test("mirror rotors keep their own id, pivot and direction", () => {
  const main = parseRotorBinding(
    attrs({ "data-rotor": "main", "data-rotor-pivot": "100 50", "data-rotor-direction": "cw" }),
    "r1",
  );
  const mirror = parseRotorBinding(
    attrs({ "data-rotor": "main-mirror", "data-rotor-pivot": "-100 50", "data-rotor-direction": "ccw" }),
    "r2",
  );
  assert.equal(main?.id, "main");
  assert.equal(mirror?.id, "main-mirror");
  assert.deepEqual(mirror?.pivot, [-100, 50]);
  assert.equal(main?.sign, 1);
  assert.equal(mirror?.sign, -1);
});

// --- Shipped assets: tags declaring bindings parse; others yield none ---

const SHAPES_DIR = path.join(process.cwd(), "public", "aircraft-shapes");

function rotorTags(svg: string): Array<Record<string, string>> {
  const tags = svg.match(/<[a-zA-Z]+\b[^>]*\bdata-rotor(?:=|\s|>)[^>]*>/g) ?? [];
  return tags.map((tag) => {
    const out: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
    return out;
  });
}

test("every shipped data-rotor group parses to a valid binding with an explicit direction", () => {
  let withBindings = 0;
  for (const file of readdirSync(SHAPES_DIR).filter((f) => f.endsWith(".svg"))) {
    const svg = readFileSync(path.join(SHAPES_DIR, file), "utf8");
    const tags = rotorTags(svg);
    if (tags.length === 0) continue;
    withBindings++;
    tags.forEach((t, i) => {
      assert.ok(t["data-rotor-direction"] === "cw" || t["data-rotor-direction"] === "ccw", `${file} rotor ${i} direction`);
      assert.ok(parseRotorBinding(attrs(t), `r${i + 1}`), `${file} rotor ${i} parses`);
    });
  }
  assert.ok(withBindings > 0);
});

test("fixed-wing / prop / tail-rotor-only SVGs declare no data-rotor groups", () => {
  for (const file of ["C172.svg", "B738.svg", "A320.svg"]) {
    let svg: string;
    try {
      svg = readFileSync(path.join(SHAPES_DIR, file), "utf8");
    } catch {
      continue;
    }
    assert.deepEqual(rotorTags(svg), [], file);
  }
});

// --- viewBox + pivot math ---

test("parseViewBox parses a non-zero origin and falls back to 0,0,w,h", () => {
  assert.deepEqual(parseViewBox("-472.35 -220.72 1232.7 1232.7", 512, 512), {
    minX: -472.35,
    minY: -220.72,
    width: 1232.7,
    height: 1232.7,
  });
  assert.deepEqual(parseViewBox(null, 512, 256), { minX: 0, minY: 0, width: 512, height: 256 });
  assert.deepEqual(parseViewBox("0 0 0 10", 5, 6), { minX: 0, minY: 0, width: 5, height: 6 });
});

test("pivotToCanvasPixels subtracts the viewBox origin and applies non-1:1 scale", () => {
  const vb = { minX: -100, minY: 50, width: 200, height: 400 };
  // pivot (0, 250): (100/200, 200/400) = (0.5, 0.5) of canvas 96x192 (non-square, non-1:1)
  assert.deepEqual(pivotToCanvasPixels([0, 250], vb, 96, 192), [48, 96]);
  // origin corner maps to 0,0; far corner maps to canvas size
  assert.deepEqual(pivotToCanvasPixels([-100, 50], vb, 96, 192), [0, 0]);
  assert.deepEqual(pivotToCanvasPixels([100, 450], vb, 96, 192), [96, 192]);
  // Ignoring the origin would give a different answer
  assert.notDeepEqual(pivotToCanvasPixels([0, 250], vb, 96, 192), [0 * 0.48, 250 * 0.48]);
});

test("pivotToCanvasPixels with the real-world R44-style viewBox and a 3x canvas scale", () => {
  const vb = { minX: -472.35, minY: -220.72, width: 1232.7, height: 1232.7 };
  const [x, y] = pivotToCanvasPixels([144, 296.35], vb, 384, 384);
  assert.ok(Math.abs(x - ((144 + 472.35) * 384) / 1232.7) < 1e-9);
  assert.ok(Math.abs(y - ((296.35 + 220.72) * 384) / 1232.7) < 1e-9);
});

// --- Speed + angle sign ---

test("rotor display rate is a fixed 1 rev/s and ignores rpm", () => {
  assert.equal(ROTOR_DISPLAY_REVS_PER_SECOND, 1);
  assert.equal(rotorSpinDegrees({ sign: 1, rpm: 60 }, 0.25), 90);
  assert.equal(rotorSpinDegrees({ sign: 1, rpm: 6000 }, 0.25), 90);
});

test("rotorSpinDegrees is clockwise-positive for cw and negative for ccw", () => {
  // 1 rev/s -> 0.25 s = 90 deg
  assert.equal(rotorSpinDegrees({ sign: 1, rpm: 600 }, 0.25), 90);
  assert.equal(rotorSpinDegrees({ sign: -1, rpm: 600 }, 0.25), -90);
  assert.equal(rotorSpinDegrees({ sign: 1, rpm: 600 }, 0), 0);
});

test("rotorDeckAngle: a cw rotor's deck.gl angle decreases over time (clockwise on screen)", () => {
  const a0 = rotorDeckAngle(0, rotorSpinDegrees({ sign: 1, rpm: 600 }, 0.01));
  const a1 = rotorDeckAngle(0, rotorSpinDegrees({ sign: 1, rpm: 600 }, 0.02));
  assert.ok(a1 < a0, "deck.gl angle is CCW-positive, so clockwise means decreasing");
  const c0 = rotorDeckAngle(0, rotorSpinDegrees({ sign: -1, rpm: 600 }, 0.01));
  const c1 = rotorDeckAngle(0, rotorSpinDegrees({ sign: -1, rpm: 600 }, 0.02));
  assert.ok(c1 > c0, "ccw rotor increases in deck.gl angle");
});

test("rotorDeckAngle folds in the track clockwise and tolerates undefined track", () => {
  assert.equal(rotorDeckAngle(90, 0), -90);
  assert.equal(rotorDeckAngle(undefined, 30), -30);
  assert.equal(rotorDeckAngle(90, 30), -120);
});

test("rotateOffsetByTrack rotates a nose-up offset clockwise by the track", () => {
  const [x, y] = rotateOffsetByTrack([0, -10], 90); // 10px ahead of center, track east
  assert.ok(Math.abs(x - 10) < 1e-9);
  assert.ok(Math.abs(y) < 1e-9);
  assert.deepEqual(rotateOffsetByTrack([3, 4], undefined), [3, 4]);
  const [rx, ry] = rotateOffsetByTrack([7, 0], 180);
  assert.ok(Math.abs(rx + 7) < 1e-9 && Math.abs(ry) < 1e-9);
});

// --- Layers ---

const ATLAS: IconAtlas = {
  image: {} as never,
  mapping: {
    generic: { x: 0, y: 0, width: 96, height: 96, mask: true },
    "generic#r1": { x: 96, y: 0, width: 96, height: 96, mask: true },
    "generic#r2": { x: 192, y: 0, width: 96, height: 96, mask: true },
  },
} as unknown as IconAtlas;

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

test("buildAircraftLayers with modelsEnabled=false has no scenegraph layers and every positioned aircraft in the icon layer", () => {
  const list = [
    ac("a1", { typeDesignator: "B738" }),
    ac("a2", { typeDesignator: "A320" }),
    ac("a3", { typeDesignator: "R44", category: "A7" }),
    { hex: "nopos" } as Aircraft,
  ];
  const layers = buildAircraftLayers(layerParams(list, false));
  assert.equal(layers.filter((l) => l.id.startsWith(AIRCRAFT_MODEL_LAYER_ID)).length, 0);
  const icon = layers.find((l) => l.id === AIRCRAFT_ICON_LAYER_ID);
  assert.ok(icon);
  const data = (icon!.props as unknown as { data: Aircraft[] }).data;
  assert.deepEqual(data.map((d) => d.hex), ["a1", "a2", "a3"]);
});

test("buildAircraftLayers returns no layers without an atlas", () => {
  assert.deepEqual(buildAircraftLayers({ ...layerParams([ac("a")], false), iconAtlas: null }), []);
});

const TWO_ROTORS: RotorAtlasBinding[] = [
  { id: "r1", pivot: [0, 0], sign: 1, rpm: 600, atlasKey: "generic#r1", offset: [0, -10] },
  { id: "r2", pivot: [0, 0], sign: -1, rpm: 600, atlasKey: "generic#r2", offset: [0, 10] },
];

test("collectRotorInstances yields one instance per (aircraft, rotor) only for types with bindings", () => {
  rotorBindingsByType.clear();
  try {
    // No bindings known: nothing.
    assert.deepEqual(collectRotorInstances([ac("a") as never]), []);
    // With no known type designators every aircraft resolves to the generic key.
    rotorBindingsByType.set(GENERIC_ICON_KEY, TWO_ROTORS);
    const inst = collectRotorInstances([ac("a") as never, ac("b") as never]);
    assert.equal(inst.length, 4);
    assert.deepEqual(inst.map((i) => `${i.aircraft.hex}:${i.binding.id}`), ["a:r1", "a:r2", "b:r1", "b:r2"]);
  } finally {
    rotorBindingsByType.clear();
  }
});

test("2D build adds a rotor layer for rotor-bearing types; 3D build does not; spin changes across clock ticks with no new data", () => {
  rotorBindingsByType.clear();
  rotorBindingsByType.set(GENERIC_ICON_KEY, TWO_ROTORS);
  try {
    const list = [ac("a", { track: 30 })];
    const layers2d = buildAircraftLayers(layerParams(list, false));
    assert.ok(layers2d.some((l) => l.id === AIRCRAFT_ROTOR_BINDING_LAYER_ID));
    const layers3d = buildAircraftLayers(layerParams(list, true));
    assert.ok(!layers3d.some((l) => l.id === AIRCRAFT_ROTOR_BINDING_LAYER_ID));

    const instances = collectRotorInstances(list as never);
    const angleAt = (nowMs: number, i: number) => {
      const layer = buildRotorBindingLayer({ instances, iconAtlas: ATLAS, colorMode: "altitude", nowMs });
      const getAngle = (layer.props as unknown as { getAngle: (d: unknown) => number }).getAngle;
      return getAngle(instances[i]);
    };
    const t0 = angleAt(1000, 0);
    const t1 = angleAt(1040, 0);
    assert.notEqual(t0, t1);
    // cw rotor decreases in deck.gl angle, ccw (second) increases.
    assert.ok(t1 < t0);
    assert.ok(angleAt(1040, 1) > angleAt(1000, 1));
    // Same data, same clock => same angle (pure function of time).
    assert.equal(angleAt(1000, 0), t0);
  } finally {
    rotorBindingsByType.clear();
  }
});

test("altitudeToRenderMeters is zero when flat and lifted otherwise", () => {
  assert.ok(altitudeToRenderMeters(30000) > 0);
  assert.equal(altitudeToRenderMeters(30000, true), 0);
});

function zOf(layer: { props: unknown }, d: unknown): number {
  const getPosition = (layer.props as { getPosition: (d: unknown) => number[] }).getPosition;
  return getPosition(d)[2];
}

test("buildAircraftLayers lifts icons by altitude in 3D and flattens them in 2D", () => {
  const a = ac("a1", { altitude: 30000 });
  const lifted = buildAircraftLayers(layerParams([a], true)).find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  const flat = buildAircraftLayers(layerParams([a], false)).find((l) => l.id === AIRCRAFT_ICON_LAYER_ID)!;
  assert.ok(zOf(lifted, a) > 0);
  assert.equal(zOf(flat, a), 0);
});

test("2D flattens track points and rotor binding layer; 3D keeps the lift", () => {
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

  rotorBindingsByType.clear();
  rotorBindingsByType.set(GENERIC_ICON_KEY, TWO_ROTORS);
  const [inst] = collectRotorInstances([a as Aircraft & { lat: number; lon: number }]);
  const rotor = buildRotorBindingLayer({ instances: [inst], iconAtlas: ATLAS, colorMode: "altitude", nowMs: 0, flat: true });
  assert.equal(zOf(rotor, inst), 0);
  rotorBindingsByType.clear();
});

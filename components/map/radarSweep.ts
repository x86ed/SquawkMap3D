import type { Layer } from "@deck.gl/core";
import { ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { Aircraft } from "./aircraft";
import { METERS_PER_NM } from "./constants";
import type { GeoCoords } from "./geolocation";

export const RANGE_OUTLINE_SWEEP_WEDGE_LAYER_ID = "range-outline-sweep-wedge";
export const RANGE_OUTLINE_AIRCRAFT_DOT_LAYER_ID = "range-outline-aircraft-dots";
export const RANGE_OUTLINE_AIRCRAFT_LABEL_LAYER_ID = "range-outline-aircraft-labels";

// Trailing-wedge look, tuned visually (design.md's Open Questions leaves
// these exact constants to implementation): a 40°-wide fading trail behind
// a bright, thin leading edge, split into enough angular slices that the
// opacity gradient reads as a smooth fade rather than a few hard bands —
// porting radar-sweep_4.html's own intra-frame `WEDGE_STEPS` look (see
// design.md Decision 4b).
const WEDGE_TRAIL_WIDTH_DEG = 40;
const WEDGE_SLICE_COUNT = 14;
const WEDGE_LEADING_EDGE_WIDTH_DEG = 3;
// Bright green — matches the dashed perimeter outline's own color
// (RANGE_OUTLINE_LINE_COLOR in layers.ts) and the aircraft dots/labels
// below, for one consistent "radar" accent color distinct from the fill
// layer's own dark teal (RANGE_OUTLINE_FILL_COLOR, left unchanged).
const WEDGE_BASE_COLOR: [number, number, number] = [0, 255, 59];
const WEDGE_MAX_TRAIL_OPACITY = 90;
const WEDGE_LEADING_EDGE_OPACITY = 210;

// Alpha (0-255) at idle vs. brightened during a sweep pass. Dots stay
// faintly visible at idle (10%) and nearly opaque while swept (95%); labels
// stay fully invisible at idle (0%) and only read while swept (80%) — see
// `isFlashing`/`buildRangeOutlineSweepLayers` below for where these apply.
const AIRCRAFT_DOT_BASE_ALPHA = Math.round(0.1 * 255);
const AIRCRAFT_DOT_FLASH_ALPHA = Math.round(0.95 * 255);
const AIRCRAFT_LABEL_BASE_ALPHA = 0;
const AIRCRAFT_LABEL_FLASH_ALPHA = Math.round(0.8 * 255);

const AIRCRAFT_DOT_COLOR: [number, number, number, number] = [
  0, 255, 59, AIRCRAFT_DOT_BASE_ALPHA,
];
const AIRCRAFT_DOT_FLASH_COLOR: [number, number, number, number] = [
  0, 255, 59, AIRCRAFT_DOT_FLASH_ALPHA,
];
const AIRCRAFT_DOT_RADIUS_PIXELS = 4;
const AIRCRAFT_DOT_FLASH_RADIUS_PIXELS = 7;
const AIRCRAFT_LABEL_COLOR: [number, number, number, number] = [
  0, 255, 59, AIRCRAFT_LABEL_BASE_ALPHA,
];
const AIRCRAFT_LABEL_FLASH_COLOR: [number, number, number, number] = [
  0, 255, 59, AIRCRAFT_LABEL_FLASH_ALPHA,
];

// How long a dot/label stays "brightened" after the sweep beam passes an
// aircraft's bearing — ports radar-sweep_4.html's `paintEvents`/
// `flashContactRow` mechanic (design.md Decision 6).
const AIRCRAFT_FLASH_DURATION_MS = 700;

// A ray that never intersects the outline polygon (e.g. the site sits
// outside an odd-shaped/multi-ring outline) falls back to this radius
// rather than an unbounded beam — comfortably beyond any real feeder's
// ADS-B range (design.md Decision 4b's "fallback max radius" note).
const FALLBACK_RAY_RADIUS_METERS = 300 * METERS_PER_NM;

type PositionedAircraft = Aircraft & { lat: number; lon: number };

/**
 * Per-aircraft "last time the sweep beam passed this aircraft's bearing"
 * timestamps — this animation loop's own bookkeeping between frames, owned
 * here as module state (mirrors aircraft.ts's `trackBuffers`) rather than
 * threaded through every caller.
 */
let lastFlashByHex = new Map<string, number>();

/** Resets flash-timestamp state — call when the layer is toggled off, same
 * reasoning as aircraft.ts's `clearTracks`: re-enabling starts fresh rather
 * than resuming stale flashes. */
export function clearRangeOutlineFlashTimestamps(): void {
  lastFlashByHex = new Map();
}

/**
 * Sweep angle in degrees at `elapsedMs` since the sweep started, one full
 * revolution per `periodMs`. Unbounded/monotonic (not wrapped to 0-360),
 * matching the reference's `sweepAngle += sweepSpeed * dt` accumulation —
 * callers that need a 0-359 bearing should normalize it themselves.
 */
export function computeSweepAngleDeg(elapsedMs: number, periodMs: number): number {
  return (elapsedMs / periodMs) * 360;
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Whether `bearingDeg` lies within the sweep's travel from `previousDeg` to
 * `currentDeg` this frame (handling both directions and the 360/0 wrap). */
function angleCrossed(bearingDeg: number, previousDeg: number, currentDeg: number): boolean {
  const prev = normalizeDeg(previousDeg);
  const current = normalizeDeg(currentDeg);
  const bearing = normalizeDeg(bearingDeg);
  if (prev === current) return false;
  if (current > prev) return bearing > prev && bearing <= current;
  return bearing > prev || bearing <= current; // wrapped past 360/0
}

/**
 * Records `now` as each aircraft's last-flash timestamp if the sweep beam
 * crossed that aircraft's bearing-from-site between `previousAngleDeg` and
 * `currentAngleDeg` this frame, and drops entries for aircraft no longer
 * reported. Not gated on the aircraft being inside the outline polygon
 * (design.md Decision 6's "flash regardless" default for the open question
 * on this).
 */
export function updateFlashTimestamps(params: {
  aircraft: Aircraft[];
  site: GeoCoords;
  previousAngleDeg: number;
  currentAngleDeg: number;
  now: number;
}): void {
  const { aircraft, site, previousAngleDeg, currentAngleDeg, now } = params;
  const siteCoord: [number, number] = [site.longitude, site.latitude];

  for (const a of aircraft) {
    if (a.lat === undefined || a.lon === undefined) continue;
    const bearing = turf.bearing(siteCoord, [a.lon, a.lat]);
    if (angleCrossed(bearing, previousAngleDeg, currentAngleDeg)) {
      lastFlashByHex.set(a.hex, now);
    }
  }

  const seenHexes = new Set(aircraft.map((a) => a.hex));
  for (const hex of lastFlashByHex.keys()) {
    if (!seenHexes.has(hex)) lastFlashByHex.delete(hex);
  }
}

function isFlashing(hex: string, now: number): boolean {
  const last = lastFlashByHex.get(hex);
  return last !== undefined && now - last < AIRCRAFT_FLASH_DURATION_MS;
}

/**
 * Flattens the outline's Polygon/MultiPolygon geometry into a single
 * MultiLineString (every ring, outer boundaries only matter here) for
 * `turf.lineIntersect` to ray-cast against. Built directly from the
 * coordinate arrays (not `turf.polygonToLine`, whose MultiPolygon path
 * returns a FeatureCollection rather than a single Feature) since
 * `rangeOutline.ts` already guarantees this exact Polygon/MultiPolygon
 * shape.
 */
function outlineToLines(
  outline: FeatureCollection<Polygon | MultiPolygon>,
): Feature<MultiLineString> | null {
  const feature = outline.features[0];
  if (!feature) return null;
  const { geometry } = feature;
  const rings: [number, number][][] =
    geometry.type === "Polygon"
      ? (geometry.coordinates as [number, number][][])
      : geometry.coordinates.flatMap((polygon) => polygon as [number, number][][]);
  if (rings.length === 0) return null;
  return turf.multiLineString(rings);
}

/**
 * Distance in meters from `site` to where a ray cast at `bearingDeg` exits
 * `outlineLines` — the farthest intersection along the ray, since the site
 * normally sits inside the outline polygon and the outermost crossing is
 * where that direction's actual range ends (design.md Decision 4b). Falls
 * back to `FALLBACK_RAY_RADIUS_METERS` when the ray doesn't intersect at
 * all.
 */
function raycastOutlineDistanceMeters(
  site: [number, number],
  bearingDeg: number,
  outlineLines: Feature<MultiLineString>,
): number {
  const far = turf.destination(site, FALLBACK_RAY_RADIUS_METERS, bearingDeg, {
    units: "meters",
  });
  const ray = turf.lineString([site, far.geometry.coordinates as [number, number]]);
  const intersections = turf.lineIntersect(ray, outlineLines);
  if (intersections.features.length === 0) return FALLBACK_RAY_RADIUS_METERS;

  let maxDistance = 0;
  for (const point of intersections.features) {
    const distance = turf.distance(site, point, { units: "meters" });
    if (distance > maxDistance) maxDistance = distance;
  }
  return maxDistance;
}

function pointAt(
  site: [number, number],
  distanceMeters: number,
  bearingDeg: number,
): [number, number] {
  return turf.destination(site, distanceMeters, bearingDeg, { units: "meters" }).geometry
    .coordinates as [number, number];
}

interface WedgeSlice {
  polygon: [number, number][];
  color: [number, number, number, number];
}

/**
 * Builds the trailing-fade wedge slices plus a bright leading-edge slice, in
 * real lng/lat (ground) space — each slice is a triangle from the site out
 * to two rays at consecutive angles, each ray capped at wherever it exits
 * the outline polygon (`raycastOutlineDistanceMeters`), so the wedge
 * naturally stops at the polygon boundary without a screen-space clip.
 */
function buildWedgeSlices(
  site: [number, number],
  sweepAngleDeg: number,
  outlineLines: Feature<MultiLineString>,
): WedgeSlice[] {
  const currentDeg = normalizeDeg(sweepAngleDeg);
  const sliceWidth = WEDGE_TRAIL_WIDTH_DEG / WEDGE_SLICE_COUNT;
  const slices: WedgeSlice[] = [];

  for (let i = 0; i < WEDGE_SLICE_COUNT; i++) {
    const startDeg = currentDeg - WEDGE_TRAIL_WIDTH_DEG + i * sliceWidth;
    const endDeg = startDeg + sliceWidth;
    const startDistance = raycastOutlineDistanceMeters(site, startDeg, outlineLines);
    const endDistance = raycastOutlineDistanceMeters(site, endDeg, outlineLines);
    // Fades from the trailing edge (i = 0) toward the leading edge.
    const opacity = Math.round(((i + 1) / WEDGE_SLICE_COUNT) * WEDGE_MAX_TRAIL_OPACITY);
    slices.push({
      polygon: [
        site,
        pointAt(site, startDistance, startDeg),
        pointAt(site, endDistance, endDeg),
        site,
      ],
      color: [...WEDGE_BASE_COLOR, opacity],
    });
  }

  const leadingStartDeg = currentDeg - WEDGE_LEADING_EDGE_WIDTH_DEG;
  const leadingStartDistance = raycastOutlineDistanceMeters(site, leadingStartDeg, outlineLines);
  const leadingEndDistance = raycastOutlineDistanceMeters(site, currentDeg, outlineLines);
  slices.push({
    polygon: [
      site,
      pointAt(site, leadingStartDistance, leadingStartDeg),
      pointAt(site, leadingEndDistance, currentDeg),
      site,
    ],
    color: [...WEDGE_BASE_COLOR, WEDGE_LEADING_EDGE_OPACITY],
  });

  return slices;
}

/**
 * Pure per-frame layer builder for the actual-range-outline's radar-sweep
 * overlay — analogous to `aircraftLayer.ts`'s `buildAircraftLayers()`, but
 * called every `requestAnimationFrame` rather than once per feeder poll
 * (design.md Decision 4). Builds the sweep wedge (`SolidPolygonLayer`) and
 * the tracked-aircraft dots/labels (`ScatterplotLayer` + `TextLayer`),
 * positioned at ground level (`[lon, lat, 0]`) so they read as flat radar
 * blips regardless of the aircraft's real altitude — a deliberate divergence
 * from `aircraftLayer.ts`'s own altitude-based icon positioning (see
 * reposition-radar-sweep-dot's design.md Decision 1).
 *
 * No-ops (`[]`) when the outline has no polygon yet or the site location is
 * unknown (design.md Decision 4b's "no error, just nothing to draw" case).
 * Aircraft dots/labels are drawn regardless of whether they fall inside the
 * outline polygon — only the wedge's own geometry is ray-cast-bounded (see
 * design.md Decision 6).
 */
export function buildRangeOutlineSweepLayers(params: {
  outline: FeatureCollection<Polygon | MultiPolygon>;
  site: GeoCoords | null;
  sweepAngleDeg: number;
  aircraft: Aircraft[];
  now: number;
}): Layer[] {
  const { outline, site, sweepAngleDeg, aircraft, now } = params;
  if (!site || outline.features.length === 0) return [];

  const outlineLines = outlineToLines(outline);
  if (!outlineLines) return [];

  const siteCoord: [number, number] = [site.longitude, site.latitude];
  const wedgeSlices = buildWedgeSlices(siteCoord, sweepAngleDeg, outlineLines);

  const wedgeLayer = new SolidPolygonLayer<WedgeSlice>({
    id: RANGE_OUTLINE_SWEEP_WEDGE_LAYER_ID,
    data: wedgeSlices,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => d.color,
    extruded: false,
    pickable: false,
  });

  const positioned = aircraft.filter(
    (a): a is PositionedAircraft => a.lat !== undefined && a.lon !== undefined,
  );

  const dotLayer = new ScatterplotLayer<PositionedAircraft>({
    id: RANGE_OUTLINE_AIRCRAFT_DOT_LAYER_ID,
    data: positioned,
    getPosition: (d) => [d.lon, d.lat, 0],
    getFillColor: (d) => (isFlashing(d.hex, now) ? AIRCRAFT_DOT_FLASH_COLOR : AIRCRAFT_DOT_COLOR),
    getRadius: (d) =>
      isFlashing(d.hex, now) ? AIRCRAFT_DOT_FLASH_RADIUS_PIXELS : AIRCRAFT_DOT_RADIUS_PIXELS,
    radiusUnits: "pixels",
    pickable: false,
  });

  const labelLayer = new TextLayer<PositionedAircraft>({
    id: RANGE_OUTLINE_AIRCRAFT_LABEL_LAYER_ID,
    data: positioned,
    getPosition: (d) => [d.lon, d.lat, 0],
    getText: (d) => d.hex,
    getColor: (d) =>
      isFlashing(d.hex, now) ? AIRCRAFT_LABEL_FLASH_COLOR : AIRCRAFT_LABEL_COLOR,
    getSize: 11,
    getPixelOffset: [0, -12],
    pickable: false,
  });

  // Wedge beneath, dots above it, labels on top of the dots.
  return [wedgeLayer, dotLayer, labelLayer];
}

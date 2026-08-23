import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { MapTheme } from "./mapStyles";
import { TerminatorScreenBlendLayer } from "./terminatorGL";
import { TERMINATOR_ELEVATION_BANDS_DEG } from "./constants";

export const TERMINATOR_SOURCE_ID = "day-night-terminator";
const TERMINATOR_LAYER_ID_PREFIX = "day-night-terminator-band-";
export const TERMINATOR_GL_LAYER_ID = "day-night-terminator-gl";

function terminatorLayerId(bandIndex: number): string {
  return `${TERMINATOR_LAYER_ID_PREFIX}${bandIndex}`;
}

export const TERMINATOR_LAYER_IDS = [
  ...TERMINATOR_ELEVATION_BANDS_DEG.map((_, bandIndex) => terminatorLayerId(bandIndex)),
  TERMINATOR_GL_LAYER_ID,
];

/** The dark-theme terminator layer, once added (see `addTerminatorLayers`).
 * `refreshTerminator`/`setTerminatorVisibility` call methods on this same
 * instance rather than going through `map.get*`/`map.set*Property`, since
 * those APIs are for style-spec layer types — a `type: "custom"` layer like
 * this one owns its own visibility/data state instead. Module-level rather
 * than per-map: this app only ever has one map instance, and re-checking
 * `map.getLayer(TERMINATOR_GL_LAYER_ID)` before reusing it means a stale
 * reference (e.g. from a torn-down dev-mode double-mount) self-heals on the
 * next `addTerminatorLayers` call for whichever map is actually active. */
let glLayer: TerminatorScreenBlendLayer | null = null;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Longitude step (degrees) for walking the terminator curve. */
const LONGITUDE_STEP_DEG = 2;

/** Per-band fill opacity for the light theme's night-darkening `fill`
 * layers. Stacked, these ~8 layers compose to roughly `1-(1-0.1)**8 ≈ 0.57`
 * opacity at the darkest (fully-enclosed) point. The dark theme doesn't use
 * this — see `TerminatorScreenBlendLayer` in `terminatorGL.ts`, which
 * brightens the day side with a true screen blend instead of an alpha-
 * blended fill (no headroom to darken further against an already-dark
 * basemap without either being invisible or washing everything toward one
 * flat tint). */
const LIGHT_FILL_OPACITY = 0.1;

const LIGHT_FILL_COLOR = "#0a1030";

/** Which side of the terminator a band's polygon covers, for
 * `buildTerminatorBand`/`buildTerminatorBands`. `"night"` = elevation at or
 * below the threshold (used by the light theme's darkening bands); `"day"` =
 * at or above it (used by the dark theme's brightening bands, via
 * `TerminatorScreenBlendLayer`). */
export type TerminatorRegion = "night" | "day";

function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Julian day for `date`. */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time, in hours [0, 24). */
export function greenwichSiderealTimeHours(jd: number): number {
  const daysSinceJ2000 = jd - 2451545.0;
  const gst = (18.697374558 + 24.06570982441908 * daysSinceJ2000) % 24;
  return gst < 0 ? gst + 24 : gst;
}

/** The sun's ecliptic longitude, in degrees [0, 360). Low-precision solar
 * position formula (accurate to ~0.01°, far beyond what a map overlay
 * needs) — see e.g. the Astronomical Almanac's "Low Precision Formulas for
 * the Sun's Coordinates". */
export function sunEclipticLongitudeDeg(jd: number): number {
  const daysSinceJ2000 = jd - 2451545.0;
  const meanLongitude = normalizeDeg(280.46 + 0.9856474 * daysSinceJ2000);
  const meanAnomaly = normalizeDeg(357.528 + 0.9856003 * daysSinceJ2000) * DEG;
  const eclipticLongitude =
    meanLongitude +
    1.915 * Math.sin(meanAnomaly) +
    0.02 * Math.sin(2 * meanAnomaly);
  return normalizeDeg(eclipticLongitude);
}

/** Mean obliquity of the ecliptic, in degrees. Varies by only ~0.013° per
 * century, so a constant is accurate enough for a live map overlay. */
export function eclipticObliquityDeg(): number {
  return 23.439;
}

export interface SunPosition {
  /** Right ascension, in degrees. */
  rightAscensionDeg: number;
  /** Declination, in degrees — the subsolar point's latitude. */
  declinationDeg: number;
}

/** The sun's equatorial position (right ascension + declination) at `jd`. */
export function sunEquatorialPosition(jd: number): SunPosition {
  const lambda = sunEclipticLongitudeDeg(jd) * DEG;
  const obliquity = eclipticObliquityDeg() * DEG;
  const rightAscensionDeg =
    Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)) * RAD;
  const declinationDeg = Math.asin(Math.sin(obliquity) * Math.sin(lambda)) * RAD;
  return { rightAscensionDeg, declinationDeg };
}

/** Solves `sin(elevationDeg) = sin(lat)sin(δ) + cos(lat)cos(δ)cos(H)` for
 * latitude (degrees), given the sun's declination `δ` and the hour angle
 * `H` at some longitude/time (both in degrees). Returns `null` where no
 * real solution exists — that meridian is uniformly above or below
 * `elevationDeg` at every latitude (a polar-day/polar-night case). */
export function terminatorLatitudeAtLongitude(
  elevationDeg: number,
  declinationDeg: number,
  hourAngleDeg: number,
): number | null {
  const delta = declinationDeg * DEG;
  const hourAngle = hourAngleDeg * DEG;
  // Solve A*sin(lat) + B*cos(lat) = C via R*sin(lat + phi) = C.
  const a = Math.sin(delta);
  const b = Math.cos(delta) * Math.cos(hourAngle);
  const c = Math.sin(elevationDeg * DEG);
  const r = Math.sqrt(a * a + b * b);
  if (r === 0) return null;
  const ratio = c / r;
  if (ratio < -1 || ratio > 1) return null;
  const phi = Math.atan2(b, a);
  const asinRatio = Math.asin(ratio);

  const candidates = [asinRatio - phi, Math.PI - asinRatio - phi];
  for (const candidate of candidates) {
    // Normalize into (-π, π], then check it's a valid latitude.
    let lat = candidate % (2 * Math.PI);
    if (lat > Math.PI) lat -= 2 * Math.PI;
    if (lat < -Math.PI) lat += 2 * Math.PI;
    if (lat >= -Math.PI / 2 && lat <= Math.PI / 2) {
      return lat * RAD;
    }
  }
  return null;
}

export function terminatorLatitudeAtLongitudeForDate(
  lngDeg: number,
  sunPosition: SunPosition,
  gstHours: number,
  elevationDeg: number,
): number | null {
  const hourAngleDeg = gstHours * 15 + lngDeg - sunPosition.rightAscensionDeg;
  return terminatorLatitudeAtLongitude(
    elevationDeg,
    sunPosition.declinationDeg,
    hourAngleDeg,
  );
}

/** Solar elevation at the equator for the given declination/hour-angle —
 * used as a cheap proxy to decide, at a longitude with no terminator
 * crossing (a polar-day/polar-night meridian), whether that whole meridian
 * is on the day or night side of `elevationDeg`. */
function elevationAtEquatorDeg(
  declinationDeg: number,
  hourAngleDeg: number,
): number {
  return (
    Math.asin(Math.cos(declinationDeg * DEG) * Math.cos(hourAngleDeg * DEG)) *
    RAD
  );
}

/**
 * The polygon for `region` at solar elevation threshold `elevationDeg`
 * (`"night"` = elevation at or below the threshold, `"day"` = at or above
 * it), as a GeoJSON `Polygon`.
 *
 * Walks longitude from -180° to 180°, solving for the terminator curve's
 * latitude at each step — the curve itself (where elevation exactly equals
 * the threshold) doesn't depend on `region`, only which side of it counts
 * as "inside" the polygon does. Where no crossing exists (a
 * polar-day/polar-night meridian at this threshold), substitutes the pole
 * latitude that keeps the boundary correct: the region's own pole (full
 * width) if that whole meridian is inside the region, the opposite pole
 * (zero width) if it's entirely outside. The ring is closed by running
 * along the region's pole latitude between the ends, which is the standard
 * way to close a terminator polygon so it wraps the correct pole regardless
 * of season.
 */
export function buildTerminatorBand(
  date: Date,
  elevationDeg: number,
  region: TerminatorRegion = "night",
): Polygon {
  const jd = julianDay(date);
  const gstHours = greenwichSiderealTimeHours(jd);
  const sunPosition = sunEquatorialPosition(jd);
  const nightPoleLat = sunPosition.declinationDeg > 0 ? -90 : 90;
  const insidePoleLat = region === "night" ? nightPoleLat : -nightPoleLat;
  const outsidePoleLat = -insidePoleLat;

  const curve: Array<[number, number]> = [];
  for (let lngDeg = -180; lngDeg <= 180; lngDeg += LONGITUDE_STEP_DEG) {
    const lat = terminatorLatitudeAtLongitudeForDate(
      lngDeg,
      sunPosition,
      gstHours,
      elevationDeg,
    );
    if (lat !== null) {
      curve.push([lngDeg, lat]);
      continue;
    }
    const hourAngleDeg = gstHours * 15 + lngDeg - sunPosition.rightAscensionDeg;
    const equatorElevation = elevationAtEquatorDeg(
      sunPosition.declinationDeg,
      hourAngleDeg,
    );
    const meridianIsFullyNight = equatorElevation <= elevationDeg;
    const meridianIsFullyInside =
      region === "night" ? meridianIsFullyNight : !meridianIsFullyNight;
    curve.push([lngDeg, meridianIsFullyInside ? outsidePoleLat : insidePoleLat]);
  }

  const ring: Array<[number, number]> = [
    ...curve,
    [180, insidePoleLat],
    [-180, insidePoleLat],
    curve[0],
  ];

  return { type: "Polygon", coordinates: [ring] };
}

/**
 * The full set of twilight bands for `region` (see
 * `TERMINATOR_ELEVATION_BANDS_DEG`) as a `FeatureCollection`, one polygon
 * feature per elevation threshold, each tagged with its index (`bandIndex`)
 * for paint-property lookups.
 */
export function buildTerminatorBands(
  date: Date,
  region: TerminatorRegion = "night",
): FeatureCollection<Polygon, { bandIndex: number }> {
  return {
    type: "FeatureCollection",
    features: TERMINATOR_ELEVATION_BANDS_DEG.map(
      (elevationDeg, bandIndex): Feature<Polygon, { bandIndex: number }> => ({
        type: "Feature",
        properties: { bandIndex },
        geometry: buildTerminatorBand(date, elevationDeg, region),
      }),
    ),
  };
}

/**
 * Idempotently adds the terminator layer(s) for `theme` and seeds them with
 * `date`'s bands. Must be re-run on every `load`/`style.load`, same as the
 * other custom layers in `layers.ts`, since `setStyle` discards them.
 *
 * The two themes use genuinely different rendering: light theme darkens the
 * night side with plain alpha-blended `fill` layers (works fine — the
 * light basemap has headroom to darken). Dark theme brightens the day side
 * instead, via `TerminatorScreenBlendLayer`'s custom WebGL screen blend
 * (`terminatorGL.ts`) — a flat alpha overlay has no room to "brighten"
 * against an already-uniformly-dark basemap without either being invisible
 * or washing everything toward one flat tint; a true screen blend
 * brightens while preserving the map's underlying color/detail instead.
 */
export function addTerminatorLayers(
  map: MapLibreMap,
  theme: MapTheme,
  visible = true,
  date = new Date(),
): void {
  if (theme === "dark") {
    if (!map.getLayer(TERMINATOR_GL_LAYER_ID)) {
      glLayer = new TerminatorScreenBlendLayer(TERMINATOR_GL_LAYER_ID);
      map.addLayer(glLayer);
    }
    glLayer?.updateBands(buildTerminatorBands(date, "day"));
    glLayer?.setVisible(visible);
    return;
  }

  if (!map.getSource(TERMINATOR_SOURCE_ID)) {
    map.addSource(TERMINATOR_SOURCE_ID, {
      type: "geojson",
      data: buildTerminatorBands(date, "night"),
    });
  }
  const visibility = visible ? "visible" : "none";
  const fillColor = LIGHT_FILL_COLOR;
  const fillOpacity = LIGHT_FILL_OPACITY;
  for (const bandIndex of TERMINATOR_ELEVATION_BANDS_DEG.keys()) {
    const layerId = terminatorLayerId(bandIndex);
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "fill-color", fillColor);
      map.setPaintProperty(layerId, "fill-opacity", fillOpacity);
      continue;
    }
    map.addLayer({
      id: layerId,
      type: "fill",
      source: TERMINATOR_SOURCE_ID,
      filter: ["==", ["get", "bandIndex"], bandIndex],
      layout: { visibility },
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
      },
    });
  }
}

/** Shows/hides the terminator layer(s), whichever theme's variant is
 * currently active. Independent of pilot mode, same as military
 * bases/airports (see `setMilitaryBasesVisibility` in `layers.ts`) —
 * `TERMINATOR_LAYER_IDS` must be included in that file's `CUSTOM_LAYER_IDS`
 * list so pilot mode's hide-everything-else pass leaves this layer's own
 * visibility state alone. */
export function setTerminatorVisibility(map: MapLibreMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  for (const bandIndex of TERMINATOR_ELEVATION_BANDS_DEG.keys()) {
    const layerId = terminatorLayerId(bandIndex);
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
  glLayer?.setVisible(visible);
}

/** Recomputes the terminator bands for `date`/`theme` and updates the
 * active layer(s) in place. No-ops if neither the GL layer nor the GeoJSON
 * source exist yet (e.g. a refresh tick landing mid-style-swap, between
 * `setStyle` discarding the old layer and `style.load` re-adding it). */
export function refreshTerminator(
  map: MapLibreMap,
  theme: MapTheme,
  date = new Date(),
): void {
  if (theme === "dark") {
    glLayer?.updateBands(buildTerminatorBands(date, "day"));
    return;
  }
  const source = map.getSource(TERMINATOR_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(buildTerminatorBands(date, "night"));
}

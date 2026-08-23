import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { MapTheme } from "./mapStyles";
import { TERMINATOR_ELEVATION_BANDS_DEG } from "./constants";

export const TERMINATOR_SOURCE_ID = "day-night-terminator";
const TERMINATOR_LAYER_ID_PREFIX = "day-night-terminator-band-";

function terminatorLayerId(bandIndex: number): string {
  return `${TERMINATOR_LAYER_ID_PREFIX}${bandIndex}`;
}

export const TERMINATOR_LAYER_IDS = TERMINATOR_ELEVATION_BANDS_DEG.map((_, bandIndex) =>
  terminatorLayerId(bandIndex),
);

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Longitude step (degrees) for walking the terminator curve. */
const LONGITUDE_STEP_DEG = 2;

/**
 * Both themes render the same way: a GeoJSON source + one alpha-blended
 * `fill` layer per twilight band. Light theme darkens the night region;
 * dark theme brightens the day region instead (see `TERMINATOR_REGION_FOR_THEME`
 * below) — a previous version used a hand-written WebGL layer with a true
 * "screen" GL blend for dark theme specifically, to brighten while better
 * preserving underlying map detail than a flat alpha fill can. That traded
 * a lot of complexity (custom shaders, manual blend-state management, an
 * `earcut` triangulation step) for a real but marginal visual improvement,
 * and came with real bugs of its own (a module-level layer reference that
 * went stale on every HMR reload; an intensity easy to overtune into
 * washing out all detail via repeated-blend convergence). Reverted to this
 * simpler, uniform approach — same mechanism, same tuning knobs, for both
 * themes.
 */
// Same value in both themes converges to the same cumulative opacity at
// full 8-band stack (`1-(1-x)^8`) — but that reads very differently per
// theme: darkening toward near-black on the light basemap looks fine at
// 0.1, while brightening toward near-white on the dark basemap read as far
// too opaque/washed-out at that same value, and still noticeably too strong
// at half that (0.04) — dark theme needs a much lower value than light to
// land at a comparable *visual* strength, not just the same number.
const FILL_OPACITY: Record<MapTheme, number> = {
  light: 0.1,
  dark: 0.02,
};

const FILL_COLOR: Record<MapTheme, string> = {
  light: "#0a1030",
  dark: "#e8f2ff",
};

/** Which side of the terminator a band's polygon covers, for
 * `buildTerminatorBand`/`buildTerminatorBands`. `"night"` = elevation at or
 * below the threshold (light theme darkens this); `"day"` = at or above it
 * (dark theme brightens this instead — darkening has no headroom against an
 * already-dark basemap). */
export type TerminatorRegion = "night" | "day";

const REGION_FOR_THEME: Record<MapTheme, TerminatorRegion> = {
  light: "night",
  dark: "day",
};

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
 * Idempotently adds the terminator source and one `fill` layer per twilight
 * band, seeded with `date`'s bands for `theme`'s region/color/opacity. Must
 * be re-run on every `load`/`style.load`, same as the other custom layers
 * in `layers.ts`, since `setStyle` discards them.
 */
export function addTerminatorLayers(
  map: MapLibreMap,
  theme: MapTheme,
  visible = true,
  date = new Date(),
): void {
  if (!map.getSource(TERMINATOR_SOURCE_ID)) {
    map.addSource(TERMINATOR_SOURCE_ID, {
      type: "geojson",
      data: buildTerminatorBands(date, REGION_FOR_THEME[theme]),
    });
  }
  const visibility = visible ? "visible" : "none";
  const fillColor = FILL_COLOR[theme];
  const fillOpacity = FILL_OPACITY[theme];
  for (const bandIndex of TERMINATOR_ELEVATION_BANDS_DEG.keys()) {
    const layerId = terminatorLayerId(bandIndex);
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, "fill-color", fillColor);
      map.setPaintProperty(layerId, "fill-opacity", fillOpacity);
      map.setLayoutProperty(layerId, "visibility", visibility);
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

/** Shows/hides the terminator layer. Independent of pilot mode, same as
 * military bases/airports (see `setMilitaryBasesVisibility` in
 * `layers.ts`) — `TERMINATOR_LAYER_IDS` must be included in that file's
 * `CUSTOM_LAYER_IDS` list so pilot mode's hide-everything-else pass leaves
 * this layer's own visibility state alone. */
export function setTerminatorVisibility(map: MapLibreMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  for (const layerId of TERMINATOR_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
}

/** Recomputes the terminator bands for `date`/`theme` and updates the
 * existing source in place. No-ops if the source doesn't exist yet (e.g. a
 * refresh tick landing mid-style-swap, between `setStyle` discarding the
 * old source and `style.load` re-adding it). */
export function refreshTerminator(
  map: MapLibreMap,
  theme: MapTheme,
  date = new Date(),
): void {
  const source = map.getSource(TERMINATOR_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(buildTerminatorBands(date, REGION_FOR_THEME[theme]));
}

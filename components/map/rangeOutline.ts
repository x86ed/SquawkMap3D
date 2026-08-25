import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { getFeederUrl } from "./constants";

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Polygon | MultiPolygon> = {
  type: "FeatureCollection",
  features: [],
};

type LatLonPair = [number, number];

interface RawOutlineJson {
  points?: LatLonPair[];
  actualRange?: { last24h?: { points?: LatLonPair[] } };
  multiRange?: LatLonPair[][];
}

/**
 * Points at this app's own nginx sidecar, which proxies to the feeder's
 * outline.json server-side (see scripts/squawkmap3d.nginx.conf) — same CORS
 * gap and same fix as `feederLocation.ts`'s `getReceiverUrl()` for
 * receiver.json (ultrafeeder's nginx only patches CORS onto aircraft.json's
 * location block).
 */
function getRangeOutlineUrl(): string | undefined {
  const feederUrl = getFeederUrl();
  if (!feederUrl) return undefined;
  return "/data/outline.json";
}

/**
 * Reverse-engineered from tar1090's own `drawOutlineJson()` (`html/script.js`,
 * ~line 7316): prefer `multiRange` (already an array of rings) if present,
 * else fall back to `actualRange.last24h.points` (a single ring), else
 * `points` (also a single ring).
 */
function extractRings(data: RawOutlineJson): LatLonPair[][] {
  if (Array.isArray(data.multiRange) && data.multiRange.length > 0) {
    return data.multiRange;
  }
  const singleRing = data.actualRange?.last24h?.points ?? data.points;
  if (Array.isArray(singleRing) && singleRing.length > 0) {
    return [singleRing];
  }
  return [];
}

/**
 * Converts one `[lat, lon]` ring to a closed GeoJSON `[lon, lat]` ring
 * (first coordinate repeated at the end), matching tar1090's own
 * `j < points[p].length + 1` closing loop.
 */
function toClosedLngLatRing(ring: LatLonPair[]): [number, number][] {
  const converted: [number, number][] = ring.map(([lat, lon]) => [lon, lat]);
  if (converted.length === 0) return converted;
  const [firstLon, firstLat] = converted[0];
  const [lastLon, lastLat] = converted[converted.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) {
    converted.push([firstLon, firstLat]);
  }
  return converted;
}

/**
 * Builds a single-feature FeatureCollection: a `Polygon` when there's one
 * ring, or a `MultiPolygon` (one disjoint polygon per ring, not holes) when
 * `multiRange` reported more than one.
 */
function buildFeatureCollection(
  rawRings: LatLonPair[][],
): FeatureCollection<Polygon | MultiPolygon> {
  const rings = rawRings
    .map(toClosedLngLatRing)
    .filter((ring) => ring.length >= 4);
  if (rings.length === 0) return EMPTY_FEATURE_COLLECTION;

  const geometry: Polygon | MultiPolygon =
    rings.length === 1
      ? { type: "Polygon", coordinates: [rings[0]] }
      : { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) };

  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry }],
  };
}

/**
 * Fetches the feeder's own server-generated actual-range-outline data
 * (readsb's `data/outline.json`, same file tar1090's own `drawOutlineJson()`
 * reads) and parses it into GeoJSON polygon geometry. Returns an empty
 * FeatureCollection (not an error) when no feeder is configured, the
 * feeder's decoder never generates this file (a readsb-only feature —
 * plain dump1090-fa never populates it), the request fails, or the response
 * has no usable ring data — mirrors `tfr.ts`/`specialUseAirspace.ts`'s
 * "fail to empty, never error" convention.
 */
export async function fetchRangeOutline(): Promise<
  FeatureCollection<Polygon | MultiPolygon>
> {
  const url = getRangeOutlineUrl();
  if (!url) return EMPTY_FEATURE_COLLECTION;
  try {
    const response = await fetch(url);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    const data: RawOutlineJson = await response.json();
    const rawRings = extractRings(data);
    if (rawRings.length === 0) return EMPTY_FEATURE_COLLECTION;
    return buildFeatureCollection(rawRings);
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}

import type { Feature, FeatureCollection, LineString } from "geojson";
import { getFeederUrl } from "./constants";
import { toClosedLngLatRing } from "./rangeOutline";

const EMPTY_FEATURE_COLLECTION: FeatureCollection<
  LineString,
  { altitudeFt: number }
> = {
  type: "FeatureCollection",
  features: [],
};

type LatLonPair = [number, number];

interface RawRing {
  alt?: number;
  points?: LatLonPair[];
}

interface RawUpintheairJson {
  rings?: RawRing[];
}

const METERS_TO_FEET = 3.28084;

/**
 * Points at this app's own nginx sidecar, which proxies to the feeder's
 * upintheair.json server-side (see scripts/squawkmap3d.nginx.conf) — same
 * CORS gap and same fix as `rangeOutline.ts`'s `getRangeOutlineUrl()` for
 * outline.json (ultrafeeder's nginx only patches CORS onto aircraft.json's
 * location block).
 */
function getTerrainOutlineUrl(): string | undefined {
  const feederUrl = getFeederUrl();
  if (!feederUrl) return undefined;
  return "/upintheair.json";
}

/**
 * Converts one raw `rings[i]` entry into a `LineString` feature, or `null`
 * if it has too few points to form a ring (mirrors `rangeOutline.ts`'s own
 * `ring.length >= 4` closed-ring floor, expressed here as "fewer than 2
 * source points" per tasks.md 3.4).
 */
function toFeature(
  entry: RawRing,
): Feature<LineString, { altitudeFt: number }> | null {
  const points = entry.points;
  if (!Array.isArray(points) || points.length < 2) return null;
  const altitudeFt = Math.round((entry.alt ?? 0) * METERS_TO_FEET);
  return {
    type: "Feature",
    properties: { altitudeFt },
    geometry: {
      type: "LineString",
      coordinates: toClosedLngLatRing(points),
    },
  };
}

/**
 * Fetches the running feeder's own server-generated HeyWhatsThat terrain
 * outline data (`upintheair.json`, produced server-side by
 * `docker-tar1090`'s `06-range-outline` startup script from whatever
 * panorama the deployer configured via adsb.im's own setup UI) and parses
 * it into one closed `LineString` feature per altitude ring. Returns an
 * empty FeatureCollection (never throws) when no feeder is configured, the
 * feeder has no HeyWhatsThat panorama set up (a 404 — the file simply
 * doesn't exist server-side), the request fails, or the response has no
 * usable ring data — mirrors `rangeOutline.ts`/`tfr.ts`'s "fail to empty,
 * never error" convention.
 */
export async function fetchTerrainOutline(): Promise<
  FeatureCollection<LineString, { altitudeFt: number }>
> {
  const url = getTerrainOutlineUrl();
  if (!url) return EMPTY_FEATURE_COLLECTION;
  try {
    const response = await fetch(url);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    const data: RawUpintheairJson = await response.json();
    if (!Array.isArray(data.rings) || data.rings.length === 0) {
      return EMPTY_FEATURE_COLLECTION;
    }
    const features = data.rings
      .map(toFeature)
      .filter((feature): feature is Feature<LineString, { altitudeFt: number }> =>
        feature !== null,
      );
    if (features.length === 0) return EMPTY_FEATURE_COLLECTION;
    return { type: "FeatureCollection", features };
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}

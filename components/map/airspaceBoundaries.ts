import type { FeatureCollection } from "geojson";
import { AIRSPACE_BOUNDARIES_GEOJSON_URL } from "./constants";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Fetches current global FIR/UIR/oceanic ATC boundary polygons as GeoJSON
 * from VATSIM's `vatspy-data-project` feed. Returns an empty
 * FeatureCollection (not an error) on failure, so the layer stays
 * empty/unchanged rather than breaking the map.
 */
export async function fetchAirspaceBoundaries(): Promise<FeatureCollection> {
  try {
    const response = await fetch(AIRSPACE_BOUNDARIES_GEOJSON_URL);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    return await response.json();
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}

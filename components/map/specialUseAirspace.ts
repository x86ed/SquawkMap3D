import type { FeatureCollection } from "geojson";
import { SUA_FEATURE_SERVICE_QUERY_URL } from "./constants";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Fetches current US Special Use Airspace (restricted, prohibited, warning,
 * alert, MOA) polygons as GeoJSON from FAA's ArcGIS-hosted feature service.
 * Returns an empty FeatureCollection (not an error) on failure, so the
 * layer stays empty/unchanged rather than breaking the map.
 */
export async function fetchSpecialUseAirspace(): Promise<FeatureCollection> {
  try {
    const response = await fetch(SUA_FEATURE_SERVICE_QUERY_URL);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    return await response.json();
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}

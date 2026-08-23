import type { FeatureCollection } from "geojson";
import { TFR_FEED_URL } from "./constants";

const EMPTY_FEATURE_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Fetches current US Temporary Flight Restrictions as GeoJSON. Returns an
 * empty FeatureCollection (not an error) when `TFR_FEED_URL` is unset — no
 * live public feed was available at implementation time — or when the fetch
 * fails, so the layer stays empty rather than breaking the map.
 */
export async function fetchTfrs(): Promise<FeatureCollection> {
  if (!TFR_FEED_URL) return EMPTY_FEATURE_COLLECTION;
  try {
    const response = await fetch(TFR_FEED_URL);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    return await response.json();
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}

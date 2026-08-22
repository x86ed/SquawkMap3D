import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { GeoCoords } from "./geolocation";
import { METERS_PER_NM, RANGE_RING_RADII_NM } from "./constants";

export const USER_DISH_SOURCE_ID = "user-dish";
export const USER_DISH_LAYER_ID = "user-dish-fill-extrusion";

export const USER_RINGS_SOURCE_ID = "user-rings";
export const USER_RINGS_LINE_LAYER_ID = "user-rings-line";
export const USER_RINGS_LABEL_LAYER_ID = "user-rings-label";

// Stacked octagon-footprint tiers (bottom to top) that together read as a
// stepped, tapering dish/tower silhouette — see design.md decision 3.
const DISH_TIERS = [
  { radius: 12, base: 0, height: 8 },
  { radius: 7, base: 8, height: 14 },
  { radius: 3, base: 14, height: 18 },
] as const;

const DISH_FILL_COLOR = "#e6e6e6";
const DISH_FILL_OPACITY = 0.9;
const RING_LINE_COLOR = "#ff3b3b";
const RING_LINE_WIDTH = 1.5;

/**
 * Pure geometry builder: computes the dish tiers and range rings/labels
 * around `coords`. No map dependency, no side effects.
 */
export function buildUserLocationFeatures(
  coords: GeoCoords,
): { dish: FeatureCollection; rings: FeatureCollection } {
  const center: [number, number] = [coords.longitude, coords.latitude];

  const dishFeatures: Feature[] = DISH_TIERS.map((tier) => {
    const polygon = turf.circle(center, tier.radius, {
      steps: 8,
      units: "meters",
    });
    polygon.properties = { base: tier.base, height: tier.height };
    return polygon;
  });

  const ringFeatures: Feature[] = RANGE_RING_RADII_NM.flatMap((radiusNM) => {
    const ring = turf.circle(center, radiusNM * METERS_PER_NM, {
      steps: 128,
      units: "meters",
    });
    const line = turf.polygonToLine(ring) as Feature;
    line.properties = { label: `${radiusNM} NM` };

    const label = turf.destination(center, radiusNM, 0, {
      units: "nauticalmiles",
    });
    label.properties = { label: `${radiusNM} NM` };

    return [line, label];
  });

  return {
    dish: turf.featureCollection(dishFeatures),
    rings: turf.featureCollection(ringFeatures),
  };
}

/**
 * Idempotently adds (or updates) the dish and range-ring sources/layers,
 * mirroring `addCustomLayers`'s idempotency so it can be re-invoked after
 * `style.load` (theme swap) and on repeated location resolution. No-ops if
 * `coords` is `null` (location never resolved).
 *
 * The rings source holds both LineString (ring outlines) and Point (labels)
 * features in one FeatureCollection; the two layers filter by geometry type
 * rather than splitting into two sources, per design.md decision 4.
 */
export function addUserLocationLayers(
  map: MapLibreMap,
  coords: GeoCoords | null,
): void {
  if (!coords) return;

  const { dish, rings } = buildUserLocationFeatures(coords);

  const dishSource = map.getSource(USER_DISH_SOURCE_ID);
  if (!dishSource) {
    map.addSource(USER_DISH_SOURCE_ID, { type: "geojson", data: dish });
  } else {
    dishSource.setData(dish);
  }

  const ringsSource = map.getSource(USER_RINGS_SOURCE_ID);
  if (!ringsSource) {
    map.addSource(USER_RINGS_SOURCE_ID, { type: "geojson", data: rings });
  } else {
    ringsSource.setData(rings);
  }

  if (!map.getLayer(USER_DISH_LAYER_ID)) {
    map.addLayer({
      id: USER_DISH_LAYER_ID,
      type: "fill-extrusion",
      source: USER_DISH_SOURCE_ID,
      paint: {
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-color": DISH_FILL_COLOR,
        "fill-extrusion-opacity": DISH_FILL_OPACITY,
      },
    });
  }

  if (!map.getLayer(USER_RINGS_LINE_LAYER_ID)) {
    map.addLayer({
      id: USER_RINGS_LINE_LAYER_ID,
      type: "line",
      source: USER_RINGS_SOURCE_ID,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": RING_LINE_COLOR,
        "line-width": RING_LINE_WIDTH,
      },
    });
  }

  if (!map.getLayer(USER_RINGS_LABEL_LAYER_ID)) {
    map.addLayer({
      id: USER_RINGS_LABEL_LAYER_ID,
      type: "symbol",
      source: USER_RINGS_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-anchor": "bottom",
      },
      paint: {
        "text-color": RING_LINE_COLOR,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }
}

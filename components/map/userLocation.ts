import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { GeoCoords } from "./geolocation";
import { METERS_PER_NM, RANGE_RING_RADII_NM } from "./constants";
import { USER_LOCATION_ICON_ID, registerUserLocationIconResolver } from "./userLocationIcon";

export const USER_LOCATION_SOURCE_ID = "user-location";
export const USER_LOCATION_ICON_LAYER_ID = "user-location-icon";

export const USER_RINGS_SOURCE_ID = "user-rings";
export const USER_RINGS_LINE_LAYER_ID = "user-rings-line";
export const USER_RINGS_LABEL_LAYER_ID = "user-rings-label";

const RING_LINE_COLOR = "#00b8db";
const RING_LINE_WIDTH = 1.5;

function buildUserLocationPoint(center: [number, number]): Feature<Point> {
  return turf.point(center);
}

/**
 * Pure geometry builder: computes the user-location point and range
 * rings/labels around `coords`. No map dependency, no side effects.
 */
export function buildUserLocationFeatures(
  coords: GeoCoords,
): { marker: FeatureCollection; rings: FeatureCollection } {
  const center: [number, number] = [coords.longitude, coords.latitude];

  const markerFeatures: Feature[] = [buildUserLocationPoint(center)];

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
    marker: turf.featureCollection(markerFeatures),
    rings: turf.featureCollection(ringFeatures),
  };
}

/**
 * Bounding box (`[[west, south], [east, north]]`, suitable for
 * `map.fitBounds`) that encloses the outermost range ring around `coords`.
 * The rings' real-world radii (up to 200 NM / ~370km) are far larger than
 * what a fixed `flyTo` zoom can guarantee fits on screen across different
 * viewport sizes, so callers should `fitBounds` to this instead of flying to
 * a hardcoded zoom if they want the rings visible on arrival.
 */
export function getUserLocationBounds(
  coords: GeoCoords,
): [[number, number], [number, number]] {
  const outermostRadiusNM = Math.max(...RANGE_RING_RADII_NM);
  const circle = turf.circle(
    [coords.longitude, coords.latitude],
    outermostRadiusNM * METERS_PER_NM,
    { steps: 64, units: "meters" },
  );
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(circle);
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/**
 * Idempotently adds (or updates) the user-location icon and range-ring
 * sources/layers, mirroring `addCustomLayers`'s idempotency so it can be
 * re-invoked after `style.load` (theme swap) and on repeated location
 * resolution. No-ops if `coords` is `null` (location never resolved).
 * Also (re-)registers the icon's `missingStyleImageResolver` so the symbol
 * layer's icon resolves after a theme swap re-requests it.
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

  registerUserLocationIconResolver(map, RING_LINE_COLOR);

  const { marker, rings } = buildUserLocationFeatures(coords);

  const markerSource = map.getSource(USER_LOCATION_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
  if (!markerSource) {
    map.addSource(USER_LOCATION_SOURCE_ID, { type: "geojson", data: marker });
  } else {
    markerSource.setData(marker);
  }

  const ringsSource = map.getSource(USER_RINGS_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
  if (!ringsSource) {
    map.addSource(USER_RINGS_SOURCE_ID, { type: "geojson", data: rings });
  } else {
    ringsSource.setData(rings);
  }

  if (!map.getLayer(USER_LOCATION_ICON_LAYER_ID)) {
    map.addLayer({
      id: USER_LOCATION_ICON_LAYER_ID,
      type: "symbol",
      source: USER_LOCATION_SOURCE_ID,
      layout: {
        "icon-image": USER_LOCATION_ICON_ID,
        "icon-allow-overlap": true,
        "icon-anchor": "center",
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

/**
 * Shows/hides the user-location icon and range rings (+ labels) together as
 * one combined layer, matching the acceptance criteria's single toggle for
 * "the rings plus the user icon". Independent of pilot mode, same as
 * `setMilitaryBasesVisibility` and friends in `layers.ts`.
 */
export function setUserLocationVisibility(map: MapLibreMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(USER_LOCATION_ICON_LAYER_ID)) {
    map.setLayoutProperty(USER_LOCATION_ICON_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(USER_RINGS_LINE_LAYER_ID)) {
    map.setLayoutProperty(USER_RINGS_LINE_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(USER_RINGS_LABEL_LAYER_ID)) {
    map.setLayoutProperty(USER_RINGS_LABEL_LAYER_ID, "visibility", visibility);
  }
}

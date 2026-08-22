import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { GeoCoords } from "./geolocation";
import { METERS_PER_NM, RANGE_RING_RADII_NM } from "./constants";

export const USER_DISH_SOURCE_ID = "user-dish";
export const USER_DISH_LAYER_ID = "user-dish-fill-extrusion";

export const USER_RINGS_SOURCE_ID = "user-rings";
export const USER_RINGS_LINE_LAYER_ID = "user-rings-line";
export const USER_RINGS_LABEL_LAYER_ID = "user-rings-label";

// Radar mast: a short octagon pedestal topped by a long, thin rotating
// "blade" spanning through the pivot — reads as a rotating radar antenna
// (like a search-radar sweep) rather than a static satellite dish, and pairs
// naturally with `startDishRotation` below, which spins the blade in place.
// `fill-extrusion` can't tilt a face to fake a parabolic dish, so a spinning
// bar is the shape this geometry type can actually deliver on.
const PEDESTAL_TIER = { radius: 90, base: 0, height: 300 } as const;
const BLADE_TIER = {
  halfLengthMeters: 300,
  widthMeters: 90,
  base: 300,
  height: 350,
} as const;

// Sized well above literal real-world radar-mast dimensions so the marker is
// actually visible at the zoom level the map lands on after a location
// resolves — see design.md's "Marker scale vs. ring scale" addendum. A
// literally-scaled mast is sub-pixel at any zoom wide enough to show even the
// nearest (50 NM) range ring, so this is a deliberate stylized scale, not a
// to-scale model.

const DISH_FILL_COLOR = "#e6e6e6";
const DISH_BLADE_FILL_COLOR = "#ff3b3b";
const DISH_FILL_OPACITY = 0.9;
const RING_LINE_COLOR = "#ff3b3b";
const RING_LINE_WIDTH = 1.5;

const DISH_ROTATION_DEG_PER_SEC = 60;
const DISH_ROTATION_UPDATE_INTERVAL_MS = 80;

function buildDishPedestal(center: [number, number]): Feature {
  const polygon = turf.circle(center, PEDESTAL_TIER.radius, {
    steps: 8,
    units: "meters",
  });
  polygon.properties = {
    part: "pedestal",
    base: PEDESTAL_TIER.base,
    height: PEDESTAL_TIER.height,
  };
  return polygon;
}

/** Blade at rotation angle 0: a stadium shape spanning through `center`. */
function buildDishBlade(center: [number, number]): Feature<Polygon> {
  const west = turf.destination(center, BLADE_TIER.halfLengthMeters, -90, {
    units: "meters",
  });
  const east = turf.destination(center, BLADE_TIER.halfLengthMeters, 90, {
    units: "meters",
  });
  const spine = turf.lineString([
    west.geometry.coordinates,
    east.geometry.coordinates,
  ]);
  const blade = turf.buffer(spine, BLADE_TIER.widthMeters / 2, {
    units: "meters",
  }) as Feature<Polygon>;
  blade.properties = {
    part: "blade",
    base: BLADE_TIER.base,
    height: BLADE_TIER.height,
  };
  return blade;
}

/**
 * Starts a continuous rotation animation of the dish's blade around `coords`,
 * repainting the dish source in place. Returns a stop function; callers must
 * call it before starting another rotation (e.g. on re-jump or unmount) —
 * a leaked `requestAnimationFrame` loop keeps calling `setData` forever.
 */
export function startDishRotation(
  map: MapLibreMap,
  coords: GeoCoords,
): () => void {
  const pivot: [number, number] = [coords.longitude, coords.latitude];
  const pedestal = buildDishPedestal(pivot);
  let blade = buildDishBlade(pivot);
  let lastUpdateTime: number | null = null;
  let stopped = false;
  let rafId: number;

  const tick = (time: number) => {
    if (stopped) return;
    if (lastUpdateTime === null) {
      lastUpdateTime = time;
    } else if (time - lastUpdateTime >= DISH_ROTATION_UPDATE_INTERVAL_MS) {
      const deltaDeg =
        (DISH_ROTATION_DEG_PER_SEC * (time - lastUpdateTime)) / 1000;
      blade = turf.transformRotate(blade, deltaDeg, {
        pivot,
      }) as Feature<Polygon>;
      lastUpdateTime = time;
      const source = map.getSource(USER_DISH_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      source?.setData(turf.featureCollection([pedestal, blade]));
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * Pure geometry builder: computes the dish (pedestal + blade at rotation
 * angle 0) and range rings/labels around `coords`. No map dependency, no
 * side effects.
 */
export function buildUserLocationFeatures(
  coords: GeoCoords,
): { dish: FeatureCollection; rings: FeatureCollection } {
  const center: [number, number] = [coords.longitude, coords.latitude];

  const dishFeatures: Feature[] = [
    buildDishPedestal(center),
    buildDishBlade(center),
  ];

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

  const dishSource = map.getSource(USER_DISH_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
  if (!dishSource) {
    map.addSource(USER_DISH_SOURCE_ID, { type: "geojson", data: dish });
  } else {
    dishSource.setData(dish);
  }

  const ringsSource = map.getSource(USER_RINGS_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
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
        "fill-extrusion-color": [
          "match",
          ["get", "part"],
          "blade",
          DISH_BLADE_FILL_COLOR,
          DISH_FILL_COLOR,
        ],
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

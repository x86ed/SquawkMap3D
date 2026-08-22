import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapTheme } from "./mapStyles";
import {
  FAA_SECTIONAL_TILE_URL,
  FAA_SECTIONAL_MINZOOM,
  FAA_SECTIONAL_MAXZOOM,
} from "./constants";

export const AIRPORTS_SOURCE_ID = "airports";
export const AIRPORTS_LAYER_ID = "airports-circle";

export const MILITARY_SOURCE_ID = "military-bases";
export const MILITARY_FILL_LAYER_ID = "military-bases-fill";
export const MILITARY_LINE_LAYER_ID = "military-bases-line";

export const FAA_SECTIONAL_SOURCE_ID = "faa-sectional";
export const FAA_SECTIONAL_LAYER_ID = "pilot-sectional";

const CUSTOM_LAYER_IDS = [
  FAA_SECTIONAL_LAYER_ID,
  MILITARY_FILL_LAYER_ID,
  MILITARY_LINE_LAYER_ID,
  AIRPORTS_LAYER_ID,
];

// Saturated orange — reads clearly against both the light and dark
// MapTiler outdoor styles.
const AIRPORT_FILL_COLOR = "#ff6a00";
// Olive/drab — distinct from the airport orange and from the basemap's
// greens/tans in both themes.
const MILITARY_FILL_COLOR = "#5c5c1f";
const MILITARY_LINE_COLOR = "#3d3d14";

function haloColorFor(theme: MapTheme): string {
  return theme === "dark" ? "#0a0a0a" : "#ffffff";
}

/**
 * Adds (or idempotently re-adds) the FAA sectional, military-base,
 * and airport sources/layers, in that stacking order (sectional at the
 * bottom, airports on top). Must be re-run on initial load and on every
 * `style.load` (post `setStyle`), since MapLibre discards custom
 * sources/layers on a style swap.
 */
export function addCustomLayers(map: MapLibreMap, theme: MapTheme): void {
  if (!map.getSource(FAA_SECTIONAL_SOURCE_ID)) {
    map.addSource(FAA_SECTIONAL_SOURCE_ID, {
      type: "raster",
      tiles: [FAA_SECTIONAL_TILE_URL],
      tileSize: 256,
      minzoom: FAA_SECTIONAL_MINZOOM,
      maxzoom: FAA_SECTIONAL_MAXZOOM,
      attribution: "FAA VFR Sectional",
    });
  }
  if (!map.getLayer(FAA_SECTIONAL_LAYER_ID)) {
    map.addLayer({
      id: FAA_SECTIONAL_LAYER_ID,
      type: "raster",
      source: FAA_SECTIONAL_SOURCE_ID,
      layout: { visibility: "none" },
    });
  }

  if (!map.getSource(MILITARY_SOURCE_ID)) {
    map.addSource(MILITARY_SOURCE_ID, {
      type: "geojson",
      data: "/data/military-bases.geojson",
    });
  }
  if (!map.getLayer(MILITARY_FILL_LAYER_ID)) {
    map.addLayer({
      id: MILITARY_FILL_LAYER_ID,
      type: "fill",
      source: MILITARY_SOURCE_ID,
      paint: {
        "fill-color": MILITARY_FILL_COLOR,
        "fill-opacity": 0.35,
      },
    });
  }
  if (!map.getLayer(MILITARY_LINE_LAYER_ID)) {
    map.addLayer({
      id: MILITARY_LINE_LAYER_ID,
      type: "line",
      source: MILITARY_SOURCE_ID,
      paint: {
        "line-color": MILITARY_LINE_COLOR,
        "line-width": 1.5,
      },
    });
  }

  if (!map.getSource(AIRPORTS_SOURCE_ID)) {
    map.addSource(AIRPORTS_SOURCE_ID, {
      type: "geojson",
      data: "/data/airports.geojson",
    });
  }
  if (!map.getLayer(AIRPORTS_LAYER_ID)) {
    map.addLayer({
      id: AIRPORTS_LAYER_ID,
      type: "circle",
      source: AIRPORTS_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          2,
          8,
          5,
          12,
          8,
        ],
        "circle-color": AIRPORT_FILL_COLOR,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": haloColorFor(theme),
      },
    });
  } else {
    map.setPaintProperty(
      AIRPORTS_LAYER_ID,
      "circle-stroke-color",
      haloColorFor(theme),
    );
  }
}

/**
 * Shows/hides the FAA sectional overlay, and hides/restores the
 * base style's own layers underneath it so pilot mode reads as a distinct
 * aviation chart rather than a raster smeared on top of the topo basemap.
 */
export function setPilotModeVisibility(map: MapLibreMap, enabled: boolean): void {
  if (map.getLayer(FAA_SECTIONAL_LAYER_ID)) {
    map.setLayoutProperty(
      FAA_SECTIONAL_LAYER_ID,
      "visibility",
      enabled ? "visible" : "none",
    );
  }

  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type === "background" || CUSTOM_LAYER_IDS.includes(layer.id)) {
      continue;
    }
    map.setLayoutProperty(layer.id, "visibility", enabled ? "none" : "visible");
  }
}

import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapTheme } from "./mapStyles";
import {
  AIRPORT_ICON_PIXEL_RATIO,
  AIRPORT_ICON_RASTER_SIZE,
  airportIconImageId,
  registerAirportIconResolver,
} from "./airportIcon";
import { TERMINATOR_LAYER_IDS } from "./terminator";
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
  ...TERMINATOR_LAYER_IDS,
];

// Foreground color of the airport icon's glyph (see airportIcon.ts), one per
// map view so it reads clearly against each. Must not be white: earlier the
// icon's negative space was rasterized to solid white and this color was
// also white, so the glyph was invisible against its own backing — the icon
// rendered as a plain white dot, indistinguishable from the old circle
// marker, until that was caught in a real-browser screenshot.
export const AIRPORT_FILL_COLOR: Record<MapTheme, string> = {
  light: "#6600ff",
  dark: "#ce00ff",
};
// Olive/drab — distinct from the airport orange and from the basemap's
// greens/tans in both themes.
const MILITARY_FILL_COLOR = "#ed6bff";
const MILITARY_LINE_COLOR = "#e12afb";

// Zoom -> icon-size stops for the airports symbol layer, and the single
// source of truth for `getAirportIconDisplayHeight` below (which popup
// placement uses to offset by half the icon's on-screen height) — both
// must agree on the same interpolation, so neither hardcodes its own copy.
const AIRPORT_ICON_SIZE_STOPS: Array<[zoom: number, size: number]> = [
  [3, 0.3],
  [8, 0.7],
  [12, 1.1],
];

/**
 * The airport icon's rendered height in screen pixels at `zoom`, replicating
 * the `icon-size` interpolation above. `AIRPORT_ICON_RASTER_SIZE /
 * AIRPORT_ICON_PIXEL_RATIO` is the icon's natural display size (CSS px) at
 * `icon-size: 1`; `icon-anchor: "bottom"` means the icon spans upward from
 * the feature's coordinate by exactly this height.
 */
export function getAirportIconDisplayHeight(zoom: number): number {
  const stops = AIRPORT_ICON_SIZE_STOPS;
  let size = stops[stops.length - 1][1];
  if (zoom <= stops[0][0]) {
    size = stops[0][1];
  } else {
    for (let i = 0; i < stops.length - 1; i++) {
      const [z0, s0] = stops[i];
      const [z1, s1] = stops[i + 1];
      if (zoom >= z0 && zoom <= z1) {
        size = s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
        break;
      }
    }
  }
  return (AIRPORT_ICON_RASTER_SIZE / AIRPORT_ICON_PIXEL_RATIO) * size;
}

/**
 * Adds (or idempotently re-adds) the FAA sectional, military-base,
 * and airport sources/layers, in that stacking order (sectional at the
 * bottom, airports on top). Must be re-run on initial load and on every
 * `style.load` (post `setStyle`), since MapLibre discards custom
 * sources/layers on a style swap.
 *
 * `militaryVisible`/`airportsVisible` set the initial visibility of the
 * re-added military-base/airport layers so a user's toggle choice survives a
 * style swap (theme change) — callers that already persist this choice (e.g.
 * a ref) should pass it through on every re-add.
 */
export function addCustomLayers(
  map: MapLibreMap,
  theme: MapTheme,
  militaryVisible = true,
  airportsVisible = true,
): void {
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
  const militaryVisibility = militaryVisible ? "visible" : "none";
  if (!map.getLayer(MILITARY_FILL_LAYER_ID)) {
    map.addLayer({
      id: MILITARY_FILL_LAYER_ID,
      type: "fill",
      source: MILITARY_SOURCE_ID,
      layout: { visibility: militaryVisibility },
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
      layout: { visibility: militaryVisibility },
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
  // Must be installed before the symbol layer below is (re)added: a
  // GeoJSON source's symbol bucket resolves `icon-image` in the tile
  // worker shortly after `addSource`, and only a registered
  // `missingStyleImageResolver` is awaited by that resolution — see
  // `registerAirportIconResolver`'s doc comment for why a bare
  // `map.addImage` call after the fact can't fix an already-built bucket.
  registerAirportIconResolver(map, AIRPORT_FILL_COLOR);
  const airportsVisibility = airportsVisible ? "visible" : "none";
  if (!map.getLayer(AIRPORTS_LAYER_ID)) {
    map.addLayer({
      id: AIRPORTS_LAYER_ID,
      type: "symbol",
      source: AIRPORTS_SOURCE_ID,
      layout: {
        visibility: airportsVisibility,
        "icon-image": airportIconImageId(theme),
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          ...AIRPORT_ICON_SIZE_STOPS.flat(),
        ],
      },
    });
  } else {
    map.setLayoutProperty(
      AIRPORTS_LAYER_ID,
      "icon-image",
      airportIconImageId(theme),
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

/**
 * Shows/hides the military-base layers. Independent of pilot mode: military
 * bases are exempt from `setPilotModeVisibility`'s base-style hide/restore
 * (see `CUSTOM_LAYER_IDS`), so this toggle works the same whether pilot mode
 * is on or off.
 */
export function setMilitaryBasesVisibility(map: MapLibreMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(MILITARY_FILL_LAYER_ID)) {
    map.setLayoutProperty(MILITARY_FILL_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(MILITARY_LINE_LAYER_ID)) {
    map.setLayoutProperty(MILITARY_LINE_LAYER_ID, "visibility", visibility);
  }
}

/**
 * Shows/hides the airports layer. Independent of pilot mode, same as
 * military bases (see `setMilitaryBasesVisibility`).
 */
export function setAirportsVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(AIRPORTS_LAYER_ID)) {
    map.setLayoutProperty(
      AIRPORTS_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

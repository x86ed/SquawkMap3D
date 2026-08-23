import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
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
  OPENAIP_TILE_URL_TEMPLATE,
  OPENAIP_TILE_SUBDOMAINS,
  OPENAIP_MINZOOM,
  OPENAIP_MAXZOOM,
  getOpenAipApiKey,
  NEXRAD_TILE_URL,
  NEXRAD_MINZOOM,
  NEXRAD_MAXZOOM,
  NOAA_RADAR_WMS_BASE_URL,
  NOAA_RADAR_WMS_LAYER,
  NOAA_INFRARED_TILE_URL,
  NOAA_INFRARED_MINZOOM,
  NOAA_INFRARED_MAXZOOM,
  DWD_RADOLAN_WMS_BASE_URL,
  DWD_RADOLAN_WMS_LAYER,
} from "./constants";
import { fetchCurrentRainViewerTileUrl } from "./rainviewer";
import { fetchTfrs } from "./tfr";
import { fetchSpecialUseAirspace } from "./specialUseAirspace";
import { fetchAirspaceBoundaries } from "./airspaceBoundaries";

export const AIRPORTS_SOURCE_ID = "airports";
export const AIRPORTS_LAYER_ID = "airports-circle";

export const MILITARY_SOURCE_ID = "military-bases";
export const MILITARY_FILL_LAYER_ID = "military-bases-fill";
export const MILITARY_LINE_LAYER_ID = "military-bases-line";

export const FAA_SECTIONAL_SOURCE_ID = "faa-sectional";
export const FAA_SECTIONAL_LAYER_ID = "pilot-sectional";

export const OPENAIP_SOURCE_ID = "openaip";
export const OPENAIP_LAYER_ID = "openaip-raster";

export const RAINVIEWER_SOURCE_ID = "rainviewer-radar";
export const RAINVIEWER_LAYER_ID = "rainviewer-radar-raster";

export const TFR_SOURCE_ID = "tfr";
export const TFR_FILL_LAYER_ID = "tfr-fill";
export const TFR_LINE_LAYER_ID = "tfr-line";

export const SUA_SOURCE_ID = "special-use-airspace";
export const SUA_FILL_LAYER_ID = "special-use-airspace-fill";
export const SUA_LINE_LAYER_ID = "special-use-airspace-line";

export const AIRSPACE_BOUNDARIES_SOURCE_ID = "airspace-boundaries";
export const AIRSPACE_BOUNDARIES_LINE_LAYER_ID = "airspace-boundaries-line";

export const NEXRAD_SOURCE_ID = "nexrad";
export const NEXRAD_LAYER_ID = "nexrad-raster";

export const NOAA_INFRARED_SOURCE_ID = "noaa-infrared";
export const NOAA_INFRARED_LAYER_ID = "noaa-infrared-raster";

export const NOAA_RADAR_SOURCE_ID = "noaa-radar";
export const NOAA_RADAR_LAYER_ID = "noaa-radar-raster";

export const DWD_RADOLAN_SOURCE_ID = "dwd-radolan";
export const DWD_RADOLAN_LAYER_ID = "dwd-radolan-raster";

const CUSTOM_LAYER_IDS = [
  FAA_SECTIONAL_LAYER_ID,
  MILITARY_FILL_LAYER_ID,
  MILITARY_LINE_LAYER_ID,
  AIRPORTS_LAYER_ID,
  OPENAIP_LAYER_ID,
  RAINVIEWER_LAYER_ID,
  TFR_FILL_LAYER_ID,
  TFR_LINE_LAYER_ID,
  SUA_FILL_LAYER_ID,
  SUA_LINE_LAYER_ID,
  AIRSPACE_BOUNDARIES_LINE_LAYER_ID,
  NEXRAD_LAYER_ID,
  NOAA_INFRARED_LAYER_ID,
  NOAA_RADAR_LAYER_ID,
  DWD_RADOLAN_LAYER_ID,
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

// Red — the conventional aviation-chart color for TFRs, and distinct from
// special use airspace's amber and military bases' pink.
const TFR_FILL_COLOR = "#ff3b30";
const TFR_LINE_COLOR = "#d1001f";

// Amber — distinct from TFR red and military bases' pink.
const SUA_FILL_COLOR = "#ff9500";
const SUA_LINE_COLOR = "#c96f00";

// Cool blue/cyan — distinct from the warm palette above (military's magenta,
// TFR's red, SUA's amber), so FIR/UIR boundaries stay legible when layered
// with those filled-polygon layers.
const AIRSPACE_BOUNDARIES_LINE_COLOR = "#2fd0ff";

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

/** Initial visibility for each toggleable custom layer, keyed by the same
 * names used in `MapView.tsx`'s state/ref pairs. Passed through on every
 * `addCustomLayers` call (initial load and every `style.load`) so a user's
 * toggle choices survive a theme-triggered style swap. */
export interface CustomLayerVisibility {
  military?: boolean;
  airports?: boolean;
  openAip?: boolean;
  rainViewer?: boolean;
  tfr?: boolean;
  specialUseAirspace?: boolean;
  airspaceBoundaries?: boolean;
  nexrad?: boolean;
  noaaInfrared?: boolean;
  noaaRadar?: boolean;
  dwdRadolan?: boolean;
}

function wmsRasterTileUrl(baseUrl: string, layer: string): string {
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: layer,
    styles: "",
    format: "image/png",
    transparent: "true",
    crs: "EPSG:3857",
    width: "256",
    height: "256",
  });
  return `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`;
}

/**
 * Adds (or idempotently re-adds) the FAA sectional, military-base,
 * airport, and weather/airspace overlay sources/layers, in that stacking
 * order (sectional at the bottom, airports on top). Must be re-run on
 * initial load and on every `style.load` (post `setStyle`), since MapLibre
 * discards custom sources/layers on a style swap.
 *
 * `visibility` sets the initial visibility of each re-added toggleable
 * layer so a user's toggle choices survive a style swap (theme change) —
 * callers that already persist this choice (e.g. a ref) should pass it
 * through on every re-add.
 */
export function addCustomLayers(
  map: MapLibreMap,
  theme: MapTheme,
  visibility: CustomLayerVisibility = {},
): void {
  const militaryVisible = visibility.military ?? true;
  const airportsVisible = visibility.airports ?? true;
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

  const openAipApiKey = getOpenAipApiKey();
  if (openAipApiKey && !map.getSource(OPENAIP_SOURCE_ID)) {
    map.addSource(OPENAIP_SOURCE_ID, {
      type: "raster",
      tiles: OPENAIP_TILE_SUBDOMAINS.map((subdomain) =>
        `${OPENAIP_TILE_URL_TEMPLATE.replace("{s}", subdomain)}?apiKey=${openAipApiKey}`,
      ),
      tileSize: 256,
      minzoom: OPENAIP_MINZOOM,
      maxzoom: OPENAIP_MAXZOOM,
      attribution: "© OpenAIP",
    });
  }
  if (openAipApiKey && !map.getLayer(OPENAIP_LAYER_ID)) {
    map.addLayer({
      id: OPENAIP_LAYER_ID,
      type: "raster",
      source: OPENAIP_SOURCE_ID,
      layout: { visibility: (visibility.openAip ?? true) ? "visible" : "none" },
    });
  }

  if (!map.getSource(TFR_SOURCE_ID)) {
    map.addSource(TFR_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  const tfrVisibility = (visibility.tfr ?? true) ? "visible" : "none";
  if (!map.getLayer(TFR_FILL_LAYER_ID)) {
    map.addLayer({
      id: TFR_FILL_LAYER_ID,
      type: "fill",
      source: TFR_SOURCE_ID,
      layout: { visibility: tfrVisibility },
      paint: { "fill-color": TFR_FILL_COLOR, "fill-opacity": 0.25 },
    });
  }
  if (!map.getLayer(TFR_LINE_LAYER_ID)) {
    map.addLayer({
      id: TFR_LINE_LAYER_ID,
      type: "line",
      source: TFR_SOURCE_ID,
      layout: { visibility: tfrVisibility },
      paint: { "line-color": TFR_LINE_COLOR, "line-width": 2 },
    });
  }

  if (!map.getSource(SUA_SOURCE_ID)) {
    map.addSource(SUA_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  const suaVisibility = (visibility.specialUseAirspace ?? true) ? "visible" : "none";
  if (!map.getLayer(SUA_FILL_LAYER_ID)) {
    map.addLayer({
      id: SUA_FILL_LAYER_ID,
      type: "fill",
      source: SUA_SOURCE_ID,
      layout: { visibility: suaVisibility },
      paint: { "fill-color": SUA_FILL_COLOR, "fill-opacity": 0.2 },
    });
  }
  if (!map.getLayer(SUA_LINE_LAYER_ID)) {
    map.addLayer({
      id: SUA_LINE_LAYER_ID,
      type: "line",
      source: SUA_SOURCE_ID,
      layout: { visibility: suaVisibility },
      paint: { "line-color": SUA_LINE_COLOR, "line-width": 1.5 },
    });
  }

  if (!map.getSource(NEXRAD_SOURCE_ID)) {
    map.addSource(NEXRAD_SOURCE_ID, {
      type: "raster",
      tiles: [NEXRAD_TILE_URL],
      tileSize: 256,
      minzoom: NEXRAD_MINZOOM,
      maxzoom: NEXRAD_MAXZOOM,
      attribution: "NEXRAD via Iowa Environmental Mesonet",
    });
  }
  if (!map.getLayer(NEXRAD_LAYER_ID)) {
    map.addLayer({
      id: NEXRAD_LAYER_ID,
      type: "raster",
      source: NEXRAD_SOURCE_ID,
      layout: { visibility: (visibility.nexrad ?? true) ? "visible" : "none" },
      paint: { "raster-opacity": 0.75 },
    });
  }

  if (!map.getSource(NOAA_RADAR_SOURCE_ID)) {
    map.addSource(NOAA_RADAR_SOURCE_ID, {
      type: "raster",
      tiles: [wmsRasterTileUrl(NOAA_RADAR_WMS_BASE_URL, NOAA_RADAR_WMS_LAYER)],
      tileSize: 256,
      attribution: "NOAA/NWS nowCOAST",
    });
  }
  if (!map.getLayer(NOAA_RADAR_LAYER_ID)) {
    map.addLayer({
      id: NOAA_RADAR_LAYER_ID,
      type: "raster",
      source: NOAA_RADAR_SOURCE_ID,
      layout: { visibility: (visibility.noaaRadar ?? true) ? "visible" : "none" },
      paint: { "raster-opacity": 0.75 },
    });
  }

  if (NOAA_INFRARED_TILE_URL && !map.getSource(NOAA_INFRARED_SOURCE_ID)) {
    map.addSource(NOAA_INFRARED_SOURCE_ID, {
      type: "raster",
      tiles: [NOAA_INFRARED_TILE_URL],
      tileSize: 256,
      minzoom: NOAA_INFRARED_MINZOOM,
      maxzoom: NOAA_INFRARED_MAXZOOM,
      attribution: "NOAA GOES",
    });
  }
  if (NOAA_INFRARED_TILE_URL && !map.getLayer(NOAA_INFRARED_LAYER_ID)) {
    map.addLayer({
      id: NOAA_INFRARED_LAYER_ID,
      type: "raster",
      source: NOAA_INFRARED_SOURCE_ID,
      layout: {
        visibility: (visibility.noaaInfrared ?? true) ? "visible" : "none",
      },
    });
  }

  if (!map.getSource(DWD_RADOLAN_SOURCE_ID)) {
    map.addSource(DWD_RADOLAN_SOURCE_ID, {
      type: "raster",
      tiles: [wmsRasterTileUrl(DWD_RADOLAN_WMS_BASE_URL, DWD_RADOLAN_WMS_LAYER)],
      tileSize: 256,
      attribution: "© Deutscher Wetterdienst",
    });
  }
  if (!map.getLayer(DWD_RADOLAN_LAYER_ID)) {
    map.addLayer({
      id: DWD_RADOLAN_LAYER_ID,
      type: "raster",
      source: DWD_RADOLAN_SOURCE_ID,
      layout: {
        visibility: (visibility.dwdRadolan ?? true) ? "visible" : "none",
      },
      paint: { "raster-opacity": 0.75 },
    });
  }

  // RainViewer's tile URL depends on the current frame timestamp, resolved
  // asynchronously — the source starts pointed at a transparent 1x1 tile so
  // `map.getSource`/`getLayer` are non-null immediately (needed for the
  // idempotency checks above and `setRainViewerVisibility` below), then
  // `refreshRainViewer` swaps in the real tile URL once resolved.
  if (!map.getSource(RAINVIEWER_SOURCE_ID)) {
    map.addSource(RAINVIEWER_SOURCE_ID, {
      type: "raster",
      tiles: [],
      tileSize: 256,
      attribution: "Weather data © RainViewer",
    });
  }
  if (!map.getLayer(RAINVIEWER_LAYER_ID)) {
    map.addLayer({
      id: RAINVIEWER_LAYER_ID,
      type: "raster",
      source: RAINVIEWER_SOURCE_ID,
      layout: {
        visibility: (visibility.rainViewer ?? true) ? "visible" : "none",
      },
      paint: { "raster-opacity": 0.75 },
    });
  }
  void refreshRainViewer(map);
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

/** Shows/hides the OpenAIP airspace layer. No-ops if no API key was
 * configured (the layer/source were never added — see `addCustomLayers`). */
export function setOpenAipVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(OPENAIP_LAYER_ID)) {
    map.setLayoutProperty(OPENAIP_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

/** Shows/hides the RainViewer radar layer. */
export function setRainViewerVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(RAINVIEWER_LAYER_ID)) {
    map.setLayoutProperty(
      RAINVIEWER_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

/**
 * Re-resolves RainViewer's current frame and swaps it into the source.
 * MapLibre raster sources don't support changing `tiles` in place, so this
 * removes and re-adds the source/layer, preserving the layer's current
 * visibility. No-ops (leaves the previous frame showing) if the lookup
 * fails, per the "fail non-fatal" layer convention used throughout this
 * file.
 */
export async function refreshRainViewer(map: MapLibreMap): Promise<void> {
  const tileUrl = await fetchCurrentRainViewerTileUrl();
  if (!tileUrl) return;
  const wasVisible = map.getLayer(RAINVIEWER_LAYER_ID)
    ? map.getLayoutProperty(RAINVIEWER_LAYER_ID, "visibility") !== "none"
    : true;
  if (map.getLayer(RAINVIEWER_LAYER_ID)) map.removeLayer(RAINVIEWER_LAYER_ID);
  if (map.getSource(RAINVIEWER_SOURCE_ID)) map.removeSource(RAINVIEWER_SOURCE_ID);
  map.addSource(RAINVIEWER_SOURCE_ID, {
    type: "raster",
    tiles: [tileUrl],
    tileSize: 256,
    attribution: "Weather data © RainViewer",
  });
  map.addLayer({
    id: RAINVIEWER_LAYER_ID,
    type: "raster",
    source: RAINVIEWER_SOURCE_ID,
    layout: { visibility: wasVisible ? "visible" : "none" },
    paint: { "raster-opacity": 0.75 },
  });
}

/** Shows/hides the TFR layer. */
export function setTfrVisibility(map: MapLibreMap, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(TFR_FILL_LAYER_ID)) {
    map.setLayoutProperty(TFR_FILL_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(TFR_LINE_LAYER_ID)) {
    map.setLayoutProperty(TFR_LINE_LAYER_ID, "visibility", visibility);
  }
}

/** Refetches current TFRs and updates the source in place. No-ops if the
 * source doesn't exist yet (e.g. a refresh tick mid-style-swap). */
export async function refreshTfrs(map: MapLibreMap): Promise<void> {
  const data = await fetchTfrs();
  const source = map.getSource(TFR_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(data);
}

/** Shows/hides the special use airspace layer. */
export function setSpecialUseAirspaceVisibility(
  map: MapLibreMap,
  visible: boolean,
): void {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(SUA_FILL_LAYER_ID)) {
    map.setLayoutProperty(SUA_FILL_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(SUA_LINE_LAYER_ID)) {
    map.setLayoutProperty(SUA_LINE_LAYER_ID, "visibility", visibility);
  }
}

/** Refetches current special use airspace polygons and updates the source
 * in place. No-ops if the source doesn't exist yet. */
export async function refreshSpecialUseAirspace(map: MapLibreMap): Promise<void> {
  const data = await fetchSpecialUseAirspace();
  const source = map.getSource(SUA_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(data);
}

/** Shows/hides the NEXRAD layer. */
export function setNexradVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(NEXRAD_LAYER_ID)) {
    map.setLayoutProperty(NEXRAD_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

/** Shows/hides the NOAA infrared satellite layer. No-ops if no tile source
 * was configured (the layer/source were never added — see
 * `addCustomLayers`). */
export function setNoaaInfraredVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(NOAA_INFRARED_LAYER_ID)) {
    map.setLayoutProperty(
      NOAA_INFRARED_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

/** Shows/hides the NOAA Radar layer. Independent of the NEXRAD layer —
 * distinct source, distinct toggle. */
export function setNoaaRadarVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(NOAA_RADAR_LAYER_ID)) {
    map.setLayoutProperty(
      NOAA_RADAR_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

/** Shows/hides the DWD RADOLAN layer. */
export function setDwdRadolanVisibility(map: MapLibreMap, visible: boolean): void {
  if (map.getLayer(DWD_RADOLAN_LAYER_ID)) {
    map.setLayoutProperty(
      DWD_RADOLAN_LAYER_ID,
      "visibility",
      visible ? "visible" : "none",
    );
  }
}

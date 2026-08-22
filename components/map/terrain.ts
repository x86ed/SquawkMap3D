import type { Map as MapLibreMap } from "maplibre-gl";
import { getTerrainSourceUrl } from "./mapStyles";
import { TERRAIN_EXAGGERATION } from "./constants";

const TERRAIN_SOURCE_ID = "maptiler-terrain-rgb";

/** Adds the terrain-DEM source (if missing) and (re-)applies it as the
 * active terrain. Must be re-run on every `style.load`, since `setStyle`
 * clears both the source and the active terrain. */
export function applyTerrain(map: MapLibreMap): void {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      url: getTerrainSourceUrl(),
      tileSize: 256,
    });
  }
  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
}

/** MapLibre 6's sky is a `map.setSky()` style property, not an addable
 * "sky" layer type (that's a Mapbox GL JS / older-MapLibre API). Must be
 * re-applied on every `style.load`, since `setStyle` clears it too. */
export function applySky(map: MapLibreMap): void {
  map.setSky({
    "sky-color": "#88c6fc",
    "horizon-color": "#ffffff",
    "fog-color": "#ffffff",
    "atmosphere-blend": 0.8,
  });
}

import type { Map as MapLibreMap } from "maplibre-gl";
import { getTerrainSourceUrl } from "./mapStyles";
import { SKY_LAYER_ID, TERRAIN_EXAGGERATION } from "./constants";

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

export function ensureSkyLayer(map: MapLibreMap): void {
  if (map.getLayer(SKY_LAYER_ID)) return;
  map.addLayer({
    id: SKY_LAYER_ID,
    type: "sky",
    paint: {
      "sky-type": "atmosphere",
      "sky-atmosphere-sun-intensity": 10,
    },
  });
}

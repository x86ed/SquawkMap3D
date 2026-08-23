import {
  RAINVIEWER_COLOR_SCHEME,
  RAINVIEWER_MAPS_JSON_URL,
  RAINVIEWER_TILE_OPTIONS,
  RAINVIEWER_TILE_SIZE,
} from "./constants";

interface RainViewerFrame {
  path: string;
}

interface RainViewerMapsResponse {
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
}

/**
 * Fetches RainViewer's current frame list and returns the tile URL template
 * for the most recent radar frame, or `null` if the lookup fails or no
 * frame is available. The returned template still contains `{z}/{x}/{y}`
 * placeholders for MapLibre to fill in.
 */
export async function fetchCurrentRainViewerTileUrl(): Promise<string | null> {
  try {
    const response = await fetch(RAINVIEWER_MAPS_JSON_URL);
    if (!response.ok) return null;
    const data: RainViewerMapsResponse = await response.json();
    const frames = data.radar?.past;
    const latest = frames?.[frames.length - 1];
    if (!data.host || !latest?.path) return null;
    return `${data.host}${latest.path}/${RAINVIEWER_TILE_SIZE}/{z}/{x}/{y}/${RAINVIEWER_COLOR_SCHEME}/${RAINVIEWER_TILE_OPTIONS}.png`;
  } catch {
    return null;
  }
}

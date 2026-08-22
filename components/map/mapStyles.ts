export type MapTheme = "light" | "dark";

export function getMapTilerKey(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPTILER_KEY;
}

/** MapTiler's "outdoor" style pair — matched light/dark vector styles with
 * topographic-friendly styling (contours, hillshading hints). */
export function getStyleUrl(theme: MapTheme): string {
  const style = theme === "dark" ? "outdoor-v2-dark" : "outdoor-v2";
  return `https://api.maptiler.com/maps/${style}/style.json?key=${getMapTilerKey()}`;
}

export function getTerrainSourceUrl(): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${getMapTilerKey()}`;
}

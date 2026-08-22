import type { StyleSpecification } from "maplibre-gl";
import { getDarkMatterStyle } from "./darkMatterStyle";

export type MapTheme = "light" | "dark";

export function getMapTilerKey(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPTILER_KEY;
}

/** Light theme is MapTiler's "outdoor" style (topographic-friendly: contours,
 * hillshading). Dark theme is the local "Dark Matter" style (see
 * `darkMatterStyle.ts`), which ports the same contour/hillshade layers over
 * from MapTiler's `outdoor-v2-dark` so the topographic look is consistent
 * between themes. */
export function getStyleUrl(theme: MapTheme): string | StyleSpecification {
  if (theme === "dark") {
    return getDarkMatterStyle(getMapTilerKey() ?? "");
  }
  return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${getMapTilerKey()}`;
}

export function getTerrainSourceUrl(): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${getMapTilerKey()}`;
}

import type { StyleSpecification } from "maplibre-gl";
import { getDarkMatterStyle } from "./darkMatterStyle";
import { getPositronStyle } from "./positronStyle";

export type MapTheme = "light" | "dark";

export function getMapTilerKey(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPTILER_KEY;
}

/** Light theme is the local "Positron" style (see `positronStyle.ts`), a
 * light gray/muted CARTO-style basemap. Dark theme is the local "Dark
 * Matter" style (see `darkMatterStyle.ts`). Both are built from this app's
 * own MapTiler `v3-openmaptiles` vector source/glyphs, each paired with its
 * sibling OpenMapTiles style's public (no-API-key) sprite sheet, rather than
 * pointing at a fully remote MapTiler-hosted style.json. */
export function getStyleUrl(theme: MapTheme): string | StyleSpecification {
  if (theme === "dark") {
    return getDarkMatterStyle(getMapTilerKey() ?? "");
  }
  return getPositronStyle(getMapTilerKey() ?? "");
}

export function getTerrainSourceUrl(): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${getMapTilerKey()}`;
}

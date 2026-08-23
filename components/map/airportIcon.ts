import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapTheme } from "./mapStyles";

// Inlined from app/atc.svg (viewBox 0 0 66 66) so it can be rasterized to a
// canvas without a network/fetch round trip — files under app/ aren't
// served as static assets by Next.js the way public/ is.
const ATC_SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 66 66" enable-background="new 0 0 66 66" xml:space="preserve"><g><path d="M33.8,31.5h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,32,34.3,31.5,33.8,31.5z"/><path d="M33.8,35h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,35.5,34.3,35,33.8,35z"/><path d="M33.8,38.5h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,38.9,34.3,38.5,33.8,38.5z"/><path d="M33.8,41.9h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,42.4,34.3,41.9,33.8,41.9z"/><path d="M33.8,45.4h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,45.9,34.3,45.4,33.8,45.4z"/><path d="M33.8,48.9h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,49.3,34.3,48.9,33.8,48.9z"/><path d="M33.8,52.3h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,52.8,34.3,52.3,33.8,52.3z"/><path d="M33.8,55.8h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,56.2,34.3,55.8,33.8,55.8z"/><path d="M33.8,59.3h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,59.7,34.3,59.3,33.8,59.3z"/><path d="M44.8,16.6c0-0.2-0.1-0.4-0.1-0.5l-3.1-5.4c-0.2-0.3-0.5-0.5-0.9-0.5h-1.8v-1c0-1.9-1.6-3.5-3.5-3.5h-1.5V2   c0-0.6-0.4-1-1-1c-0.6,0-1,0.4-1,1v3.7h-1.4c-1.9,0-3.5,1.6-3.5,3.5v1h-1.7c-0.4,0-0.7,0.2-0.9,0.5l-3.1,5.4   c-0.1,0.2-0.1,0.4-0.1,0.5v4.2c0,0,0,0,0,0c0,0.2,0.1,0.4,0.1,0.5l3.1,5.4c0,0,0.1,0.1,0.1,0.1c-0.1,0.3-0.2,0.7-0.2,1.1   c0,1.5,1.2,2.7,2.7,2.7h0.9c1.5,9.5,0.2,20.4-3.8,33c-0.2,0.6,0.3,1.3,1,1.3h15.8c0.7,0,1.2-0.7,0.9-1.4c-4.3-11.5-5.7-22.3-4.1-33   H39c1.5,0,2.7-1.2,2.7-2.7c0-0.4-0.1-0.8-0.2-1.1c0,0,0.1-0.1,0.1-0.1l3.1-5.4c0.1-0.2,0.1-0.4,0.1-0.5L44.8,16.6   C44.8,16.6,44.8,16.6,44.8,16.6z M31,25.2c-0.5-1.1-1.1-2.4-1.5-3.4h7.4c-0.8,1.8-1.3,2.9-1.5,3.4H31z M23.2,19.8v-2.2h19.5v2.2   H23.2z M29,9.2c0-0.8,0.7-1.5,1.5-1.5h4.9c0.8,0,1.5,0.7,1.5,1.5v1c-0.2,0-8,0-7.9,0V9.2z M25.9,12.2c0.3,0,14.4,0,14.2,0l1.9,3.4   H24L25.9,12.2z M24,21.8h3.4c0.2,0.6,0.7,1.6,1.5,3.4h-2.9L24,21.8z M39.5,63h-13c3.8-12.3,4.9-22.9,3.5-32.3h5.7   C34.2,41.2,35.4,51.8,39.5,63z M39,28.7c-0.2,0-12.7,0-11.9,0c-0.4,0-0.7-0.3-0.7-0.7c0-0.4,0.3-0.7,0.7-0.7H39   c0.4,0,0.7,0.3,0.7,0.7C39.7,28.3,39.4,28.7,39,28.7z M40.1,25.2h-2.5c0.4-1,1-2.3,1.5-3.4H42L40.1,25.2z"/></g></svg>`;

export const AIRPORT_ICON_RASTER_SIZE = 128;
export const AIRPORT_ICON_PIXEL_RATIO = 2;

// Inset the glyph within the raster so it doesn't touch the white backing
// circle's edge.
const ICON_PADDING_RATIO = 0.16;

export function airportIconImageId(theme: MapTheme): string {
  return `airport-icon-${theme}`;
}

function loadSvgImage(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([markup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Rasterizes `atc.svg`, recolored to `color`, on a solid white backing disc
 * sized to the raster — so the glyph's negative space (any area within its
 * own footprint not covered by its path) reads as opaque white rather than
 * transparent to whatever's rendered beneath the map icon.
 */
async function rasterizeAirportIcon(color: string): Promise<ImageData> {
  const img = await loadSvgImage(ATC_SVG_MARKUP);
  const size = AIRPORT_ICON_RASTER_SIZE;
  const inset = size * ICON_PADDING_RATIO;
  const glyphSize = size - inset * 2;

  // Recolor the glyph: draw it, then use `source-in` to replace its opaque
  // pixels with `color` while preserving its alpha (so transparent stays
  // transparent, anti-aliased edges stay anti-aliased).
  const glyphCanvas = document.createElement("canvas");
  glyphCanvas.width = size;
  glyphCanvas.height = size;
  const glyphCtx = glyphCanvas.getContext("2d");
  if (!glyphCtx) throw new Error("2D canvas context unavailable");
  glyphCtx.drawImage(img, inset, inset, glyphSize, glyphSize);
  glyphCtx.globalCompositeOperation = "source-in";
  glyphCtx.fillStyle = color;
  glyphCtx.fillRect(0, 0, size, size);

  // White backing disc, then the recolored glyph composited on top.
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(glyphCanvas, 0, 0);

  return ctx.getImageData(0, 0, size, size);
}

const rasterCache = new Map<string, Promise<ImageData>>();

function getOrRasterize(color: string): Promise<ImageData> {
  let cached = rasterCache.get(color);
  if (!cached) {
    cached = rasterizeAirportIcon(color);
    rasterCache.set(color, cached);
  }
  return cached;
}

/**
 * Idempotently registers the airport icon image for `theme`/`color` with
 * `map.addImage`. Safe to call on every `load`/`style.load` — MapLibre
 * discards registered images on a style swap, same as sources/layers.
 */
export async function ensureAirportIcon(
  map: MapLibreMap,
  theme: MapTheme,
  color: string,
): Promise<void> {
  const imageId = airportIconImageId(theme);
  if (map.hasImage(imageId)) return;
  const imageData = await getOrRasterize(color);
  // The awaited rasterization may race a concurrent call (e.g. a rapid
  // theme toggle) that already registered this image — recheck before
  // adding, since `addImage` throws on a duplicate id.
  if (map.hasImage(imageId)) return;
  map.addImage(imageId, imageData, { pixelRatio: AIRPORT_ICON_PIXEL_RATIO });
}

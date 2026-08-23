import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapTheme } from "./mapStyles";

// Inlined from app/atc.svg (viewBox 0 0 66 66) so it can be rasterized to a
// canvas without a network/fetch round trip — files under app/ aren't
// served as static assets by Next.js the way public/ is.
const ATC_SVG_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 66 66" enable-background="new 0 0 66 66" xml:space="preserve"><g><path d="M33.8,31.5h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,32,34.3,31.5,33.8,31.5z"/><path d="M33.8,35h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,35.5,34.3,35,33.8,35z"/><path d="M33.8,38.5h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,38.9,34.3,38.5,33.8,38.5z"/><path d="M33.8,41.9h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,42.4,34.3,41.9,33.8,41.9z"/><path d="M33.8,45.4h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,45.9,34.3,45.4,33.8,45.4z"/><path d="M33.8,48.9h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,49.3,34.3,48.9,33.8,48.9z"/><path d="M33.8,52.3h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,52.8,34.3,52.3,33.8,52.3z"/><path d="M33.8,55.8h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,56.2,34.3,55.8,33.8,55.8z"/><path d="M33.8,59.3h-1.6c-0.6,0-1,0.4-1,1c0,0.6,0.4,1,1,1h1.6c0.6,0,1-0.4,1-1C34.8,59.7,34.3,59.3,33.8,59.3z"/><path d="M44.8,16.6c0-0.2-0.1-0.4-0.1-0.5l-3.1-5.4c-0.2-0.3-0.5-0.5-0.9-0.5h-1.8v-1c0-1.9-1.6-3.5-3.5-3.5h-1.5V2   c0-0.6-0.4-1-1-1c-0.6,0-1,0.4-1,1v3.7h-1.4c-1.9,0-3.5,1.6-3.5,3.5v1h-1.7c-0.4,0-0.7,0.2-0.9,0.5l-3.1,5.4   c-0.1,0.2-0.1,0.4-0.1,0.5v4.2c0,0,0,0,0,0c0,0.2,0.1,0.4,0.1,0.5l3.1,5.4c0,0,0.1,0.1,0.1,0.1c-0.1,0.3-0.2,0.7-0.2,1.1   c0,1.5,1.2,2.7,2.7,2.7h0.9c1.5,9.5,0.2,20.4-3.8,33c-0.2,0.6,0.3,1.3,1,1.3h15.8c0.7,0,1.2-0.7,0.9-1.4c-4.3-11.5-5.7-22.3-4.1-33   H39c1.5,0,2.7-1.2,2.7-2.7c0-0.4-0.1-0.8-0.2-1.1c0,0,0.1-0.1,0.1-0.1l3.1-5.4c0.1-0.2,0.1-0.4,0.1-0.5L44.8,16.6   C44.8,16.6,44.8,16.6,44.8,16.6z M31,25.2c-0.5-1.1-1.1-2.4-1.5-3.4h7.4c-0.8,1.8-1.3,2.9-1.5,3.4H31z M23.2,19.8v-2.2h19.5v2.2   H23.2z M29,9.2c0-0.8,0.7-1.5,1.5-1.5h4.9c0.8,0,1.5,0.7,1.5,1.5v1c-0.2,0-8,0-7.9,0V9.2z M25.9,12.2c0.3,0,14.4,0,14.2,0l1.9,3.4   H24L25.9,12.2z M24,21.8h3.4c0.2,0.6,0.7,1.6,1.5,3.4h-2.9L24,21.8z M39.5,63h-13c3.8-12.3,4.9-22.9,3.5-32.3h5.7   C34.2,41.2,35.4,51.8,39.5,63z M39,28.7c-0.2,0-12.7,0-11.9,0c-0.4,0-0.7-0.3-0.7-0.7c0-0.4,0.3-0.7,0.7-0.7H39   c0.4,0,0.7,0.3,0.7,0.7C39.7,28.3,39.4,28.7,39,28.7z M40.1,25.2h-2.5c0.4-1,1-2.3,1.5-3.4H42L40.1,25.2z"/></g></svg>`;

export const AIRPORT_ICON_RASTER_SIZE = 128;
export const AIRPORT_ICON_PIXEL_RATIO = 2;

// Small inset so the glyph doesn't get clipped by anti-aliasing at the
// raster's edge.
const ICON_PADDING_RATIO = 0.05;

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

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

/**
 * `atc.svg`'s tower body is authored as several overlapping/oppositely-wound
 * subpaths, so rasterizing it as-is leaves transparent "holes" inside the
 * silhouette (e.g. the tower body reads as a hollow outline rather than a
 * solid shape). Rather than hand-editing that path data, this solidifies
 * the raster directly: flood-fill from every edge pixel to find the
 * "outside" (background actually reachable from outside the glyph), then
 * fill every remaining transparent pixel — which must be an enclosed hole —
 * with `color` at full opacity.
 */
function solidifyEnclosedHoles(
  imageData: ImageData,
  color: [number, number, number],
): void {
  const { width, height, data } = imageData;
  const isTransparent = (x: number, y: number) => data[(y * width + x) * 4 + 3] === 0;
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      if (isTransparent(x, y)) stack.push(y * width + x);
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      if (isTransparent(x, y)) stack.push(y * width + x);
    }
  }
  for (const i of stack) outside[i] = 1;

  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i / width) | 0;
    const neighbors: Array<[number, number]> = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (outside[ni] || !isTransparent(nx, ny)) continue;
      outside[ni] = 1;
      stack.push(ni);
    }
  }

  const [r, g, b] = color;
  for (let i = 0; i < width * height; i++) {
    if (outside[i]) continue;
    const alphaIdx = i * 4 + 3;
    if (data[alphaIdx] !== 0) continue; // already-opaque glyph pixel
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[alphaIdx] = 255;
  }
}

/**
 * Rasterizes `atc.svg` recolored to `color`, on a transparent background
 * (no backing shape) — just the glyph itself, with any enclosed holes in
 * its silhouette solidified (see `solidifyEnclosedHoles`).
 */
async function rasterizeAirportIcon(color: string): Promise<ImageData> {
  const img = await loadSvgImage(ATC_SVG_MARKUP);
  const size = AIRPORT_ICON_RASTER_SIZE;
  const inset = size * ICON_PADDING_RATIO;
  const glyphSize = size - inset * 2;

  // Recolor the glyph: draw it, then use `source-in` to replace its opaque
  // pixels with `color` while preserving its alpha (so transparent stays
  // transparent, anti-aliased edges stay anti-aliased).
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(img, inset, inset, glyphSize, glyphSize);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  solidifyEnclosedHoles(imageData, hexToRgb(color));
  return imageData;
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

async function registerAirportIcon(
  map: MapLibreMap,
  imageId: string,
  color: string,
): Promise<void> {
  if (map.hasImage(imageId)) return;
  const cached = await getOrRasterize(color);
  // The awaited rasterization may race a concurrent request for the same
  // id — recheck before adding, since `addImage` throws on a duplicate id.
  if (map.hasImage(imageId)) return;
  // `getOrRasterize` caches by color, and both themes currently share the
  // same `AIRPORT_FILL_COLOR` — so this cached `ImageData` is the same
  // object reused across every id that shares that color. `addImage`
  // transfers its pixel buffer internally, which detaches the source
  // typed array; reusing that same instance for a second `addImage` call
  // hands it a zero-length buffer (`RangeError: mismatched image size`).
  // Cloning the pixel data per call gives each registered image its own
  // buffer.
  const imageData = new ImageData(
    new Uint8ClampedArray(cached.data),
    cached.width,
    cached.height,
  );
  map.addImage(imageId, imageData, { pixelRatio: AIRPORT_ICON_PIXEL_RATIO });
}

/**
 * Registers a `missingStyleImageResolver` that rasterizes and registers the
 * airport icon on demand, the first time the symbol layer's tile worker
 * actually asks for it.
 *
 * This isn't just a nicety — it's required for correctness. A GeoJSON
 * source's symbol bucket resolves its `icon-image` dependency once, in the
 * tile worker, at parse time (shortly after `addSource`/`addLayer`). A
 * bare, unawaited `map.addImage(...)` call racing that parse can lose: if
 * the bucket finishes building before the image is registered, the icon is
 * permanently missing from that bucket — `addImage` afterwards does not
 * retroactively fix already-built buckets, so airports would render with no
 * icon at all despite `map.hasImage` eventually returning true.
 * `setMissingStyleImageResolver`'s callback is `await`ed by the worker's
 * image-dependency resolution before it finalizes the bucket (see
 * MapLibre's `ImageManager._getImagesForIds`), which closes that race.
 *
 * Safe to call on every `load`/`style.load` (idempotent: just re-installs
 * an equivalent resolver) and cheap to call repeatedly since rasterization
 * itself is cached by color in `getOrRasterize`.
 */
export function registerAirportIconResolver(map: MapLibreMap, color: string): void {
  map.setMissingStyleImageResolver((id) => {
    if (id !== airportIconImageId("light") && id !== airportIconImageId("dark")) {
      // Not ours — return nothing so MapLibre falls through to its normal
      // "styleimagemissing" handling for other missing images.
      return undefined;
    }
    // Returned (not fire-and-forget): `ImageManager._getImagesForIds`
    // awaits this before finalizing a tile's icon dependencies — see the
    // race explained on `registerAirportIconResolver` above.
    return registerAirportIcon(map, id, color);
  });
}

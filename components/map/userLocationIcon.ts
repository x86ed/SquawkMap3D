import type { Map as MapLibreMap } from "maplibre-gl";

export const USER_LOCATION_ICON_ID = "user-location-sat";
const SAT_SVG_URL = "/sat.svg";

export const USER_LOCATION_ICON_RASTER_SIZE = 64;
export const USER_LOCATION_ICON_PIXEL_RATIO = 2;

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Rasterizes `sat.svg` recolored to `color`, on a transparent background.
 * `sat.svg` is a compound path with an intentional enclosed opening (the
 * dish's throat) — unlike `airportIcon.ts`'s `atc.svg`, that opening is
 * meant to stay transparent, so no hole-solidifying pass is applied here;
 * `source-in` naturally preserves the source alpha (and thus the opening)
 * while swapping only the opaque pixels' color.
 */
async function rasterizeUserLocationIcon(color: string): Promise<ImageData> {
  const img = await loadSvgImage(SAT_SVG_URL);
  const size = USER_LOCATION_ICON_RASTER_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(img, 0, 0, size, size);
  // Recolor: replace the glyph's opaque pixels with `color` while
  // preserving its alpha, same technique as `airportIcon.ts`.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  return ctx.getImageData(0, 0, size, size);
}

let rasterCache: Promise<ImageData> | null = null;

function getOrRasterize(color: string): Promise<ImageData> {
  if (!rasterCache) {
    rasterCache = rasterizeUserLocationIcon(color);
  }
  return rasterCache;
}

async function registerUserLocationIcon(map: MapLibreMap, color: string): Promise<void> {
  if (map.hasImage(USER_LOCATION_ICON_ID)) return;
  const cached = await getOrRasterize(color);
  // The awaited rasterization may race a concurrent request — recheck
  // before adding, since `addImage` throws on a duplicate id.
  if (map.hasImage(USER_LOCATION_ICON_ID)) return;
  // `addImage` transfers its pixel buffer internally, detaching the source
  // typed array — clone per call so a second registration (e.g. after a
  // theme's style swap removes and re-requests the image) gets its own
  // buffer rather than a zero-length one. See `airportIcon.ts`.
  const imageData = new ImageData(
    new Uint8ClampedArray(cached.data),
    cached.width,
    cached.height,
  );
  map.addImage(USER_LOCATION_ICON_ID, imageData, {
    pixelRatio: USER_LOCATION_ICON_PIXEL_RATIO,
  });
}

/**
 * Registers a `missingStyleImageResolver` that rasterizes and registers the
 * user-location icon on demand, the first time the symbol layer's tile
 * worker actually asks for it. Required for correctness, not just a nicety
 * — see `registerAirportIconResolver`'s doc comment in `airportIcon.ts` for
 * the tile-worker image-dependency race this closes.
 *
 * Safe to call on every `load`/`style.load` (idempotent) and cheap to call
 * repeatedly since rasterization itself is cached.
 */
export function registerUserLocationIconResolver(map: MapLibreMap, color: string): void {
  map.setMissingStyleImageResolver((id) => {
    if (id !== USER_LOCATION_ICON_ID) return undefined;
    return registerUserLocationIcon(map, color);
  });
}

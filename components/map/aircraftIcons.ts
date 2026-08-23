import type { Aircraft } from "./aircraft";
import { AIRCRAFT_CATEGORY_FALLBACK_ICON } from "./constants";

export type IconSource = "type" | "category" | "generic";

export interface ResolvedIcon {
  source: IconSource;
  key: string;
}

export const GENERIC_ICON_KEY = "generic";

const TYPE_SHAPE_URL = (typeDesignator: string) =>
  `/aircraft-shapes/${encodeURIComponent(typeDesignator)}.svg`;

/**
 * Type designators known to have a vendored shape, loaded once from the
 * manifest `scripts/vendor-aircraft-icons.mjs` writes alongside the SVGs
 * (there's no directory-listing API for Next.js's public/ dir). Populated by
 * `buildAircraftIconAtlas`; `resolveIconKey` degrades to the
 * category/generic fallback if called before that resolves (safe, just
 * skips the type-specific tier until the manifest is loaded).
 */
let knownTypeDesignators = new Set<string>();

/**
 * Resolves which atlas entry an aircraft should render with: its own
 * ICAO-type-designator shape if vendored, else its ADS-B emitter category's
 * generic silhouette, else the plain generic marker — an aircraft is never
 * left without an icon (see aircraft-tracks-layer spec's icon-fallback
 * requirement).
 */
export function resolveIconKey(aircraft: Aircraft): ResolvedIcon {
  if (aircraft.typeDesignator && knownTypeDesignators.has(aircraft.typeDesignator)) {
    return { source: "type", key: aircraft.typeDesignator };
  }
  if (aircraft.category && AIRCRAFT_CATEGORY_FALLBACK_ICON[aircraft.category]) {
    return { source: "category", key: aircraft.category };
  }
  return { source: "generic", key: GENERIC_ICON_KEY };
}

export interface IconAtlasEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface IconAtlas {
  // A data URL rather than the canvas element itself — deck.gl's `IconLayer`
  // (v9) types `iconAtlas` as `string | Texture`, not a raw canvas/image, so
  // this is the simplest way to hand it a ready-made image without also
  // constructing a `Texture` against deck.gl's WebGL device ourselves.
  image: string;
  mapping: Record<string, IconAtlasEntry>;
}

const CELL_SIZE = 64;
// Padding kept between drawn shapes and the cell edge so deck.gl's IconLayer
// (which samples slightly outside a tightly-packed sprite when scaling)
// doesn't bleed into a neighboring icon in the atlas.
const CELL_PADDING = 4;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** A plain rotated triangle, drawn directly to canvas — no external asset —
 * used when neither a type-specific nor category-generic icon resolves. */
function drawGenericMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx + half * 0.7, cy + half);
  ctx.lineTo(cx, cy + half * 0.5);
  ctx.lineTo(cx - half * 0.7, cy + half);
  ctx.closePath();
  ctx.fillStyle = "#e5e5e5";
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
}

/**
 * Builds a single combined icon atlas (canvas image + deck.gl `iconMapping`)
 * from every vendored type shape, every category fallback silhouette, and
 * one generic marker — built once at layer-mount time, not per-frame or
 * per-aircraft (see design.md Decision 6). Must run client-side (uses
 * `Image`/`document.createElement("canvas")`).
 */
export async function buildAircraftIconAtlas(): Promise<IconAtlas> {
  const manifestResponse = await fetch("/aircraft-shapes/manifest.json").catch(() => null);
  const typeDesignators: string[] = manifestResponse?.ok
    ? await manifestResponse.json()
    : [];

  const categoryKeys = Object.keys(AIRCRAFT_CATEGORY_FALLBACK_ICON);
  const entries: Array<{ key: string; url: string | null }> = [
    ...typeDesignators.map((t) => ({ key: t, url: TYPE_SHAPE_URL(t) })),
    ...categoryKeys.map((c) => ({ key: c, url: AIRCRAFT_CATEGORY_FALLBACK_ICON[c] })),
    { key: GENERIC_ICON_KEY, url: null },
  ];

  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.ceil(entries.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * CELL_SIZE;
  canvas.height = rows * CELL_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const images = await Promise.all(
    entries.map((entry) => (entry.url ? loadImage(entry.url) : Promise.resolve(null))),
  );

  const mapping: Record<string, IconAtlasEntry> = {};
  const drawable = CELL_SIZE - CELL_PADDING * 2;

  entries.forEach((entry, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;

    const image = images[i];
    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const scale = Math.min(drawable / image.naturalWidth, drawable / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
    } else {
      drawGenericMarker(ctx, cx, cy, drawable);
    }

    mapping[entry.key] = {
      x,
      y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      anchorX: CELL_SIZE / 2,
      anchorY: CELL_SIZE / 2,
    };
  });

  knownTypeDesignators = new Set(typeDesignators);

  return { image: canvas.toDataURL("image/png"), mapping };
}

// Altitude range used for both the icon tint and the track-trail color —
// aeris's "low altitude glows cyan, high altitude shifts to gold" read,
// interpolated across a fixed 0-45,000ft band (above FL450 is rare for
// anything but the highest-flying traffic, so colors saturate rather than
// keep shifting).
const ALTITUDE_COLOR_MIN_FT = 0;
const ALTITUDE_COLOR_MAX_FT = 45_000;
const ALTITUDE_COLOR_LOW: [number, number, number] = [34, 211, 238]; // cyan
const ALTITUDE_COLOR_HIGH: [number, number, number] = [250, 204, 21]; // gold

/** Interpolates an aircraft's altitude (feet) into an RGB color between the
 * low-altitude cyan and high-altitude gold, clamped to the configured
 * range. Returns a deck.gl-style `[r, g, b]` triplet (0-255 each). */
export function altitudeToColor(altitudeFt: number): [number, number, number] {
  const t = Math.min(
    1,
    Math.max(0, (altitudeFt - ALTITUDE_COLOR_MIN_FT) / (ALTITUDE_COLOR_MAX_FT - ALTITUDE_COLOR_MIN_FT)),
  );
  return [
    Math.round(ALTITUDE_COLOR_LOW[0] + (ALTITUDE_COLOR_HIGH[0] - ALTITUDE_COLOR_LOW[0]) * t),
    Math.round(ALTITUDE_COLOR_LOW[1] + (ALTITUDE_COLOR_HIGH[1] - ALTITUDE_COLOR_LOW[1]) * t),
    Math.round(ALTITUDE_COLOR_LOW[2] + (ALTITUDE_COLOR_HIGH[2] - ALTITUDE_COLOR_LOW[2]) * t),
  ];
}

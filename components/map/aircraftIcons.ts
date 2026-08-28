import type { Aircraft } from "./aircraft";
import { CATEGORY_FALLBACK_KEY } from "./aircraftShapes";
import { AIRCRAFT_CATEGORY_FALLBACK_ICON } from "./constants";
import { computeTightViewBox } from "./svgBBox";

export type IconSource = "type" | "category-type" | "category" | "generic";

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
 * Resolves which atlas entry an aircraft should render with, in order: its
 * own ICAO-type-designator shape if vendored; else, for the categories
 * `aircraftShapes.ts`'s `CATEGORY_FALLBACK_KEY` has a representative
 * AircraftShapesSVG type for, that same shape (the atlas already contains
 * an entry for it — every real type designator is vendored into the atlas
 * regardless of whether this particular aircraft matched one directly) —
 * this is also what `PlaneCard` falls back to, so an aircraft with no known
 * exact type still renders the *same* icon on the map and in its detail
 * card; else its ADS-B emitter category's pw-silhouettes generic silhouette
 * (covers a few categories — skydivers, UAVs, surface vehicles — that have
 * no reasonable AircraftShapesSVG stand-in); else the plain generic marker
 * — an aircraft is never left without an icon (see aircraft-tracks-layer
 * spec's icon-fallback requirement).
 */
export function resolveIconKey(aircraft: Aircraft): ResolvedIcon {
  if (aircraft.typeDesignator && knownTypeDesignators.has(aircraft.typeDesignator)) {
    return { source: "type", key: aircraft.typeDesignator };
  }
  const categoryTypeKey = aircraft.category && CATEGORY_FALLBACK_KEY[aircraft.category];
  if (categoryTypeKey && knownTypeDesignators.has(categoryTypeKey)) {
    return { source: "category-type", key: categoryTypeKey };
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

// pw-silhouettes draws every category nose-up except these two, which are
// nose-left in the source SVG (verified by rendering each vendored file) —
// `getAngle` in aircraftLayer.ts assumes nose-up, so these render 90° off
// from the aircraft's real track unless corrected here at atlas-build time.
const ICON_ORIENTATION_OFFSET_DEG: Record<string, number> = {
  A1: 90,
  B1: 90,
};

// 96px (up from an original 64px) so a 40px on-screen icon (aircraftLayer.ts's
// `getSize`) still has real supersampled resolution behind it instead of
// stretching a blurry, thin-lined source.
const CELL_SIZE = 96;
// Padding kept between drawn shapes and the cell edge so deck.gl's IconLayer
// (which samples slightly outside a tightly-packed sprite when scaling)
// doesn't bleed into a neighboring icon in the atlas.
const CELL_PADDING = 6;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Fetches a vendored shape SVG and rebuilds it before rasterizing, fixing
 * two problems confirmed by inspecting the vendored files directly (see
 * `svgBBox.ts`'s doc comment): first, each file's own declared `viewBox`
 * isn't tightly cropped to its actual drawing — some types fill their
 * canvas reasonably, others (the Cessna 172, one of the most common types)
 * draw at barely a fourteenth of it, rendering as a near-invisible speck at
 * icon size regardless of how big the icon itself is drawn. Second, several
 * files are pure `fill:none` outline strokes with no solid fill at all,
 * which reads as a hairline at small sizes.
 *
 * Both are fixed by measuring the real content bounding box (`getBBox`,
 * requires the markup to be mounted in a laid-out document) and rebuilding
 * a standalone SVG cropped to that box with every path's fill/stroke forced
 * to solid white — deck.gl's IconLayer then multiplies that solid white by
 * `getColor` (aircraftLayer.ts) for the actual on-map tint, so what's
 * rasterized here just needs to be a correctly-sized, fully opaque
 * silhouette. An explicit pixel `width`/`height` (not just `viewBox`) is
 * set on the rebuilt SVG so the resulting `<img>`'s `naturalWidth`/
 * `naturalHeight` — which `buildAircraftIconAtlas` scales the drawn size
 * from — actually reflects the crop's square aspect, since a raw `<svg>`
 * with no explicit size defaults to a fixed 300×150 box regardless of its
 * `viewBox`.
 */
async function loadShapeImage(url: string): Promise<HTMLImageElement | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl || doc.querySelector("parsererror")) return null;

  const fallbackViewBox = svgEl.getAttribute("viewBox") ?? "0 0 100 100";
  const innerMarkup = svgEl.innerHTML;
  const tightViewBox = computeTightViewBox(innerMarkup, fallbackViewBox);

  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tightViewBox}" width="256" height="256">` +
    `<style>path,polygon,polyline,circle,ellipse,rect{fill:#ffffff!important;stroke:#ffffff!important;stroke-width:3px;vector-effect:non-scaling-stroke;}</style>` +
    innerMarkup +
    `</svg>`;

  const blob = new Blob([wrapped], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await loadImage(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
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
    entries.map((entry) => (entry.url ? loadShapeImage(entry.url) : Promise.resolve(null))),
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
      const offsetDeg = ICON_ORIENTATION_OFFSET_DEG[entry.key] ?? 0;
      if (offsetDeg) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((offsetDeg * Math.PI) / 180);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
      }
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

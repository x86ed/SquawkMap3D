import type { Aircraft } from "./aircraft";
import { computeRarityTier, RARITY_TIER_STYLES } from "./aircraftRarity";
import { CATEGORY_FALLBACK_KEY } from "./aircraftShapes";
import { AIRCRAFT_CATEGORY_FALLBACK_ICON, MACH1_APPROX_KTS } from "./constants";
import { AIRPORT_FILL_COLOR } from "./layers";
import { computeTightViewBox } from "./svgBBox";

export type IconSource = "type" | "category-type" | "category" | "generic";

export interface ResolvedIcon {
  source: IconSource;
  key: string;
}

export const GENERIC_ICON_KEY = "generic";

// Suffix identifying an atlas entry as the blurred glow variant of a normal
// icon key, rather than a second, unrelated atlas key namespace — lets
// aircraftLayer.ts's icon-glow layer render the exact same silhouette as the
// crisp icon (just larger/blurred/tinted), instead of an unrelated shape
// like a plain circle.
export const GLOW_ICON_KEY_SUFFIX = "__GLOW";

/** Maps a normal atlas icon key to its pre-baked blurred glow variant's key
 * (see `GLOW_ICON_KEY_SUFFIX` and `buildAircraftIconAtlas`). */
export function glowIconKey(key: string): string {
  return `${key}${GLOW_ICON_KEY_SUFFIX}`;
}

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
  // Without this, deck.gl's IconLayer renders the atlas texture's own baked
  // pixel color verbatim and ignores `getColor` entirely (its fragment
  // shader does `mix(texColor.rgb, vColor.rgb, vColorMode)`, where
  // `vColorMode` comes straight from this `mask` flag — 0/false uses the
  // texture color as-is, 1/true treats the texture as an alpha-only mask
  // tinted by `getColor`). Every shape here is deliberately baked solid
  // white (see `loadShapeImage`/`drawGenericMarker`) specifically so this
  // mask mode can recolor it — `mask: true` is what actually turns that on.
  mask: true;
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

// Canvas 2D `filter: blur(...)` radius (px, at the 96px atlas cell's native
// resolution) baked into each icon's glow variant. The glow layer's soft
// edge comes entirely from this pre-baked alpha falloff — `mask: true`
// (below) treats the atlas texture's alpha as per-pixel coverage, so a
// blurred solid-white silhouette becomes a soft-edged glow of whatever color
// the glow layer's `getColor` supplies, shaped exactly like the icon itself.
const GLOW_BLUR_PX = 6;
// The glow silhouette is drawn at this fraction of the normal icon's
// drawable size, leaving headroom inside the cell for GLOW_BLUR_PX to spread
// into without being clipped at the cell edge.
const GLOW_SHRINK = 0.7;

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

/** Atlas key for the rotorcraft rotor-disc accent (see `ROTOR_ACCENT_KEY`'s
 * doc comment on `resolveIconKey`'s sibling usage in `aircraftLayer.ts`). */
export const ROTOR_ACCENT_KEY = "ROTOR_ACCENT";

/**
 * A rotor-disc glyph (a cross through a center hub), drawn solid white so
 * `getColor` can tint it like every other atlas entry (design.md's `mask:
 * true` fix). Rendered as its own small deck.gl `IconLayer` positioned at
 * the exact same real-world altitude as the aircraft's own icon — unlike
 * the previous MapLibre-`Marker`-based approach (`rotorMarkers.ts`, now
 * removed), which had no altitude/pitch awareness at all and always
 * projected onto the ground plane regardless of the aircraft's actual
 * height or the camera's tilt.
 */
function drawRotorAccent(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const half = size / 2;
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy - half);
  ctx.lineTo(cx, cy + half);
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx + half, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, size * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Builds a single combined icon atlas (canvas image + deck.gl `iconMapping`)
 * from every vendored type shape, every category fallback silhouette, and
 * one generic marker — built once at layer-mount time, not per-frame or
 * per-aircraft (see design.md Decision 6). Every entry also gets a second,
 * blurred glow variant under `glowIconKey(key)` (see `GLOW_ICON_KEY_SUFFIX`),
 * so the icon-glow layer can render each aircraft's own silhouette rather
 * than an unrelated shape. Must run client-side (uses `Image`/
 * `document.createElement("canvas")`).
 */
export async function buildAircraftIconAtlas(): Promise<IconAtlas> {
  const manifestResponse = await fetch("/aircraft-shapes/manifest.json").catch(() => null);
  const typeDesignators: string[] = manifestResponse?.ok
    ? await manifestResponse.json()
    : [];

  const categoryKeys = Object.keys(AIRCRAFT_CATEGORY_FALLBACK_ICON);
  const baseEntries: Array<{ key: string; url: string | null }> = [
    ...typeDesignators.map((t) => ({ key: t, url: TYPE_SHAPE_URL(t) })),
    ...categoryKeys.map((c) => ({ key: c, url: AIRCRAFT_CATEGORY_FALLBACK_ICON[c] })),
    { key: GENERIC_ICON_KEY, url: null },
    { key: ROTOR_ACCENT_KEY, url: null },
  ];

  // Every base entry gets a second, blurred "glow" entry (see
  // `GLOW_ICON_KEY_SUFFIX`) so the icon-glow layer can render each aircraft's
  // own silhouette instead of an unrelated shape like a plain circle.
  const entries: Array<{ key: string; url: string | null; glow: boolean }> = [
    ...baseEntries.map((e) => ({ ...e, glow: false })),
    ...baseEntries.map((e) => ({ key: glowIconKey(e.key), url: e.url, glow: true })),
  ];

  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.ceil(entries.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * CELL_SIZE;
  canvas.height = rows * CELL_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Loaded once per unique base entry/URL, then reused for both that entry's
  // normal and glow cells — avoids fetching every vendored shape SVG twice.
  const baseImages = await Promise.all(
    baseEntries.map((entry) => (entry.url ? loadShapeImage(entry.url) : Promise.resolve(null))),
  );
  const imageByKey = new Map(baseEntries.map((entry, i) => [entry.key, baseImages[i]]));

  const mapping: Record<string, IconAtlasEntry> = {};
  const drawable = CELL_SIZE - CELL_PADDING * 2;

  entries.forEach((entry, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;

    const baseKey = entry.glow ? entry.key.slice(0, -GLOW_ICON_KEY_SUFFIX.length) : entry.key;
    const image = imageByKey.get(baseKey) ?? null;
    const drawableForEntry = entry.glow ? drawable * GLOW_SHRINK : drawable;

    if (entry.glow) {
      ctx.save();
      ctx.filter = `blur(${GLOW_BLUR_PX}px)`;
    }

    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
      const scale = Math.min(
        drawableForEntry / image.naturalWidth,
        drawableForEntry / image.naturalHeight,
      );
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      const offsetDeg = ICON_ORIENTATION_OFFSET_DEG[baseKey] ?? 0;
      if (offsetDeg) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((offsetDeg * Math.PI) / 180);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
      }
    } else if (baseKey === ROTOR_ACCENT_KEY) {
      drawRotorAccent(ctx, cx, cy, drawableForEntry);
    } else {
      drawGenericMarker(ctx, cx, cy, drawableForEntry);
    }

    if (entry.glow) {
      ctx.restore();
    }

    mapping[entry.key] = {
      x,
      y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      anchorX: CELL_SIZE / 2,
      anchorY: CELL_SIZE / 2,
      mask: true,
    };
  });

  knownTypeDesignators = new Set(typeDesignators);

  return { image: canvas.toDataURL("image/png"), mapping };
}

/**
 * Multi-stop "color by altitude" gradient (design.md Decision 2) — control
 * points and RGB values pixel-sampled directly from the acceptance
 * criteria's reference legend image (a tar1090-style orange→yellow→green→
 * cyan→blue→magenta ramp), not an invented/approximated 2-color lerp. Both
 * `altitudeToColor` below and `ColorModeLegend`'s altitude gradient bar
 * share this exact table so the legend can never drift from the live icon
 * colors.
 */
export const ALTITUDE_COLOR_STOPS: Array<{ ft: number; rgb: [number, number, number] }> = [
  { ft: 0, rgb: [225, 112, 50] },
  { ft: 500, rgb: [225, 113, 50] },
  { ft: 1_000, rgb: [226, 127, 55] },
  { ft: 2_000, rgb: [229, 156, 64] },
  { ft: 4_000, rgb: [225, 184, 66] },
  { ft: 6_000, rgb: [193, 195, 65] },
  { ft: 8_000, rgb: [120, 194, 61] },
  { ft: 10_000, rgb: [92, 189, 74] },
  { ft: 20_000, rgb: [81, 178, 190] },
  { ft: 30_000, rgb: [56, 69, 231] },
  { ft: 40_000, rgb: [186, 54, 200] },
];

/** Interpolates an aircraft's altitude (feet) along `ALTITUDE_COLOR_STOPS`,
 * clamped below the first and at/above the last stop. Returns a deck.gl-style
 * `[r, g, b]` triplet (0-255 each). */
export function altitudeToColor(altitudeFt: number): [number, number, number] {
  const stops = ALTITUDE_COLOR_STOPS;
  if (altitudeFt <= stops[0].ft) return stops[0].rgb;
  if (altitudeFt >= stops[stops.length - 1].ft) return stops[stops.length - 1].rgb;

  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (altitudeFt >= stops[i].ft && altitudeFt <= stops[i + 1].ft) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const t = (altitudeFt - lower.ft) / (upper.ft - lower.ft);
  return [
    Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * t),
    Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * t),
    Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * t),
  ];
}

/**
 * "Speedometer" airspeed gradient (design.md Decision 3): grey when stopped
 * or unknown, then fixed knot bands green→yellow→orange→red→magenta, then a
 * darker purple above `MACH1_APPROX_KTS`. Ground speed is the only speed
 * value this app has (no true airspeed/OAT from the feeder), so the "Mach 1"
 * threshold is a fixed-knots approximation, not a real Mach computation.
 */
const AIRSPEED_COLOR_STOPPED: [number, number, number] = [148, 148, 148]; // grey
const AIRSPEED_COLOR_GREEN: [number, number, number] = [34, 197, 94];
const AIRSPEED_COLOR_YELLOW: [number, number, number] = [234, 179, 8];
const AIRSPEED_COLOR_ORANGE: [number, number, number] = [249, 115, 22];
const AIRSPEED_COLOR_RED: [number, number, number] = [220, 38, 38];
const AIRSPEED_COLOR_MAGENTA: [number, number, number] = [217, 70, 239];
// Reuses `layers.ts`'s own airport-icon accent color (light-theme variant —
// a deep violet, not the brighter dark-theme neon) rather than a separate
// pinned hex, so the two stay in sync if that color ever changes.
const AIRSPEED_COLOR_SUPERSONIC: [number, number, number] = hexColorToRgb(AIRPORT_FILL_COLOR.light);

export function airspeedToColor(groundSpeedKt: number | undefined): [number, number, number] {
  if (groundSpeedKt === undefined || groundSpeedKt <= 0) return AIRSPEED_COLOR_STOPPED;
  if (groundSpeedKt > MACH1_APPROX_KTS) return AIRSPEED_COLOR_SUPERSONIC;
  if (groundSpeedKt > 500) return AIRSPEED_COLOR_MAGENTA;
  if (groundSpeedKt > 400) return AIRSPEED_COLOR_RED;
  if (groundSpeedKt > 200) return AIRSPEED_COLOR_ORANGE;
  if (groundSpeedKt > 100) return AIRSPEED_COLOR_YELLOW;
  return AIRSPEED_COLOR_GREEN;
}

/** Parses a `#rrggbb` hex color string into an `[r, g, b]` 0-255 triple.
 * Shared by `rarityToColor` below and `aircraftLayer.ts`'s selection-glow
 * highlight, which both need to turn a `RARITY_TIER_STYLES` hex value into a
 * deck.gl-style RGB triplet. */
export function hexColorToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Blends an `[r, g, b]` triple toward white by `amount` (0-1), each channel
 * becoming `channel + (255 - channel) * amount`, rounded. Shared by
 * `aircraftLayer.ts`'s new always-on icon-glow and track-glow layers
 * (design.md Decision 2) to turn an element's own current draw color into a
 * "brighter" variant of itself, without an RGB→HSL→RGB round-trip. */
export function brightenColor(
  rgb: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * amount),
    Math.round(rgb[1] + (255 - rgb[1]) * amount),
    Math.round(rgb[2] + (255 - rgb[2]) * amount),
  ];
}

/**
 * A rarity tier's accent color, resolved directly from a type designator
 * rather than a full `Aircraft` object — `computeRarityTier`/
 * `computeRarityValue` only ever read `typeDesignator`, and track-trail
 * segments (`TrackPoint`, in `aircraft.ts`) don't carry a full `Aircraft`,
 * only whatever position/speed fields were recorded at that point in time.
 * `aircraftLayer.ts`'s track-coloring code looks the owning aircraft's
 * current `typeDesignator` up by hex and passes it here.
 */
export function rarityToColorByTypeDesignator(
  typeDesignator: string | undefined,
): [number, number, number] {
  return hexColorToRgb(RARITY_TIER_STYLES[computeRarityTier({ hex: "", typeDesignator })].color);
}

/** An aircraft's computed rarity tier's accent color (see `aircraftRarity.ts`),
 * as a deck.gl-style RGB triplet — the same color `PlaneCard` renders for
 * that tier, so the map layer and the details drawer never disagree. */
export function rarityToColor(aircraft: Aircraft): [number, number, number] {
  return rarityToColorByTypeDesignator(aircraft.typeDesignator);
}

export type ColorMode = "rarity" | "altitude" | "airspeed";

/**
 * Same dispatch as `resolveAircraftColor`, for a track-trail point instead
 * of a full `Aircraft` (see `rarityToColorByTypeDesignator`'s doc comment
 * for why rarity mode needs the owning aircraft's `typeDesignator` passed in
 * separately rather than reading it off the point itself).
 */
export function resolveTrackPointColor(
  point: { altitude: number; groundSpeed?: number },
  mode: ColorMode,
  typeDesignator: string | undefined,
): [number, number, number] {
  switch (mode) {
    case "rarity":
      return rarityToColorByTypeDesignator(typeDesignator);
    case "airspeed":
      return airspeedToColor(point.groundSpeed);
    case "altitude":
    default:
      return altitudeToColor(point.altitude);
  }
}

/** Dispatches an aircraft to its color under the currently active
 * `ColorMode` (design.md Decision 1) — the single call site
 * `aircraftLayer.ts`'s icon/track `getColor` use, so every mode's color
 * logic lives in exactly one place. */
export function resolveAircraftColor(
  aircraft: Aircraft,
  mode: ColorMode,
): [number, number, number] {
  switch (mode) {
    case "rarity":
      return rarityToColor(aircraft);
    case "airspeed":
      return airspeedToColor(aircraft.groundSpeed);
    case "altitude":
    default:
      return altitudeToColor(aircraft.altitude ?? 0);
  }
}

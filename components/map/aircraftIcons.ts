import type { Aircraft } from "./aircraft";
import { computeRarityTier, RARITY_TIER_STYLES } from "./aircraftRarity";
import { CATEGORY_FALLBACK_KEY, UNKNOWN_FALLBACK_KEY } from "./aircraftShapes";
import { MACH1_APPROX_KTS } from "./constants";
import { AIRPORT_FILL_COLOR } from "./layers";
import { computeTightViewBox } from "./svgBBox";
import {
  parseRotorBinding,
  parseViewBox,
  pivotToCanvasPixels,
  type RotorAtlasBinding,
  type RotorBinding,
} from "./rotorBindings";

export type IconSource = "type" | "category-type" | "unknown" | "generic";

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

// Suffix for the atlas entry holding a rotor-bearing type's whole drawing
// (fuselage with its rotors baked in). The plain `<KEY>` entry has the rotors
// removed so 2D mode can spin them separately; 3D mode, and the glow
// silhouette, use this one so they still show the rotors.
export const FULL_ICON_KEY_SUFFIX = "__FULL";

export function fullIconKey(key: string): string {
  return `${key}${FULL_ICON_KEY_SUFFIX}`;
}

/** Atlas key of one rotor group's own sprite for icon `key`. */
export function rotorIconKey(key: string, rotorId: string): string {
  return `${key}#${rotorId}`;
}

/**
 * Rotor bindings per icon key, for types whose SVG declares `[data-rotor]`
 * groups — populated by `buildAircraftIconAtlas`. Types with none have no
 * entry. A module-level map (like `knownTypeDesignators`), mutated in place.
 */
export const rotorBindingsByType = new Map<string, RotorAtlasBinding[]>();

/** Maps a normal atlas icon key to its pre-baked blurred glow variant's key
 * (see `GLOW_ICON_KEY_SUFFIX` and `buildAircraftIconAtlas`). */
export function glowIconKey(key: string): string {
  return `${key}${GLOW_ICON_KEY_SUFFIX}`;
}

const TYPE_SHAPE_URL = (typeDesignator: string) =>
  `/aircraft-shapes/${encodeURIComponent(typeDesignator)}.svg`;

/**
 * Type designators known to have a shape, loaded once from the manifest
 * `scripts/generate-aircraft-silhouettes.mjs` writes alongside the SVGs
 * (there's no directory-listing API for Next.js's public/ dir). Populated by
 * `buildAircraftIconAtlas`; `resolveIconKey` degrades to the generic marker
 * if called before that resolves.
 */
let knownTypeDesignators = new Set<string>();

/**
 * Resolves which atlas entry an aircraft should render with, in order: its
 * own ICAO-type-designator shape; else its ADS-B emitter category's
 * representative type (`aircraftShapes.ts`'s `CATEGORY_FALLBACK_KEY` — the
 * same table the 3D model layer and `PlaneCard` use, so an aircraft with no
 * known exact type renders the *same* shape on the map, in 3D and in its
 * detail card); else the unknown-aircraft (`UNKN`) shape; else the plain
 * generic marker — an aircraft is never left without an icon (see
 * aircraft-tracks-layer spec's icon-fallback requirement).
 */
export function resolveIconKey(aircraft: Aircraft): ResolvedIcon {
  if (aircraft.typeDesignator && knownTypeDesignators.has(aircraft.typeDesignator)) {
    return { source: "type", key: aircraft.typeDesignator };
  }
  const categoryTypeKey = aircraft.category && CATEGORY_FALLBACK_KEY[aircraft.category];
  if (categoryTypeKey && knownTypeDesignators.has(categoryTypeKey)) {
    return { source: "category-type", key: categoryTypeKey };
  }
  if (knownTypeDesignators.has(UNKNOWN_FALLBACK_KEY)) {
    return { source: "unknown", key: UNKNOWN_FALLBACK_KEY };
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
  // white (see `loadShapeSprites`/`drawGenericMarker`) specifically so this
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
 * Fetches a shape SVG and rebuilds it before rasterizing, fixing
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
const SHAPE_RASTER_SIZE = 256;

interface ShapeSprites {
  // Fuselage only when the SVG has valid rotor bindings (rotor groups
  // removed), otherwise the whole drawing.
  fuselage: HTMLImageElement | null;
  // The whole drawing, only set when `rotors` is non-empty.
  full: HTMLImageElement | null;
  rotors: Array<{
    binding: RotorBinding;
    image: HTMLImageElement | null;
    // Pivot as a 0-1 fraction of the rasterized square.
    pivotNorm: [number, number];
  }>;
}

async function loadShapeSprites(url: string): Promise<ShapeSprites | null> {
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
  // Measured over the whole drawing (rotors included) and shared by every
  // sprite of this type, so fuselage and rotor sprites stay registered.
  const tightViewBox = computeTightViewBox(innerMarkup, fallbackViewBox);

  const rasterize = async (markup: string): Promise<HTMLImageElement | null> => {
    const wrapped =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tightViewBox}" width="${SHAPE_RASTER_SIZE}" height="${SHAPE_RASTER_SIZE}">` +
      `<style>path,polygon,polyline,circle,ellipse,rect{fill:#ffffff!important;stroke:#ffffff!important;stroke-width:3px;vector-effect:non-scaling-stroke;}</style>` +
      markup +
      `</svg>`;
    const blob = new Blob([wrapped], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  // Top-level rotor groups only; ones nested in another are spun with it.
  const rotorEls = [...svgEl.querySelectorAll("[data-rotor]")].filter(
    (el) => !el.parentElement?.closest("[data-rotor]"),
  );
  const parsed = rotorEls
    .map((el, i) => ({ el, binding: parseRotorBinding(el, `r${i + 1}`) }))
    .filter((r): r is { el: Element; binding: RotorBinding } => r.binding !== null);
  // Ids name atlas entries, so they must be unique within a type.
  const seenIds = new Set<string>();
  for (const r of parsed) {
    let id = r.binding.id;
    for (let n = 2; seenIds.has(id); n++) id = `${r.binding.id}~${n}`;
    seenIds.add(id);
    r.binding.id = id;
  }

  if (parsed.length === 0) {
    return { fuselage: await rasterize(innerMarkup), full: null, rotors: [] };
  }

  const viewBox = parseViewBox(tightViewBox, SHAPE_RASTER_SIZE, SHAPE_RASTER_SIZE);
  const serializer = new XMLSerializer();
  const stripped = svgEl.cloneNode(true) as Element;
  stripped.querySelectorAll("[data-rotor]").forEach((el) => el.remove());

  const [fuselage, full, ...rotorImages] = await Promise.all([
    rasterize(stripped.innerHTML),
    rasterize(innerMarkup),
    ...parsed.map((r) => rasterize(serializer.serializeToString(r.el))),
  ]);

  return {
    fuselage,
    full,
    rotors: parsed.map((r, i) => {
      const [px, py] = pivotToCanvasPixels(
        r.binding.pivot,
        viewBox,
        SHAPE_RASTER_SIZE,
        SHAPE_RASTER_SIZE,
      );
      return {
        binding: r.binding,
        image: rotorImages[i],
        pivotNorm: [px / SHAPE_RASTER_SIZE, py / SHAPE_RASTER_SIZE] as [number, number],
      };
    }),
  };
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
 * from every shape under `public/aircraft-shapes/` (authored or generated
 * from a `.glb`; category/unknown fallbacks reuse those entries) and one
 * generic marker — built once at layer-mount time, not per-frame or
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

  const baseEntries: Array<{ key: string; url: string | null }> = [
    ...typeDesignators.map((t) => ({ key: t, url: TYPE_SHAPE_URL(t) })),
    { key: GENERIC_ICON_KEY, url: null },
  ];

  // Loaded once per unique base entry/URL, then reused for both that entry's
  // normal and glow cells — avoids fetching every vendored shape SVG twice.
  const baseSprites = await Promise.all(
    baseEntries.map((entry) => (entry.url ? loadShapeSprites(entry.url) : Promise.resolve(null))),
  );
  const imageByKey = new Map<string, HTMLImageElement | null>();
  // Whole-drawing and per-rotor sprites of rotor-bearing types: extra,
  // non-glow atlas entries.
  const extraEntries: Array<{ key: string; rotor?: { pivotNorm: [number, number] } }> = [];
  rotorBindingsByType.clear();
  const pendingBindings: Array<{ typeKey: string; binding: RotorBinding }> = [];
  baseEntries.forEach((entry, i) => {
    const sprites = baseSprites[i];
    imageByKey.set(entry.key, sprites?.fuselage ?? null);
    if (!sprites || sprites.rotors.length === 0) return;
    imageByKey.set(fullIconKey(entry.key), sprites.full);
    extraEntries.push({ key: fullIconKey(entry.key) });
    for (const rotor of sprites.rotors) {
      const key = rotorIconKey(entry.key, rotor.binding.id);
      imageByKey.set(key, rotor.image);
      extraEntries.push({ key, rotor: { pivotNorm: rotor.pivotNorm } });
      pendingBindings.push({ typeKey: entry.key, binding: rotor.binding });
    }
  });

  // Every base entry gets a second, blurred "glow" entry (see
  // `GLOW_ICON_KEY_SUFFIX`) so the icon-glow layer can render each aircraft's
  // own silhouette instead of an unrelated shape like a plain circle.
  const entries: Array<{
    key: string;
    glow: boolean;
    rotor?: { pivotNorm: [number, number] };
  }> = [
    ...baseEntries.map((e) => ({ key: e.key, glow: false })),
    ...extraEntries.map((e) => ({ key: e.key, glow: false, rotor: e.rotor })),
    ...baseEntries.map((e) => ({ key: glowIconKey(e.key), glow: true })),
  ];

  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.ceil(entries.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * CELL_SIZE;
  canvas.height = rows * CELL_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const mapping: Record<string, IconAtlasEntry> = {};
  const drawable = CELL_SIZE - CELL_PADDING * 2;
  // Hub offset from the fuselage sprite's center, per rotor atlas key.
  const hubOffsetByKey = new Map<string, [number, number]>();

  entries.forEach((entry, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;

    const baseKey = entry.glow ? entry.key.slice(0, -GLOW_ICON_KEY_SUFFIX.length) : entry.key;
    // The glow silhouette includes the rotors, hence the whole-drawing image.
    const image =
      (entry.glow ? imageByKey.get(fullIconKey(baseKey)) : null) ?? imageByKey.get(baseKey) ?? null;
    const drawableForEntry = entry.glow ? drawable * GLOW_SHRINK : drawable;

    let anchorX = CELL_SIZE / 2;
    let anchorY = CELL_SIZE / 2;

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
      ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
      if (entry.rotor) {
        // The sprite is laid out exactly like its fuselage's cell; its
        // anchor sits on the hub so IconLayer spins it about the pivot.
        const [nx, ny] = entry.rotor.pivotNorm;
        anchorX = (CELL_SIZE - w) / 2 + nx * w;
        anchorY = (CELL_SIZE - h) / 2 + ny * h;
        hubOffsetByKey.set(entry.key, [anchorX - CELL_SIZE / 2, anchorY - CELL_SIZE / 2]);
      }
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
      anchorX,
      anchorY,
      mask: true,
    };
  });

  for (const { typeKey, binding } of pendingBindings) {
    const atlasKey = rotorIconKey(typeKey, binding.id);
    const offset = hubOffsetByKey.get(atlasKey);
    // No usable rotor sprite (image failed to load): leave this rotor
    // unbound rather than spinning a generic marker.
    if (!offset) continue;
    const list = rotorBindingsByType.get(typeKey) ?? [];
    list.push({ ...binding, atlasKey, offset });
    rotorBindingsByType.set(typeKey, list);
  }

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

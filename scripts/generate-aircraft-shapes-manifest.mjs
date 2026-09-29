#!/usr/bin/env node
// One-time (or manually-re-run) generator for the aircraft-silhouette
// manifest consumed by components/map/aircraftShapes.ts. Reads the vendored
// SVGs at public/aircraft-shapes/ (originally a snapshot of
// https://github.com/RexKramer1/AircraftShapesSVG, GPL-3.0 — see
// public/aircraft-shapes/LICENSE and README.md's attribution — since joined
// by newer, user-submitted shapes added directly alongside them, some
// carrying their own `data-author` attribute) and writes a flat
// { TYPE_CODE: { viewBox, markup } } manifest, keyed by ICAO type
// designator (the filename minus its extension, upper-cased — matches this
// app's existing `Aircraft.typeDesignator` convention).
//
// Every source file's actual paths are `fill:none; stroke:#000000` outline
// drawings (confirmed by inspecting several: A320, B738, H60, Unidentified,
// BALL all follow this — there is no solid fill to speak of, just a thin
// black stroke). Two consequences drove the choices below:
//
// 1. A `<img src="....svg">` + CSS `mask-image` (this app's original
//    approach) only masks the ALPHA channel — for a stroke-only source that
//    means just the hairline stroke itself, which was empirically
//    confirmed nearly invisible at a ~48px icon size (see the git history
//    for the isolated-page test that showed this). adsb.win, inspected
//    directly, doesn't mask either — it renders a plain `<img>` and
//    recolors it with a per-tier-tuned CSS `filter: invert() sepia()
//    saturate() hue-rotate() ...` chain (a well-known "recolor a black
//    image via CSS filter" hack), which only works because `<img>` can't
//    reach into the SVG to change its actual stroke color, and needs the
//    chain re-derived per target color.
// 2. Since these SVGs are vendored (not hotlinked from adsb.win), there's a
//    strictly better option than reproducing that filter hack: rewrite
//    `stroke:#000000`/`fill:#ffffff` to `stroke:currentColor`/
//    `fill:currentColor` once here, and render the markup as an *inlined*
//    `<svg>` (not an `<img>`) so a plain CSS `color: var(--rarity-color)`
//    on the wrapping element resolves the exact tier color directly — no
//    per-color filter approximation needed. `fill:none` paths are left
//    untouched (they're meant to stay unfilled).
//
// The manifest stores each shape's inner markup (the content between the
// outer `<svg>` tags) plus its own `viewBox` (these vary per file/aircraft,
// e.g. "-22 -20 80 80" for B738 vs "-32 -30 80 80" for H60) so the consuming
// component can re-wrap it in its own `<svg viewBox=... />` sized by CSS,
// rather than keeping each file's original physical `width="80mm"
// height="80mm"` sizing.
//
// Not part of `npm run build`/CI — re-run manually and re-commit the output
// only when the vendored SVG set changes.
//
// Usage: node scripts/generate-aircraft-shapes-manifest.mjs

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Vendored files now live flat under public/aircraft-shapes/ (alongside
// LICENSE/README.md/manifest.json, filtered out below by the ".svg"
// extension check) — some newer, user-submitted shapes (see `data-author`
// below) were added directly here rather than under a "shapes" subdirectory,
// and this path was updated to match rather than left stale.
const shapesDir = path.join(ROOT, "public", "aircraft-shapes");
const outputPath = path.join(ROOT, "components", "map", "data", "aircraftShapes.json");

const files = readdirSync(shapesDir).filter((f) => f.endsWith(".svg"));

function extractShape(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) throw new Error(`No viewBox found in ${filePath}`);

  // Every <g inkscape:groupmode="layer" ...>...</g> block is a real drawing
  // layer (Inkscape also emits non-layer metadata/defs/sodipodi elements
  // this app doesn't need at all).
  const layerMarkup = [...raw.matchAll(/<g\s+inkscape:groupmode="layer"[\s\S]*?<\/g>/g)]
    .map((m) => m[0])
    // Drop every inkscape:*/sodipodi:* authoring attribute — irrelevant at
    // runtime and just adds bytes to the shipped manifest.
    .map((g) => g.replace(/\s+(inkscape|sodipodi):[a-zA-Z-]+="[^"]*"/g, ""))
    .map((g) => g.replace(/stroke:#000000/g, "stroke:currentColor"))
    .map((g) => g.replace(/fill:#ffffff/g, "fill:currentColor"))
    .join("");

  // Newer, user-submitted shapes are plain SVGs (no Inkscape layer groups).
  // They are NOT dissected here: PlaneCard reads them live from the served
  // asset (`fetchLiveShape` in components/map/aircraftShapes.ts). Returning
  // null keeps whatever entry the manifest already has for them (needed by
  // the map icons / exact-match check) instead of blanking it.
  if (!layerMarkup) return null;

  // `data-author` is deliberately NOT extracted here: authorship is read
  // live from the served .svg asset at runtime (`fetchShapeAuthor` in
  // components/map/aircraftShapes.ts), never baked into this manifest, so it
  // can't go stale relative to the asset.
  return { viewBox: viewBoxMatch[1], markup: layerMarkup };
}

/** @type {Record<string, { viewBox: string, markup: string }>} */
const manifest = {};
/** Existing manifest, so plain (live-served) SVGs keep their current entry. */
let previous = {};
try {
  previous = JSON.parse(readFileSync(outputPath, "utf-8"));
} catch {}
for (const file of files) {
  const base = file.slice(0, -4); // strip ".svg"
  if (base.endsWith("-fast")) continue; // skip; "-slow" variant wins below (no live wing-sweep telemetry to pick between them)
  const key = (base.endsWith("-slow") ? base.slice(0, -5) : base).toUpperCase();
  const shape = extractShape(path.join(shapesDir, file));
  if (shape) manifest[key] = shape;
  else if (previous[key]) manifest[key] = previous[key];
  else console.warn(`Skipping ${file}: plain SVG with no manifest entry (served live only)`);
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(outputPath, `${JSON.stringify(sorted)}\n`, "utf-8");

console.log(`Wrote ${Object.keys(sorted).length} entries to ${path.relative(ROOT, outputPath)}`);

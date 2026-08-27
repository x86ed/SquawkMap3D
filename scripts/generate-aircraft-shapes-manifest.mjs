#!/usr/bin/env node
// One-time (or manually-re-run) generator for the aircraft-silhouette
// filename manifest consumed by components/map/aircraftShapes.ts. Scans the
// vendored SVGs at public/aircraft-shapes/shapes/ (a snapshot of
// https://github.com/RexKramer1/AircraftShapesSVG, GPL-3.0 — see
// public/aircraft-shapes/LICENSE and README.md's attribution) and writes a
// flat { TYPE_CODE: "filename.svg" } map, keyed by ICAO type designator
// (the filename minus its extension, upper-cased — matches this app's
// existing `Aircraft.typeDesignator` convention).
//
// A few source filenames encode two shapes for the same type designator at
// different flight configurations ("B1 fast.svg"/"B1 slow.svg", etc. — see
// public/aircraft-shapes/shapes/ for the renamed "-fast"/"-slow" pair).
// This app has no live wing-sweep/configuration telemetry to pick between
// them, so the "slow" (gear/flaps-extended, the more static "parked/top
// view" silhouette) variant is used as that type's single canonical shape.
//
// Not part of `npm run build`/CI — re-run manually and re-commit the output
// only when the vendored SVG set changes.
//
// Usage: node scripts/generate-aircraft-shapes-manifest.mjs

import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const shapesDir = path.join(ROOT, "public", "aircraft-shapes", "shapes");
const outputPath = path.join(ROOT, "components", "map", "data", "aircraftShapes.json");

const files = readdirSync(shapesDir).filter((f) => f.endsWith(".svg"));

/** @type {Record<string, string>} */
const manifest = {};
for (const file of files) {
  const base = file.slice(0, -4); // strip ".svg"
  if (base.endsWith("-fast")) continue; // skip; "-slow" variant wins below
  const key = (base.endsWith("-slow") ? base.slice(0, -5) : base).toUpperCase();
  manifest[key] = file;
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");

console.log(`Wrote ${Object.keys(sorted).length} entries to ${path.relative(ROOT, outputPath)}`);

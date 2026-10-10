#!/usr/bin/env node
// Copies vendored per-type 3D aircraft models (aircraft/model/<TYPE>.glb,
// not tracked as a build input) into public/aircraft-models/ and writes a
// manifest.json listing which ICAO type designators have a model — same
// "no directory-listing API for Next's public/" reason
// generate-aircraft-shapes-manifest.mjs writes one for the 2D SVG shapes.
//
// Each manifest entry is just `{ type }` — this manifest only says which
// types have a vendored model at all (2D vs. 3D). Per-model data actually
// embedded in the .glb (landing-gear hide threshold, author) is read
// straight out of the binary at runtime (see aircraftModels.ts's
// `extractModelExtras`), never duplicated here, so it can't go stale
// relative to the .glb it describes.
//
// Not part of `npm run build`/CI — re-run manually and re-commit the output
// (both the copied .glb files and manifest.json) whenever aircraft/model/
// gains or loses a file.
//
// Usage: node scripts/generate-aircraft-models-manifest.mjs

import { readdirSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const sourceDir = path.join(ROOT, "aircraft", "model");
const outputDir = path.join(ROOT, "public", "aircraft-models");
const manifestPath = path.join(outputDir, "manifest.json");

mkdirSync(outputDir, { recursive: true });

const files = readdirSync(sourceDir).filter((f) => f.endsWith(".glb"));

const manifest = files
  .map((file) => ({ type: file.replace(/\.glb$/, "").toUpperCase() }))
  .sort((a, b) => a.type.localeCompare(b.type));

for (const file of files) {
  copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
}

writeFileSync(manifestPath, JSON.stringify(manifest));

console.log(`Wrote ${manifest.length} model(s) to ${outputDir}`);

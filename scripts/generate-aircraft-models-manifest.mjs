#!/usr/bin/env node
// Copies vendored per-type 3D aircraft models (aircraft/model/<TYPE>.glb,
// not tracked as a build input) into public/aircraft-models/ and writes a
// manifest.json listing which ICAO type designators have a model — same
// "no directory-listing API for Next's public/" reason
// generate-aircraft-shapes-manifest.mjs writes one for the 2D SVG shapes,
// and the same manifest shape ([TYPE_CODE, ...]) so aircraftModels.ts can
// load it the same way aircraftIcons.ts loads aircraft-shapes/manifest.json.
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
const typeDesignators = files.map((f) => f.replace(/\.glb$/, "").toUpperCase());

for (const file of files) {
  copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
}

writeFileSync(manifestPath, JSON.stringify(typeDesignators.sort()));

console.log(`Wrote ${typeDesignators.length} model(s) to ${outputDir}`);

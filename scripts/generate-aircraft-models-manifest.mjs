#!/usr/bin/env node
// Copies vendored per-type 3D aircraft models (aircraft/model/<TYPE>.glb,
// not tracked as a build input) into public/aircraft-models/ and writes a
// manifest.json listing which ICAO type designators have a model — same
// "no directory-listing API for Next's public/" reason
// generate-aircraft-shapes-manifest.mjs writes one for the 2D SVG shapes.
//
// Each manifest entry is `{ type, landingGearHideAboveFeetAGL? }` rather
// than a bare type string — `landingGearHideAboveFeetAGL` is read straight
// out of the glTF's own "Landing gear" node (`node.extras.landingGear.
// hideAboveFeetAGL`, e.g. B738.glb) when the model has one, so
// aircraftLayer.ts knows which modeled types need their gear-visibility
// split without loading/parsing the .glb itself. Omitted for models with no
// "Landing gear" node.
//
// Not part of `npm run build`/CI — re-run manually and re-commit the output
// (both the copied .glb files and manifest.json) whenever aircraft/model/
// gains or loses a file.
//
// Usage: node scripts/generate-aircraft-models-manifest.mjs

import { readdirSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const sourceDir = path.join(ROOT, "aircraft", "model");
const outputDir = path.join(ROOT, "public", "aircraft-models");
const manifestPath = path.join(outputDir, "manifest.json");

mkdirSync(outputDir, { recursive: true });

const files = readdirSync(sourceDir).filter((f) => f.endsWith(".glb"));

/**
 * Reads a .glb's embedded JSON chunk (the glTF header) without pulling in a
 * full glTF loader — this script only needs `nodes[].extras`, not geometry.
 */
function readGlbJsonChunk(filePath) {
  const buf = readFileSync(filePath);
  const chunkLength = buf.readUInt32LE(12);
  const jsonBytes = buf.subarray(20, 20 + chunkLength);
  return JSON.parse(jsonBytes.toString("utf8"));
}

const manifest = files
  .map((file) => {
    const typeDesignator = file.replace(/\.glb$/, "").toUpperCase();
    const gltf = readGlbJsonChunk(path.join(sourceDir, file));
    const landingGearNode = gltf.nodes?.find((n) => n.name === "Landing gear");
    const hideAboveFeetAGL = landingGearNode?.extras?.landingGear?.hideAboveFeetAGL;
    return {
      type: typeDesignator,
      ...(typeof hideAboveFeetAGL === "number" ? { landingGearHideAboveFeetAGL: hideAboveFeetAGL } : {}),
    };
  })
  .sort((a, b) => a.type.localeCompare(b.type));

for (const file of files) {
  copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
}

writeFileSync(manifestPath, JSON.stringify(manifest));

console.log(`Wrote ${manifest.length} model(s) to ${outputDir}`);

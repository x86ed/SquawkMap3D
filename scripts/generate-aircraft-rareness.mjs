#!/usr/bin/env node
// One-time (or manually-re-run) generator for the vendored rarity snapshot
// consumed by components/map/aircraftRarity.ts. Reads the sibling
// `taildragger` game project's own aircraft-data.json (a local-dev-machine
// path, NOT part of this repo and never fetched/read at runtime by this
// app — see openspec/changes/aircraft-info-overlay/design.md Decision 5),
// filters to rows with a defined `rareness` field, trims each to just
// `{ id, rareness }` (dropping every other game-specific field), sorts by
// `id`, and writes the result to components/map/data/aircraftRareness.json.
//
// This is NOT part of `npm run build`/CI (CI has no access to the sibling
// repo's local path) — run manually by a developer with `taildragger`
// checked out locally, and re-run + re-commit the output whenever that
// project's dataset meaningfully changes. No fixed cadence.
//
// Usage: node scripts/generate-aircraft-rareness.mjs [path-to-taildragger-aircraft-data.json]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const DEFAULT_SOURCE_PATH = path.join(
  path.dirname(ROOT),
  "git",
  "taildragger",
  "aircraft-data.json",
);
const sourcePath = process.argv[2] ?? DEFAULT_SOURCE_PATH;
const outputPath = path.join(ROOT, "components", "map", "data", "aircraftRareness.json");

const raw = readFileSync(sourcePath, "utf-8");
/** @type {{ rows: Array<{ id: string, rareness?: number }> }} */
const data = JSON.parse(raw);

const trimmed = data.rows
  .filter((row) => typeof row.rareness === "number")
  .map((row) => ({ id: row.id, rareness: row.rareness }))
  .sort((a, b) => a.id.localeCompare(b.id));

// Compact (no pretty-printing), matching this repo's other vendored JSON
// data snapshots (public/data/airports.geojson, military-bases.geojson).
writeFileSync(outputPath, `${JSON.stringify(trimmed)}\n`, "utf-8");

console.log(`Wrote ${trimmed.length} entries to ${path.relative(ROOT, outputPath)}`);

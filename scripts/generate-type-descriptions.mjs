#!/usr/bin/env node
// One-time (or manually-re-run) generator for the vendored ICAO
// aircraft-type-designator -> description lookup consumed by
// components/map/typeDescriptionLookup.ts, for the plane-listing panel's
// Type description filter (design.md Decision 14). Reads OpenFlights' own
// `planes.dat` (https://github.com/jpatokal/openflights, freely-
// redistributable, no attribution required for derived data — same source
// family/license as `airlineDesignators.json`'s `airlines.dat`, see
// design.md Decision 11), a comma-separated file with columns:
//   Name, IATA code, ICAO code
// Filters to rows with a non-empty, non-"\N" ICAO code (readsb's own type
// designator format, e.g. "A320", "B738"), keeps only `{ icao, description }`
// (renaming `Name` -> `description` to match this app's own field naming),
// sorts by `icao`, and writes the result to
// components/map/data/typeDescriptions.json.
//
// This is NOT part of `npm run build`/CI — run manually by a developer and
// re-run + re-commit the output only if OpenFlights' dataset needs
// refreshing. No fixed cadence.
//
// Usage: node scripts/generate-type-descriptions.mjs <path-to-planes.dat>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/generate-type-descriptions.mjs <path-to-planes.dat>");
  process.exit(1);
}
const outputPath = path.join(ROOT, "components", "map", "data", "typeDescriptions.json");

// Minimal CSV parser: OpenFlights' `planes.dat` quotes every field and
// escapes embedded quotes as `""`, one row per line, no embedded newlines —
// same format/parser as generate-airline-designators.mjs.
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const raw = readFileSync(sourcePath, "utf-8");
const lines = raw.split("\n").filter((line) => line.trim().length > 0);

// Real ICAO type designators are 2-4 uppercase alphanumeric characters
// (ICAO Doc 8643); this filters out OpenFlights' handful of malformed/
// placeholder rows.
const ICAO_TYPE_DESIGNATOR_PATTERN = /^[A-Z0-9]{2,4}$/;

const byIcao = new Map();
for (const line of lines) {
  const fields = parseCsvLine(line);
  const [name, , icao] = fields;
  if (!icao || icao === "\\N") continue;
  const trimmedIcao = icao.trim();
  if (!ICAO_TYPE_DESIGNATOR_PATTERN.test(trimmedIcao)) continue;
  if (!name || name.trim() === "") continue;
  byIcao.set(trimmedIcao, name.trim());
}

const trimmed = Array.from(byIcao.entries())
  .map(([icao, description]) => ({ icao, description }))
  .sort((a, b) => a.icao.localeCompare(b.icao));

// Compact (no pretty-printing), matching this repo's other vendored JSON
// data snapshots (aircraftRareness.json, airlineDesignators.json).
writeFileSync(outputPath, `${JSON.stringify(trimmed)}\n`, "utf-8");

console.log(`Wrote ${trimmed.length} entries to ${path.relative(ROOT, outputPath)}`);

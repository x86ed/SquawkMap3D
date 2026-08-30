#!/usr/bin/env node
// One-time (or manually-re-run) generator for the vendored ICAO
// callsign-prefix -> airline-name lookup consumed by
// components/map/airlineLookup.ts. Reads OpenFlights' own `airlines.dat`
// (https://github.com/jpatokal/openflights, freely-redistributable, no
// attribution required for derived data — see design.md Decision 11), a
// comma-separated file with columns:
//   Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
// Filters to rows with a non-empty, non-"\N" ICAO code and Active === "Y",
// keeps only `{ icao, name }`, sorts by `icao`, and writes the result to
// components/map/data/airlineDesignators.json.
//
// This is NOT part of `npm run build`/CI — run manually by a developer and
// re-run + re-commit the output only if OpenFlights' dataset needs
// refreshing. No fixed cadence.
//
// Usage: node scripts/generate-airline-designators.mjs [path-to-airlines.dat]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error(
    "Usage: node scripts/generate-airline-designators.mjs <path-to-airlines.dat>",
  );
  process.exit(1);
}
const outputPath = path.join(ROOT, "components", "map", "data", "airlineDesignators.json");

// Minimal CSV parser: OpenFlights' `airlines.dat` quotes every field and
// escapes embedded quotes as `""`, one row per line, no embedded newlines.
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

const ICAO_DESIGNATOR_PATTERN = /^[A-Z]{3}$/;

const byIcao = new Map();
for (const line of lines) {
  const fields = parseCsvLine(line);
  const [, name, , , icao, , , active] = fields;
  if (!icao || icao === "\\N") continue;
  const trimmedIcao = icao.trim();
  // Real ICAO airline designators are always exactly 3 uppercase letters
  // (ICAO Doc 8585); OpenFlights' data has a handful of malformed/placeholder
  // rows ("--+", "...", etc.) that this filters out.
  if (!ICAO_DESIGNATOR_PATTERN.test(trimmedIcao)) continue;
  if (active !== "Y") continue;
  if (!name || name.trim() === "") continue;
  byIcao.set(trimmedIcao, name.trim());
}

const trimmed = Array.from(byIcao.entries())
  .map(([icao, name]) => ({ icao, name }))
  .sort((a, b) => a.icao.localeCompare(b.icao));

// Compact (no pretty-printing), matching this repo's other vendored JSON
// data snapshots (aircraftRareness.json, public/data/airports.geojson).
writeFileSync(outputPath, `${JSON.stringify(trimmed)}\n`, "utf-8");

console.log(`Wrote ${trimmed.length} entries to ${path.relative(ROOT, outputPath)}`);

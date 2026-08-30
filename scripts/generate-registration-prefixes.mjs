#!/usr/bin/env node
// One-time (or manually-re-run) generator for the vendored tail-number
// (aircraft registration) prefix -> ISO 3166-1 alpha-2 country code table
// consumed by components/map/registrationCountry.ts, for the plane-listing
// panel's Flag column.
//
// Source data: Wikipedia's "List of aircraft registration prefixes"
// (https://en.wikipedia.org/wiki/List_of_aircraft_registration_prefixes),
// a wikitable of {Country or region, Registration prefix, Presentation and
// notes}. This script does not scrape that page itself (its rendered HTML
// table uses rowspans/footnotes that are easiest to hand-extract once, not
// worth a bundled HTML-parsing dependency for a single-use vendoring
// script) — it instead takes an already-extracted, already-flattened
// `[{ country, prefix }, ...]` JSON as input (one row per registration
// prefix a country/region is allocated, taking each prefix cell's leading
// token when a cell lists more than one range/note) and resolves each
// `country` name to its ISO 3166-1 alpha-2 code the same way
// `airportPopup.ts`'s `countryNameForCode` resolves the reverse direction:
// via `Intl.DisplayNames`, here built into a name -> code map by
// brute-force enumerating every two-letter code (see `buildNameToCodeMap`).
//
// A handful of names/codes need a manual override, documented inline:
//  - `Intl.DisplayNames` resolves both "GB" and "UK" to "United Kingdom";
//    brute-force enumeration order would otherwise leave "UK" (not a real
//    ISO 3166-1 code) as the winning code for that name.
//  - A few prefixes are genuinely shared by more than one
//    country/territory in the real world (e.g. "HB" — Switzerland and
//    Liechtenstein; "B" — China and Taiwan; "LV" — primarily Argentina,
//    also a minor Latvian glider/balloon-only allocation): this table can
//    only hold one country per prefix, so the internationally primary/
//    larger allocation holder wins, and the loser is simply not
//    resolvable via this lookup (an accepted, documented gap — see
//    registrationCountry.ts's doc comment).
//  - A few table rows aren't single-country ISO entries at all (e.g.
//    "French West Indies", "Netherlands Antilles") and are dropped.
//
// This is NOT part of `npm run build`/CI — run manually by a developer and
// re-run + re-commit the output only if the source table needs refreshing.
// No fixed cadence.
//
// Usage: node scripts/generate-registration-prefixes.mjs <path-to-country-prefix-pairs.json>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error(
    "Usage: node scripts/generate-registration-prefixes.mjs <path-to-country-prefix-pairs.json>",
  );
  process.exit(1);
}
const outputPath = path.join(ROOT, "components", "map", "data", "registrationPrefixes.json");

/** Brute-force `Intl.DisplayNames`-backed country-name -> ISO 3166-1
 * alpha-2 code map (the reverse of `airportPopup.ts`'s `countryNameForCode`). */
function buildNameToCodeMap() {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const map = new Map();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      const name = displayNames.of(code);
      if (name && name !== code) map.set(name, code);
    }
  }
  return map;
}

// Names the automated `Intl.DisplayNames` pass doesn't resolve to the
// correct/preferred ISO 3166-1 alpha-2 code, or doesn't resolve at all
// (colloquial/alternate names Wikipedia's table uses). `null` marks a name
// deliberately dropped (not a single ISO country).
const COUNTRY_NAME_OVERRIDES = {
  "United Kingdom": "GB", // Intl.DisplayNames' brute-force pass otherwise keeps "UK", not a real ISO code
  Russia: "RU",
  "South Korea": "KR",
  "North Korea": "KP",
  "Republic of the Congo": "CG",
  "Democratic Republic of the Congo": "CD",
  "Ivory Coast": "CI",
  Laos: "LA",
  Syria: "SY",
  Vietnam: "VN",
  Iran: "IR",
  Moldova: "MD",
  Tanzania: "TZ",
  Bolivia: "BO",
  Venezuela: "VE",
  Brunei: "BN",
  Micronesia: "FM",
  "Cape Verde": "CV",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Eswatini: "SZ",
  "Vatican City": "VA",
  Palestine: "PS",
  Myanmar: "MM",
  "The Bahamas": "BS",
  Bahamas: "BS",
  "The Gambia": "GM",
  Gambia: "GM",
  Macau: "MO",
  "Hong Kong": "HK",
  Taiwan: "TW",
  Kosovo: "XK",
  Turkey: "TR",
  "Türkiye": "TR",
  "East Timor": "TL",
  "Falkland Islands": "FK",
  "French West Indies": null,
  "Saint Helena/Ascension": "SH",
  "São Tomé and Príncipe": "ST",
  "Turks and Caicos": "TC",
  "Netherlands Antilles (currently used by Curaçao and Sint Maarten )": null,
  "Jordan and Iraq": null,
};

// Prefixes genuinely shared by more than one country/territory in the real
// world — this table holds one country per prefix, so the internationally
// primary/larger allocation wins; see this file's header comment.
const AMBIGUOUS_PREFIX_WINNERS = {
  HB: "CH", // Switzerland (primary allocation; Liechtenstein shares it)
  B: "CN", // China (4-digit general allocation; Taiwan's is a separate 5-digit range)
  LV: "AR", // Argentina (primary allocation; Latvia's "LV" is a balloons/gliders-only niche range)
};

const raw = readFileSync(sourcePath, "utf-8");
/** @type {Array<{ country: string, prefix: string }>} */
const pairs = JSON.parse(raw);

const nameToCode = buildNameToCodeMap();
const byPrefix = new Map();
const unresolved = [];

for (const { country, prefix } of pairs) {
  let code = COUNTRY_NAME_OVERRIDES[country];
  if (code === undefined) code = nameToCode.get(country) ?? null;
  if (code === null) continue; // deliberately dropped or unresolved
  if (code === undefined) {
    unresolved.push(country);
    continue;
  }
  if (AMBIGUOUS_PREFIX_WINNERS[prefix]) {
    code = AMBIGUOUS_PREFIX_WINNERS[prefix];
  }
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, code);
}

if (unresolved.length > 0) {
  console.error("Unresolved country names (add to COUNTRY_NAME_OVERRIDES):", unresolved);
  process.exit(1);
}

const trimmed = Array.from(byPrefix.entries())
  .map(([prefix, countryCode]) => ({ prefix, countryCode }))
  .sort((a, b) => a.prefix.localeCompare(b.prefix));

writeFileSync(outputPath, `${JSON.stringify(trimmed)}\n`, "utf-8");

console.log(`Wrote ${trimmed.length} entries to ${path.relative(ROOT, outputPath)}`);

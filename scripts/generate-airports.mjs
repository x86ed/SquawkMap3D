#!/usr/bin/env node
// Generates public/data/airports.geojson from the OurAirports (CC0) airports
// dataset, filtered to large/medium (i.e. public-use) airports.
//
// Source CSV: data/sources/ourairports-airports.csv
// (downloaded from https://davidmegginson.github.io/ourairports-data/airports.csv)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_CSV = path.join(
  __dirname,
  "..",
  "data",
  "sources",
  "ourairports-airports.csv",
);
const OUTPUT_GEOJSON = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "airports.geojson",
);

const INCLUDED_TYPES = new Set(["large_airport", "medium_airport"]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (char === "\r") {
      // skip, handled by trailing \n
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const csvText = readFileSync(SOURCE_CSV, "utf-8");
const rows = parseCsv(csvText).filter((r) => r.length > 1);
const header = rows[0];
const col = (name) => header.indexOf(name);

const idx = {
  ident: col("ident"),
  type: col("type"),
  name: col("name"),
  latitude: col("latitude_deg"),
  longitude: col("longitude_deg"),
  elevation: col("elevation_ft"),
  isoCountry: col("iso_country"),
  isoRegion: col("iso_region"),
  municipality: col("municipality"),
  icaoCode: col("icao_code"),
  iataCode: col("iata_code"),
};

const features = [];
for (const r of rows.slice(1)) {
  const type = r[idx.type];
  if (!INCLUDED_TYPES.has(type)) continue;

  const lat = Number(r[idx.latitude]);
  const lon = Number(r[idx.longitude]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  features.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
    properties: {
      ident: r[idx.ident],
      type,
      name: r[idx.name],
      elevation_ft: r[idx.elevation] ? Number(r[idx.elevation]) : null,
      iso_country: r[idx.isoCountry],
      iso_region: r[idx.isoRegion],
      municipality: r[idx.municipality] || null,
      icao_code: r[idx.icaoCode] || null,
      iata_code: r[idx.iataCode] || null,
    },
  });
}

const geojson = {
  type: "FeatureCollection",
  features,
};

writeFileSync(OUTPUT_GEOJSON, JSON.stringify(geojson));
console.log(`Wrote ${features.length} airports to ${OUTPUT_GEOJSON}`);

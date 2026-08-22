#!/usr/bin/env node
// Filters/simplifies the raw DoD MIRTA (Military Installations, Ranges, and
// Training Areas) GeoJSON down to a reasonable size for client-side bundling.
//
// Source: data/sources/mirta.geojson (825 Polygon/MultiPolygon features, ~23MB)
// Output: public/data/military-bases.geojson

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { simplify } from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_GEOJSON = path.join(
  __dirname,
  "..",
  "data",
  "sources",
  "mirta.geojson",
);
const OUTPUT_GEOJSON = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "military-bases.geojson",
);

// Degrees of tolerance for Douglas-Peucker simplification. ~0.001 deg is
// roughly 100m at the equator — plenty of precision for a basemap overlay.
const SIMPLIFY_TOLERANCE = 0.001;

const source = JSON.parse(readFileSync(SOURCE_GEOJSON, "utf-8"));

const features = source.features.map((feature) => {
  const simplified = simplify(feature, {
    tolerance: SIMPLIFY_TOLERANCE,
    highQuality: false,
    mutate: false,
  });

  const props = feature.properties ?? {};
  return {
    type: "Feature",
    geometry: simplified.geometry,
    properties: {
      name: props.SITENAME || props.FEATURENAME || null,
      status: props.SITEOPERATIONALSTATUS || null,
      component: props.SITEREPORTINGCOMPONENT || null,
      state: props.STATENAMECODE || null,
      country: props.COUNTRYNAME || null,
      joint_base: props.ISJOINTBASE === "yes",
    },
  };
});

const geojson = {
  type: "FeatureCollection",
  features,
};

writeFileSync(OUTPUT_GEOJSON, JSON.stringify(geojson));
console.log(`Wrote ${features.length} military bases to ${OUTPUT_GEOJSON}`);

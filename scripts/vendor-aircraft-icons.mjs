#!/usr/bin/env node
// Vendors the two aircraft-icon asset sets used by the aircraft layer's icon
// fallback chain (see components/map/aircraftIcons.ts):
//   1. AircraftShapesSVG's top-down shapes, keyed by ICAO type designator —
//      the primary icon source.
//   2. A small, hand-picked set of pw-silhouettes' per-airframe SVGs, one per
//      ADS-B emitter category (resolved from that repo's generics/*.json
//      "aliasOf" mappings) — the fallback when no type-specific shape exists.
// Neither repo is an npm package, so there's no postinstall copy step (like
// flag-icons); this script fetches from GitHub at a pinned commit (not a
// moving branch) and is meant to be re-run manually to refresh the vendored
// copy, not on every install. Re-run and commit the result to update.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const AIRCRAFT_SHAPES_SVG_COMMIT = "0743718760c42a5e91801adc053b5b828a434a5e";
const PW_SILHOUETTES_COMMIT = "c3818c276b0191208d413aa9bdd7903cd862b446";

const AIRCRAFT_SHAPES_SVG_RAW_BASE = `https://raw.githubusercontent.com/RexKramer1/AircraftShapesSVG/${AIRCRAFT_SHAPES_SVG_COMMIT}`;
const PW_SILHOUETTES_RAW_BASE = `https://raw.githubusercontent.com/plane-watch/pw-silhouettes/${PW_SILHOUETTES_COMMIT}`;

const SHAPES_OUTPUT_DIR = path.join(ROOT, "public", "aircraft-shapes");
const SILHOUETTES_OUTPUT_DIR = path.join(ROOT, "public", "aircraft-silhouettes");

// AircraftShapesSVG's exact "Shapes SVG/" directory listing at the pinned
// commit (182 files, confirmed via the GitHub contents API — not guessed).
// Entries carry their `.svg` extension since a few filenames contain a space
// (variant pairs like "B1 fast"/"B1 slow", "TOR fast"/"TOR slow") and one
// isn't a type designator at all ("Unidentified") — those are still vendored
// for completeness but won't be matched by resolveIconKey's exact `t` lookup.
const AIRCRAFT_SHAPE_FILENAMES = [
  "A10.svg","A124.svg","A19N.svg","A20N.svg","A21N.svg","A225.svg","A306.svg",
  "A310.svg","A318.svg","A320.svg","A321.svg","A332.svg","A333.svg","A337.svg",
  "A338.svg","A339.svg","A342.svg","A343.svg","A345.svg","A346.svg","A359.svg",
  "A35K.svg","A388.svg","A3ST.svg","A4.svg","A400.svg","AJET.svg","AN12.svg",
  "AN26.svg","AS21.svg","AS32.svg","AS65.svg","AT45.svg","AT75.svg","ATP.svg",
  "B1 fast.svg","B1 slow.svg","B190.svg","B29.svg","B350.svg","B38M.svg",
  "B39M.svg","B52.svg","B703.svg","B712.svg","B722.svg","B733.svg","B734.svg",
  "B735.svg","B737.svg","B738.svg","B739.svg","B742.svg","B744.svg","B748.svg",
  "B74S.svg","B752.svg","B753.svg","B762.svg","B763.svg","B764.svg","B772.svg",
  "B773.svg","B779.svg","B77L.svg","B77W.svg","B788.svg","B789.svg","B78X.svg",
  "BALL.svg","BCS1.svg","BCS3.svg","BLCF.svg","BN2P.svg","C130.svg","C160.svg",
  "C17.svg","C172.svg","C2.svg","C208.svg","C25B.svg","C295.svg","C5M.svg",
  "C750.svg","CL2T.svg","CN35.svg","CRJ2.svg","CRJ7.svg","CRJ9.svg","CRJX.svg",
  "CVN-65.svg","D228.svg","D328.svg","DA42.svg","DC10.svg","DC3.svg","DC87.svg",
  "DH8C.svg","DH8D.svg","DO27.svg","DO28.svg","E170.svg","E195.svg","E300.svg",
  "E35L.svg","E390.svg","E3CF.svg","E3TF.svg","E737.svg","E8.svg","EC20.svg",
  "EC35.svg","EC45.svg","EUFI.svg","F15.svg","F16.svg","F18H.svg","F18S.svg",
  "F22.svg","F35.svg","F406.svg","F5.svg","F50.svg","FA7X.svg","GAZL.svg",
  "GL5T.svg","GLF6.svg","GYRO.svg","H47.svg","H60.svg","H64.svg","HAWK.svg",
  "HUNT.svg","IL62.svg","IL76.svg","J328.svg","K35E.svg","KC2.svg","KC46.svg",
  "L159.svg","LJ35.svg","LYNX.svg","M326.svg","MD11.svg","MI24.svg","MIRA.svg",
  "MRF1.svg","NH90.svg","P1.svg","P180.svg","P28A.svg","P3.svg","P8.svg",
  "PA46.svg","PC12.svg","PC6T.svg","PC9.svg","Q4.svg","R135.svg","R44.svg",
  "RFAL.svg","RJ85.svg","S61.svg","SB39.svg","SC7.svg","SF25.svg","SF34.svg",
  "SGUP.svg","SR22.svg","ST75.svg","SU95.svg","T204.svg","T38.svg","TIGR.svg",
  "TOR fast.svg","TOR slow.svg","U2.svg","UH1.svg","Unidentified.svg",
  "V22 fast.svg","V22 slow.svg","VF35.svg",
];

// Resolved from pw-silhouettes' generics/<category>.json "aliasOf"/"art"
// fields (category-set letters per DO-260B: typeCode 4 -> "A", 3 -> "B",
// 2 -> "C") to a single representative silhouette filename in that repo's
// silhouettes/ directory. Multi-frame animated entries (e.g. rotorcraft
// blade positions, quadcopter spin) use only their first frame — this
// fallback tier is static, not animated. Files without a bare
// "<alias>.svg" use pw-silhouettes' numbered-variant naming ("<alias>-1.svg").
const CATEGORY_FALLBACK_FILES = {
  A1: "C172-1.svg", // light
  A2: "DH8B-1.svg", // medium 1
  A3: "B738.svg", // medium 2
  A4: "B752.svg", // high vortex
  A5: "B77W.svg", // heavy
  A6: "F16.svg", // high performance
  A7: "B06-1.svg", // rotorcraft
  B1: "ASK21.svg", // glider/sailplane
  B2: "Zeppelin_NT-1.svg", // lighter-than-air
  B3: "Parachutist.svg", // parachutist/skydiver
  B4: "Hang_Glider.svg", // ultralight/hang-glider/paraglider
  B6: "Quadcopter-1.svg", // UAV
  B7: "Space_Shuttle.svg", // space/transatmospheric
  C1: "Rosenbauer_Panther_ARFF.svg", // surface emergency vehicle
  C2: "Airport_Baggage_Tug.svg", // surface service vehicle
};

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
  }
  return response.text();
}

async function main() {
  mkdirSync(SHAPES_OUTPUT_DIR, { recursive: true });
  mkdirSync(SILHOUETTES_OUTPUT_DIR, { recursive: true });

  const shapesLicense = await fetchText(`${AIRCRAFT_SHAPES_SVG_RAW_BASE}/LICENSE`);
  writeFileSync(path.join(SHAPES_OUTPUT_DIR, "LICENSE"), shapesLicense);

  let shapeCount = 0;
  for (const filename of AIRCRAFT_SHAPE_FILENAMES) {
    const url = `${AIRCRAFT_SHAPES_SVG_RAW_BASE}/${encodeURIComponent("Shapes SVG")}/${encodeURIComponent(filename)}`;
    try {
      const svg = await fetchText(url);
      writeFileSync(path.join(SHAPES_OUTPUT_DIR, filename), svg);
      shapeCount++;
    } catch (err) {
      console.warn(`skip ${filename}: ${err.message}`);
    }
  }
  console.log(`Vendored ${shapeCount}/${AIRCRAFT_SHAPE_FILENAMES.length} AircraftShapesSVG type shapes to ${SHAPES_OUTPUT_DIR}`);

  // Manifest of vendored type designators, fetched once at runtime by
  // aircraftIcons.ts so it knows which `/aircraft-shapes/<t>.svg` files
  // actually exist without needing a directory-listing API (Next.js's
  // public/ dir doesn't expose one). Single source of truth: derived from
  // the same list just fetched above, not hand-duplicated.
  const manifest = AIRCRAFT_SHAPE_FILENAMES.filter((f) => f.endsWith(".svg")).map((f) =>
    f.slice(0, -4),
  );
  writeFileSync(
    path.join(SHAPES_OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest),
  );

  const silhouettesLicense = await fetchText(`${PW_SILHOUETTES_RAW_BASE}/LICENSE`);
  writeFileSync(path.join(SILHOUETTES_OUTPUT_DIR, "LICENSE"), silhouettesLicense);

  let categoryCount = 0;
  for (const [category, filename] of Object.entries(CATEGORY_FALLBACK_FILES)) {
    const url = `${PW_SILHOUETTES_RAW_BASE}/silhouettes/${encodeURIComponent(filename)}`;
    try {
      const svg = await fetchText(url);
      // Renamed to the ADS-B category code, not the source filename — the
      // lookup in aircraftIcons.ts keys directly off the category string.
      writeFileSync(path.join(SILHOUETTES_OUTPUT_DIR, `${category}.svg`), svg);
      categoryCount++;
    } catch (err) {
      console.warn(`skip ${category} (${filename}): ${err.message}`);
    }
  }
  console.log(`Vendored ${categoryCount}/${Object.keys(CATEGORY_FALLBACK_FILES).length} pw-silhouettes category fallbacks to ${SILHOUETTES_OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

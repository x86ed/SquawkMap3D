import aircraftShapeManifest from "./data/aircraftShapes.json";

/**
 * Top-view aircraft silhouettes, vendored from
 * https://github.com/RexKramer1/AircraftShapesSVG (GPL-3.0 — see
 * `public/aircraft-shapes/LICENSE` and that directory's attribution
 * README). 179 shapes keyed by ICAO type designator (the same key this app
 * already uses for `Aircraft.typeDesignator` and the rarity dataset lookup
 * in `aircraftRarity.ts`), generated once by
 * `scripts/generate-aircraft-shapes-manifest.mjs` into
 * `components/map/data/aircraftShapes.json` — re-run that script manually
 * if the vendored SVG set changes; this isn't part of the build/CI.
 *
 * Every shape is a plain white silhouette (`fill:#ffffff`) with no other
 * color baked in, by design: rather than re-coloring each SVG file, callers
 * apply this app's own tier/rarity accent color via a CSS `mask-image`
 * (see `PlaneCard.module.css`'s `.shapeIcon`), so the same vendored file
 * works unmodified at any accent color without needing per-tier asset
 * variants.
 */
const SHAPES_BASE_PATH = "/aircraft-shapes/shapes";
const UNIDENTIFIED_KEY = "UNIDENTIFIED";

const manifest = aircraftShapeManifest as Record<string, string>;

/** The vendored silhouette's public URL for `typeDesignator`, or the
 * shape set's own "Unidentified aircraft" fallback silhouette when
 * `typeDesignator` is unset or has no matching shape. */
export function getAircraftShapeUrl(typeDesignator: string | undefined): string {
  const filename =
    (typeDesignator && manifest[typeDesignator.toUpperCase()]) || manifest[UNIDENTIFIED_KEY];
  return `${SHAPES_BASE_PATH}/${filename}`;
}

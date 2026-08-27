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
 * Every vendored file's paths are plain `fill:none; stroke:#000000` outline
 * drawings — there's no solid silhouette fill to speak of. Rather than
 * loading them as `<img>` and trying to recolor a rasterized image (what
 * adsb.win does, via a per-tier-tuned CSS `filter: invert() sepia()
 * hue-rotate() ...` chain — confirmed by inspecting their live site; it
 * only works because `<img>` can't reach into the SVG to change the actual
 * stroke color), the generator script already rewrote every
 * `stroke:#000000`/`fill:#ffffff` to `stroke:currentColor`/
 * `fill:currentColor`. Callers render `markup` as an *inlined* SVG (not an
 * `<img src>`) so a plain CSS `color` on the wrapping element resolves the
 * exact tier accent color directly — see `PlaneCard.module.css`'s
 * `.shapeIcon`.
 */
export interface AircraftShape {
  viewBox: string;
  /** Inner SVG markup (the vendored file's drawing layers) — render inside
   * your own `<svg viewBox={shape.viewBox}>` via `dangerouslySetInnerHTML`.
   * Sourced from the vendored, license-attributed files at build time
   * (`generate-aircraft-shapes-manifest.mjs`), never from user input. */
  markup: string;
}

const UNIDENTIFIED_KEY = "UNIDENTIFIED";

const manifest = aircraftShapeManifest as Record<string, AircraftShape>;

/** The vendored silhouette for `typeDesignator`, or the shape set's own
 * "Unidentified aircraft" fallback shape when `typeDesignator` is unset or
 * has no matching entry. */
export function getAircraftShape(typeDesignator: string | undefined): AircraftShape {
  return (typeDesignator && manifest[typeDesignator.toUpperCase()]) || manifest[UNIDENTIFIED_KEY];
}

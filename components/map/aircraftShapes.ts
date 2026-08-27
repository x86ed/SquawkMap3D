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

/**
 * ADS-B emitter category ("A0"-"D7", readsb's `category`) → a representative
 * manifest key, for when `typeDesignator` isn't available. Unlike
 * `typeDesignator` (readsb's `t`, only populated when the feeder has loaded
 * tar1090-db — see `Aircraft.typeDesignator`'s doc comment), the emitter
 * category is sent in the aircraft's own ADS-B transmissions and is
 * essentially always present. It's a coarse size/role bucket, not a real
 * type match, so this only stands in for the exact silhouette — it's still
 * far more informative than every aircraft in a bucket collapsing to the
 * same generic "Unidentified" outline. Categories with no reasonable
 * representative in the vendored 179-shape set (UAVs, surface vehicles,
 * obstacles, etc.) are omitted and fall through to `UNIDENTIFIED_KEY`.
 */
const CATEGORY_FALLBACK_KEY: Record<string, string> = {
  A1: "C172", // light (<15,500 lbs) — small single/twin prop
  A2: "PC12", // small (15,500-75,000 lbs) — turboprop
  A3: "B738", // large (75,000-300,000 lbs) — typical airliner
  A4: "B752", // high vortex large
  A5: "B744", // heavy (>300,000 lbs)
  A6: "F16", // high performance / high speed
  A7: "R44", // rotorcraft
  B1: "SF25", // glider/sailplane
  B2: "BALL", // lighter-than-air
};

/** The vendored silhouette for `typeDesignator`, its emitter-`category`'s
 * representative shape when the exact type isn't available, or the shape
 * set's own "Unidentified aircraft" fallback when neither is. */
export function getAircraftShape(typeDesignator: string | undefined, category?: string): AircraftShape {
  const exact = typeDesignator && manifest[typeDesignator.toUpperCase()];
  if (exact) return exact;

  const fallbackKey = category && CATEGORY_FALLBACK_KEY[category.toUpperCase()];
  const byCategory = fallbackKey && manifest[fallbackKey];
  return byCategory || manifest[UNIDENTIFIED_KEY];
}

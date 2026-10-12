/**
 * Top-down aircraft shapes under `public/aircraft-shapes/<KEY>.svg`, keyed
 * by ICAO type designator (the same key this app uses for
 * `Aircraft.typeDesignator`, the rarity dataset lookup in
 * `aircraftRarity.ts`, and `public/aircraft-models/<KEY>.glb`).
 *
 * Every file there is either authored in-repo (root `data-author`) or
 * generated from its type's `.glb` model by
 * `scripts/generate-aircraft-silhouettes.mjs` (root `data-generated`, no
 * author) — no third-party shape set is shipped. Both kinds are plain
 * `fill="currentColor"` SVGs, so callers inline the file and a CSS `color`
 * on the wrapping element tints it (see `PlaneCard.module.css`'s
 * `.shapeIcon`).
 */

/** Shape/model key used when an aircraft has no usable type or category. */
export const UNKNOWN_FALLBACK_KEY = "UNKN";

/**
 * ADS-B emitter category ("A0"-"D7", readsb's `category`) → a representative
 * shape/model key, for when `typeDesignator` isn't available or has no
 * asset. Unlike `typeDesignator` (readsb's `t`, only populated when the
 * feeder has loaded tar1090-db — see `Aircraft.typeDesignator`'s doc
 * comment), the emitter category is sent in the aircraft's own ADS-B
 * transmissions and is essentially always present. The first group is a
 * coarse size/role bucket, not a real type match; the special categories
 * below it map to dedicated models. Categories without an entry (cluster
 * and line obstacles, reserved values) fall through to
 * `UNKNOWN_FALLBACK_KEY`.
 *
 * Shared with `aircraftModels.ts` (3D model resolution) and
 * `aircraftIcons.ts` (map-marker icons) so the card, the 3D model and the
 * map's 2D icon for an aircraft of unknown exact type always agree.
 */
export const CATEGORY_FALLBACK_KEY: Record<string, string> = {
  A1: "C172", // light (<15,500 lbs) — small single/twin prop
  A2: "PC12", // small (15,500-75,000 lbs) — turboprop
  A3: "B738", // large (75,000-300,000 lbs) — typical airliner
  A4: "B752", // high vortex large
  A5: "B744", // heavy (>300,000 lbs)
  A6: "F16", // high performance / high speed
  A7: "R44", // rotorcraft
  B1: "SF25", // glider/sailplane
  B2: "BALL", // lighter-than-air
  B3: "PARA", // parachutist / skydiver
  B4: "ULAC", // ultralight / hang-glider / paraglider
  B6: "VFHC", // unmanned aerial vehicle
  B7: "FALH", // space / transatmospheric vehicle
  C1: "FIRE", // surface vehicle — emergency
  C2: "PTUG", // surface vehicle — service
  C3: "TURB", // point obstacle
};

/** The shape keys to try for an aircraft, most specific first: its own type,
 * its emitter category's representative, then the unknown-aircraft shape. */
export function shapeKeyCandidates(typeDesignator: string | undefined, category?: string): string[] {
  const keys: string[] = [];
  if (typeDesignator) keys.push(typeDesignator.toUpperCase());
  const byCategory = category ? CATEGORY_FALLBACK_KEY[category.toUpperCase()] : undefined;
  if (byCategory) keys.push(byCategory);
  keys.push(UNKNOWN_FALLBACK_KEY);
  return [...new Set(keys)];
}

/** A shape read live from its served `.svg` asset (never cached). */
export interface LiveShape {
  /** The whole file, unmodified — inline it as-is. */
  raw: string;
  /** Which key's file this is. */
  key: string;
  /** Whether `key` is the aircraft's own exact type designator (as opposed
   * to its category's representative or the unknown-aircraft shape). */
  exact: boolean;
  /** Root `data-author`, only ever set for an exact match: a fallback shape
   * is someone else's asset and crediting it would misattribute it to an
   * unrelated aircraft. Generated shapes have no author. */
  author?: string;
}

/**
 * Reads the best available shape for an aircraft live (`cache: "no-store"`),
 * walking `shapeKeyCandidates` until a file exists. Resolves `undefined`
 * when none can be fetched.
 */
export async function fetchLiveShape(
  typeDesignator: string | undefined,
  category?: string,
): Promise<LiveShape | undefined> {
  const keys = shapeKeyCandidates(typeDesignator, category);
  const exactKey = typeDesignator?.toUpperCase();
  for (const key of keys) {
    try {
      const response = await fetch(`/aircraft-shapes/${encodeURIComponent(key)}.svg`, { cache: "no-store" });
      if (!response.ok) continue;
      const raw = await response.text();
      const exact = key === exactKey;
      const author = exact ? raw.match(/<svg[^>]*\sdata-author="([^"]*)"/)?.[1]?.trim() || undefined : undefined;
      return { raw, key, exact, ...(author ? { author } : {}) };
    } catch {
      continue;
    }
  }
  return undefined;
}

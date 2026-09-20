import { load } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";
import type { Aircraft } from "./aircraft";
import { CATEGORY_FALLBACK_KEY } from "./aircraftShapes";

interface AircraftModelManifestEntry {
  type: string;
  /** Feet AGL above which the model's "Landing gear" node should be hidden
   * (retracted) — read straight out of the glTF's own node extras by
   * `scripts/generate-aircraft-models-manifest.mjs`. Omitted for models
   * with no "Landing gear" node. */
  landingGearHideAboveFeetAGL?: number;
}

/**
 * ICAO type designators known to have a vendored 3D model, loaded once from
 * the manifest `scripts/generate-aircraft-models-manifest.mjs` writes
 * alongside the vendored `.glb` files under `public/aircraft-models/`
 * (mirrors `aircraftIcons.ts`'s `knownTypeDesignators` — there's no
 * directory-listing API for Next.js's `public/` dir). Populated by
 * `loadAircraftModelManifest`; `isModeledType`/`resolveModelScenegraph`
 * degrade to "no model" (keeping an aircraft on the existing 2D icon layer)
 * if called before that resolves.
 */
let modelInfoByTypeDesignator = new Map<string, AircraftModelManifestEntry>();

/**
 * Parsed (but not GPU-uploaded — `ScenegraphLayer` does that per layer
 * instance) glTF scenegraphs, keyed by `${typeDesignator}|${gearHidden}`.
 *
 * Two independent parses per type rather than one shared object: a type
 * with a gear-hide threshold (aircraftLayer.ts) renders as two separate
 * `ScenegraphLayer`s — one gear-shown, one gear-hidden — and
 * `postProcessGLTF` (called internally by `ScenegraphLayer` on whatever
 * object its `scenegraph` prop holds) mutates its input in place,
 * dereferencing mesh/accessor indices into object references. Handing the
 * *same* parsed object to two layers would have the second layer's
 * postprocessing run on an already-postprocessed object and break. Loading
 * twice avoids that at the cost of one extra small fetch/parse per type,
 * done once at startup.
 *
 * Populated by `loadAircraftModelManifest`'s background preload;
 * `resolveModelScenegraph` returns `null` (2D icon fallback) until an
 * entry's load completes.
 */
const modelScenegraphByGroupKey = new Map<string, unknown>();

const modelUrl = (typeDesignator: string) =>
  `/aircraft-models/${encodeURIComponent(typeDesignator)}.glb`;

function scenegraphGroupKey(typeDesignator: string, gearHidden: boolean): string {
  return `${typeDesignator}|${gearHidden}`;
}

/**
 * Fetches+parses every manifest entry's `.glb` exactly once each (per
 * gear-visibility variant — see `modelScenegraphByGroupKey`), independently
 * of `ScenegraphLayer`'s own built-in async `scenegraph` URL-prop loading.
 *
 * Deliberately not going through `ScenegraphLayer`'s `scenegraph: url`
 * async-prop resolution (as an earlier version of this code did): that
 * mechanism resolves against whichever `Layer` instance happened to be
 * mounted when the load kicked off, but aircraftLayer.ts's
 * `buildAircraftLayers` constructs a *new* `ScenegraphLayer` instance every
 * feeder poll (~1s) to carry each poll's fresh aircraft data — the async
 * resolution can land on an already-discarded instance and never reach the
 * poll's current one, leaving `state.scenegraph` permanently unset (no
 * error, just nothing rendered — confirmed by manually re-invoking the
 * layer's own scenegraph-build method on a live instance, which loaded
 * fine on demand). Pre-loading here and handing `buildAircraftLayers` an
 * already-resolved object every time sidesteps that race entirely.
 */
async function preloadModelScenegraphs(entries: AircraftModelManifestEntry[]): Promise<void> {
  const variants = entries.flatMap((entry) =>
    [false, entry.landingGearHideAboveFeetAGL !== undefined].map((gearHidden) => ({
      type: entry.type,
      gearHidden,
    })),
  );
  await Promise.all(
    variants.map(async ({ type, gearHidden }) => {
      try {
        const gltf = await load(modelUrl(type), GLTFLoader);
        modelScenegraphByGroupKey.set(scenegraphGroupKey(type, gearHidden), gltf);
      } catch {
        // Leave unset — resolveModelScenegraph's null keeps this type on
        // the 2D icon layer instead.
      }
    }),
  );
}

/**
 * Fetches the vendored 3D-model manifest once at layer-mount time (same
 * pattern/cadence as `aircraftIcons.ts`'s `buildAircraftIconAtlas` manifest
 * fetch), then kicks off the (independent, not awaited here) scenegraph
 * preload above.
 */
export async function loadAircraftModelManifest(): Promise<void> {
  const response = await fetch("/aircraft-models/manifest.json").catch(() => null);
  const entries: AircraftModelManifestEntry[] = response?.ok ? await response.json() : [];
  modelInfoByTypeDesignator = new Map(entries.map((entry) => [entry.type, entry]));
  void preloadModelScenegraphs(entries);
}

/**
 * The vendored-model manifest key for `aircraft` — its own exact ICAO type
 * designator if that's vendored, else (mirroring `aircraftIcons.ts`'s
 * `resolveIconKey`/`aircraftShapes.ts`'s `getAircraftShape` category
 * fallback, via the same `CATEGORY_FALLBACK_KEY` table) its emitter
 * category's representative modeled type, or `undefined` if neither is
 * vendored — the caller should fall back to the 2D icon in that case. Kept
 * in lockstep with the 2D fallback chain so a GA type real ADS-B traffic
 * reports as a variant designator the model manifest doesn't carry (e.g. a
 * Cessna 172S variant, category `A1`) still gets the model its 2D icon
 * already falls back to, instead of only ever matching a literal manifest
 * entry.
 */
export function resolveModelKey(aircraft: Aircraft): string | undefined {
  if (aircraft.typeDesignator && modelInfoByTypeDesignator.has(aircraft.typeDesignator)) {
    return aircraft.typeDesignator;
  }
  const fallbackKey = aircraft.category && CATEGORY_FALLBACK_KEY[aircraft.category.toUpperCase()];
  if (fallbackKey && modelInfoByTypeDesignator.has(fallbackKey)) {
    return fallbackKey;
  }
  return undefined;
}

/** Model keys whose vendored .glb is a helicopter — their "Rotors" nodes
 * spin about a vertical/sideways axis rather than the fuselage axis. */
const ROTORCRAFT_MODEL_KEYS = new Set(["R44", "H60"]);

export const isRotorcraftModel = (modelKey: string): boolean => ROTORCRAFT_MODEL_KEYS.has(modelKey);

/** Whether `aircraft` has a vendored 3D model, either its own exact type or
 * (see `resolveModelKey`) its category's fallback type. */
export function isModeledType(aircraft: Aircraft): boolean {
  return resolveModelKey(aircraft) !== undefined;
}

/**
 * The pre-parsed glTF scenegraph for `modelKey`'s (see `resolveModelKey`)
 * vendored model in the given gear-visibility variant, or `null` if that key
 * has no model or its preload (see `preloadModelScenegraphs`) hasn't
 * completed yet — either way, the caller should fall back to the 2D icon
 * for this poll.
 */
export function resolveModelScenegraph(modelKey: string, gearHidden: boolean): unknown | null {
  return modelScenegraphByGroupKey.get(scenegraphGroupKey(modelKey, gearHidden)) ?? null;
}

/**
 * Feet AGL above which `modelKey`'s (see `resolveModelKey`) vendored model
 * has retractable landing gear that should render hidden, or `undefined`
 * when that model has no "Landing gear" node (e.g. no vendored model at
 * all, or a fixed-gear type like C172) — see `AircraftModelManifestEntry`
 * above.
 */
export function landingGearHideThresholdFeet(modelKey: string | undefined): number | undefined {
  if (!modelKey) return undefined;
  return modelInfoByTypeDesignator.get(modelKey)?.landingGearHideAboveFeetAGL;
}

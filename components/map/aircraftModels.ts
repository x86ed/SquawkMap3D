import { load } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";
import type { Aircraft } from "./aircraft";

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
 * Whether `aircraft`'s exact ICAO type designator has a vendored 3D model —
 * the 2D icon fallback chain (`aircraftIcons.ts`'s `resolveIconKey`) still
 * applies when this is false. Only ever matches an aircraft's exact type,
 * never a category/generic fallback like `resolveIconKey` does — a
 * wrong-model 3D mesh would read as far more misleading than a wrong-shape
 * 2D silhouette.
 */
export function isModeledType(aircraft: Aircraft): boolean {
  return !!aircraft.typeDesignator && modelInfoByTypeDesignator.has(aircraft.typeDesignator);
}

/**
 * The pre-parsed glTF scenegraph for `typeDesignator`'s vendored model in
 * the given gear-visibility variant, or `null` if that type has no model or
 * its preload (see `preloadModelScenegraphs`) hasn't completed yet — either
 * way, the caller should fall back to the 2D icon for this poll.
 */
export function resolveModelScenegraph(typeDesignator: string, gearHidden: boolean): unknown | null {
  return modelScenegraphByGroupKey.get(scenegraphGroupKey(typeDesignator, gearHidden)) ?? null;
}

/**
 * Feet AGL above which `typeDesignator`'s vendored model has retractable
 * landing gear that should render hidden, or `undefined` when that type's
 * model has no "Landing gear" node (e.g. no vendored model at all, or a
 * fixed-gear type like C172) — see `AircraftModelManifestEntry` above.
 */
export function landingGearHideThresholdFeet(typeDesignator: string | undefined): number | undefined {
  if (!typeDesignator) return undefined;
  return modelInfoByTypeDesignator.get(typeDesignator)?.landingGearHideAboveFeetAGL;
}

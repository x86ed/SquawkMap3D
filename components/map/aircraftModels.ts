import { load } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";
import type { Aircraft } from "./aircraft";
import { CATEGORY_FALLBACK_KEY } from "./aircraftShapes";

interface AircraftModelManifestEntry {
  /** Only tells us which ICAO type designators have a vendored `.glb` at all
   * (i.e. whether to use the 3D model instead of the 2D icon) — nothing
   * else. Per-model data that's actually embedded in the `.glb` itself
   * (landing-gear threshold, author) is read straight out of the parsed
   * glTF at load time (see `modelExtrasByTypeDesignator` below), never
   * duplicated into this manifest, so it can't go stale relative to the
   * binary. */
  type: string;
}

/** Per-model data read straight out of each vendored `.glb`'s own node
 * extras once its glTF is parsed (`preloadModelScenegraphs` below) — never
 * sourced from the manifest, so it can't drift out of sync with the binary
 * `.glb` it describes. */
interface AircraftModelExtras {
  /** Feet AGL above which the model's "Landing gear" node should be hidden
   * (retracted) — from `node.extras.landingGear.hideAboveFeetAGL`. Omitted
   * for models with no "Landing gear" node. */
  landingGearHideAboveFeetAGL?: number;
  /** Modeler handle, from whichever node carries a `node.extras.
   * authorship.author` (found on the root mesh node, e.g. "Aircraft visual
   * hull" — not every vendored model has this yet). Omitted when the model
   * has no embedded authorship metadata. */
  author?: string;
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
 * Per-type `AircraftModelExtras`, populated by `preloadModelScenegraphs` as
 * each type's `.glb` finishes parsing — empty (all lookups `undefined`,
 * degrading exactly like `resolveModelScenegraph` does) until that
 * type's parse completes.
 */
const modelExtrasByTypeDesignator = new Map<string, AircraftModelExtras>();

/** Extracts `AircraftModelExtras` straight out of an already-parsed glTF's
 * node list — same fields, same node-matching rules
 * (`scripts/generate-aircraft-models-manifest.mjs` extracted these
 * identically from the raw `.glb` at build time). `load(url, GLTFLoader)`
 * (no `postProcess` option passed, same as `preloadModelScenegraphs` below)
 * returns the *raw* parsed glTF under `.json`, not a postprocessed
 * top-level `.nodes` — `gltf.json.nodes[].extras` is the same untouched
 * node-extras data the build-time script reads straight off the binary. */
function extractModelExtras(gltf: { json?: { nodes?: { name?: string; extras?: unknown }[] } }): AircraftModelExtras {
  const landingGearNode = gltf.json?.nodes?.find((n) => n.name === "Landing gear");
  const hideAboveFeetAGL = (landingGearNode?.extras as { landingGear?: { hideAboveFeetAGL?: unknown } } | undefined)
    ?.landingGear?.hideAboveFeetAGL;
  const authorNode = gltf.json?.nodes?.find(
    (n) => typeof (n.extras as { authorship?: { author?: unknown } } | undefined)?.authorship?.author === "string",
  );
  const author = (authorNode?.extras as { authorship?: { author?: string } } | undefined)?.authorship?.author;
  return {
    ...(typeof hideAboveFeetAGL === "number" ? { landingGearHideAboveFeetAGL: hideAboveFeetAGL } : {}),
    ...(typeof author === "string" && author.trim() ? { author: author.trim() } : {}),
  };
}

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

export const modelUrl = (typeDesignator: string) =>
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
export async function preloadModelScenegraphs(entries: AircraftModelManifestEntry[]): Promise<void> {
  await Promise.all(
    entries.map(async ({ type }) => {
      try {
        // Loaded once per type (not per gear-visibility variant, unlike
        // before) — whether this type even has a "Landing gear" node isn't
        // known until after this parse, so both variants are always built;
        // for a type with no such node, the "hidden" variant is just an
        // extra identical parse (postProcessGLTF mutates its input in
        // place — see modelScenegraphByGroupKey's doc comment — so it still
        // can't be the same object shared between the two keys).
        const [shown, hidden] = await Promise.all([
          load(modelUrl(type), GLTFLoader),
          load(modelUrl(type), GLTFLoader),
        ]);
        modelScenegraphByGroupKey.set(scenegraphGroupKey(type, false), shown);
        modelScenegraphByGroupKey.set(scenegraphGroupKey(type, true), hidden);
        modelExtrasByTypeDesignator.set(
          type,
          extractModelExtras(shown as { json?: { nodes?: { name?: string; extras?: unknown }[] } }),
        );
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
  return resolveModelKeyForTypeAndCategory(aircraft.typeDesignator, aircraft.category);
}

/**
 * `resolveModelKey`'s lookup, taking the two fields it actually reads
 * directly rather than a full `Aircraft` — lets callers holding only a
 * type designator/category (e.g. `PlaneCard`'s props) resolve a vendored
 * model key without constructing a fake `Aircraft`.
 */
export function resolveModelKeyForTypeAndCategory(
  typeDesignator: string | undefined,
  category: string | undefined,
): string | undefined {
  if (typeDesignator && modelInfoByTypeDesignator.has(typeDesignator)) {
    return typeDesignator;
  }
  const fallbackKey = category && CATEGORY_FALLBACK_KEY[category.toUpperCase()];
  if (fallbackKey && modelInfoByTypeDesignator.has(fallbackKey)) {
    return fallbackKey;
  }
  return undefined;
}

/**
 * Whether `typeDesignator` itself has a vendored model — i.e. whether
 * `resolveModelKeyForTypeAndCategory` would resolve to `typeDesignator`'s
 * own exact model rather than its emitter category's representative
 * fallback (or, for the compass card, the pinned default stand-in). Callers
 * crediting a model's embedded author (`modelAuthor`) MUST check this
 * first: a category-fallback or default stand-in model can itself carry
 * real author metadata (it's a real vendored model, just not *this*
 * aircraft's), and crediting it here would misattribute someone else's
 * model to an unrelated aircraft.
 */
export function isExactModelMatch(typeDesignator: string | undefined): boolean {
  return !!typeDesignator && modelInfoByTypeDesignator.has(typeDesignator);
}

/** Model keys whose vendored .glb is a helicopter — their "Rotors" nodes
 * spin about a vertical/sideways axis rather than the fuselage axis. */
const ROTORCRAFT_MODEL_KEYS = new Set(["R44", "H60", "AS35", "AS50"]);

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
 * all, or a fixed-gear type like C172) — see `AircraftModelExtras` above.
 */
export function landingGearHideThresholdFeet(modelKey: string | undefined): number | undefined {
  if (!modelKey) return undefined;
  return modelExtrasByTypeDesignator.get(modelKey)?.landingGearHideAboveFeetAGL;
}

/**
 * `modelKey`'s (see `resolveModelKey`) vendored model's embedded modeler
 * handle, or `undefined` when it has no recorded authorship metadata (most
 * vendored models today — see `AircraftModelExtras`'s doc comment) or
 * `modelKey` itself is unset.
 */
export function modelAuthor(modelKey: string | undefined): string | undefined {
  if (!modelKey) return undefined;
  return modelExtrasByTypeDesignator.get(modelKey)?.author;
}

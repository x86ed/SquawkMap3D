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
 * `loadAircraftModelManifest`; `resolveModelUrl` degrades to `null` (keeping
 * an aircraft on the existing 2D icon layer) if called before that
 * resolves.
 */
let modelInfoByTypeDesignator = new Map<string, AircraftModelManifestEntry>();

const modelUrl = (typeDesignator: string) =>
  `/aircraft-models/${encodeURIComponent(typeDesignator)}.glb`;

/**
 * Fetches the vendored 3D-model manifest once at layer-mount time (same
 * pattern/cadence as `aircraftIcons.ts`'s `buildAircraftIconAtlas` manifest
 * fetch), so `resolveModelUrl` can start returning real model URLs as soon
 * as it resolves without needing a full icon-atlas rebuild.
 */
export async function loadAircraftModelManifest(): Promise<void> {
  const response = await fetch("/aircraft-models/manifest.json").catch(() => null);
  const entries: AircraftModelManifestEntry[] = response?.ok ? await response.json() : [];
  modelInfoByTypeDesignator = new Map(entries.map((entry) => [entry.type, entry]));
}

/**
 * The vendored 3D model URL for `aircraft`'s exact ICAO type designator, or
 * `null` when no model is vendored for it — the 2D icon fallback chain
 * (`aircraftIcons.ts`'s `resolveIconKey`) still applies in that case. Only
 * ever matches an aircraft's exact type, never a category/generic fallback
 * like `resolveIconKey` does — a wrong-model 3D mesh would read as far more
 * misleading than a wrong-shape 2D silhouette.
 */
export function resolveModelUrl(aircraft: Aircraft): string | null {
  if (aircraft.typeDesignator && modelInfoByTypeDesignator.has(aircraft.typeDesignator)) {
    return modelUrl(aircraft.typeDesignator);
  }
  return null;
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

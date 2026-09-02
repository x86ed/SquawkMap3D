import type { Aircraft } from "./aircraft";

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
let knownModelTypeDesignators = new Set<string>();

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
  const typeDesignators: string[] = response?.ok ? await response.json() : [];
  knownModelTypeDesignators = new Set(typeDesignators);
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
  if (aircraft.typeDesignator && knownModelTypeDesignators.has(aircraft.typeDesignator)) {
    return modelUrl(aircraft.typeDesignator);
  }
  return null;
}

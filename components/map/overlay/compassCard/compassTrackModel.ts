import { getModelCrudUrl, buildCrudUrl } from "../../constants";
import {
  modelUrl,
  modelAuthor,
  landingGearHideThresholdFeet,
  resolveModelKeyForTypeAndCategory,
  isExactModelMatch,
  isRotorcraftModel,
} from "../../aircraftModels";
import type { RarityTier } from "./vendor/core";
import type { CompassTrackModel } from "./vendor/core";

/** Feet-to-meters, for converting `landingGearHideThresholdFeet`'s feet-AGL
 * value into `CompassTrackModel.gearDeploymentAltitudeMeters`. */
const METERS_PER_FOOT = 0.3048;

/** Every vendored `.glb`'s retractable-gear node uses this exact name (see
 * `animatedAircraftScenegraphLayer.ts`'s `LANDING_GEAR_NODE_ID` and
 * `scripts/generate-aircraft-models-manifest.mjs`), so it's a fixed
 * constant here rather than per-model data. */
const GEAR_MESH_GROUP_NAME = "Landing gear";

/**
 * Last-resort model key for the compass card when even `aircraftModels.ts`'s
 * own category fallback (`resolveModelKeyForTypeAndCategory`) has nothing —
 * unlike `PlaneCard`'s front-face art, which can drop to a flat 2D
 * silhouette instead, the compass card only ever renders a `.glb`, so it
 * needs *something* to always resolve to. Pinned to `"B738"`: already
 * vendored, and already relied on elsewhere as `CATEGORY_FALLBACK_KEY`'s
 * `"A3"` (large/typical-airliner) representative — removing it would
 * already break that fallback, so this adds no new fragility (see design.md
 * Risks). Never expected to carry embedded author metadata (a stand-in, not
 * an attributed model), so it always resolves as unauthored.
 */
export const DEFAULT_COMPASS_MODEL_KEY = "B738";

/**
 * Builds the compass card's `CompassTrackModel` input for the selected
 * aircraft, reusing this app's existing vendored `.glb` model pipeline
 * (`aircraftModels.ts`) rather than a separate dataset — see design.md's
 * "Reuse aircraftModels.ts's existing vendored .glb pipeline" decision.
 *
 * `variant` is accepted for forward compatibility only — this app has no
 * variant data source yet, so it's currently unused in the lookup; a future
 * change can refine `resolveModelKeyForTypeAndCategory`'s resolution (or add
 * a variant-aware one) once real variant data exists.
 */
export function getCompassTrackModel(
  typeDesignator: string | undefined,
  category: string | undefined,
  variant: string | undefined,
  rarityTier: RarityTier,
): CompassTrackModel {
  const modelKey = resolveModelKeyForTypeAndCategory(typeDesignator, category) ?? DEFAULT_COMPASS_MODEL_KEY;

  const hideAboveFeetAGL = landingGearHideThresholdFeet(modelKey);
  // No retractable-gear node on this model: pick a threshold the live scene
  // can never cross (altitude is never below negative infinity), so
  // `isGearVisible` always reports "hidden" — moot anyway since
  // `mountCompassTrackCard` only toggles a mesh group it actually finds by
  // name, and this model has none.
  const gearDeploymentAltitudeMeters =
    hideAboveFeetAGL === undefined ? -Infinity : hideAboveFeetAGL * METERS_PER_FOOT;

  // A category-fallback or default stand-in model can itself carry real
  // author metadata (it's a real vendored model, just not *this* aircraft's
  // — a wake-class/category placeholder standing in for an unmatched type
  // must never inherit its stand-in's credit). Only trust `modelAuthor`
  // when the resolved key is this aircraft's own exact type.
  const author = isExactModelMatch(typeDesignator) ? modelAuthor(modelKey) : undefined;
  const modelerName = author ?? "";
  const modelerProfileUrl = author ? `https://adsb.win/operators/${encodeURIComponent(author)}` : "";

  const modelCrudUrlTemplate = getModelCrudUrl();
  const modelerAddUrl =
    !author && modelCrudUrlTemplate
      ? buildCrudUrl(modelCrudUrlTemplate, { icao: typeDesignator, variant })
      : undefined;

  return {
    modelUrl: modelUrl(modelKey),
    rarityTier,
    gearMeshGroupName: GEAR_MESH_GROUP_NAME,
    gearDeploymentAltitudeMeters,
    modelerName,
    modelerProfileUrl,
    modelerAddUrl,
    rotorcraft: isRotorcraftModel(modelKey),
  };
}

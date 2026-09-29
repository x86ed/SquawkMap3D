// Vendored from https://github.com/plens-win/Card
// packages/core/src/compass-track-card.types.ts @ 39734839 (2026-09-28).
// See compass-track-card.ts's doc comment for vendoring rationale.

import type { RarityTier } from './rarity';

/** Static, per-aircraft-model metadata for the `compass-track` card kind —
 * the reconstructed model's asset location plus the fields
 * `packages/compass-track-three` needs to toggle landing-gear visibility and
 * credit the modeler, none of which come from live telemetry. */
export interface CompassTrackModel {
  /** URL of the reconstructed 3D model asset (e.g. a `.glb`) to load. */
  modelUrl: string;
  /** This aircraft's rarity tier — drives the emissive glow tint applied to
   * the loaded model (see `RARITY_TIER_STYLES`). */
  rarityTier: RarityTier;
  /** Name/tag of the mesh group within the loaded model's scene graph that
   * represents the landing gear, toggled by altitude (see
   * `gearDeploymentAltitudeMeters`). */
  gearMeshGroupName: string;
  /** Altitude (meters) at or below which the landing gear mesh group is
   * shown; above it, the gear is hidden. */
  gearDeploymentAltitudeMeters: number;
  /** Name of the person credited for the 3D model, shown in the bottom-right
   * HUD credit link. */
  modelerName: string;
  /** URL of the modeler's profile, used as the bottom-right HUD credit
   * link's `href`. */
  modelerProfileUrl: string;
  /** Call-to-action URL for the bottom-right HUD's `UNKNOWN` placeholder
   * when `modelerName` or `modelerProfileUrl` is blank. Omitted/empty: the
   * placeholder renders as unlinked text. Has no effect when both
   * `modelerName` and `modelerProfileUrl` are non-blank. */
  modelerAddUrl?: string;
}

/** A single live telemetry snapshot for the `compass-track` card kind —
 * the shape of both `CompassTrackCardInput.initialState` and every later
 * `mountCompassTrackCard` handle's `update()` argument. */
export interface CompassTrackState {
  headingDegrees: number;
  pitchDegrees: number;
  altitudeMeters: number;
  latitude: number;
  longitude: number;
  /** Ground speed in meters/second, driving the ground-grid scroll rate (1
   * grid square = 5 meters). Omitted: the scene holds its most recently
   * known rate rather than stopping the scroll. */
  groundSpeedMetersPerSecond?: number;
}

/** The `compass-track` card variant's JSON-serializable input contract:
 * static `model` metadata plus the first telemetry snapshot (`initialState`)
 * to render before any `update()` call. */
export interface CompassTrackCardInput {
  kind: 'compass-track';
  model: CompassTrackModel;
  initialState: CompassTrackState;
}

import type { CompassTrackState } from "./vendor/core";

/** Only the live telemetry fields `buildCompassTrackState` actually needs —
 * a narrow shape rather than the full `SelectedAircraftInfo` (which also
 * carries unrelated fields like `altitudeSeries`/`route`), so a caller that
 * only has these individual fields (e.g. `RecordPanelHero`'s own per-field
 * props, matching this app's existing per-component prop convention) isn't
 * forced to fabricate the rest. */
export interface CompassTrackTelemetryInput {
  track?: number;
  verticalRate?: number;
  altitude?: number;
  groundSpeed?: number;
  lat?: number;
  lon?: number;
}

const METERS_PER_FOOT = 0.3048;
const METERS_PER_SECOND_PER_KNOT = 0.514444;
/** Feet/minute → meters/second. */
const METERS_PER_SECOND_PER_FOOT_PER_MINUTE = METERS_PER_FOOT / 60;

/** Clamp on the estimated pitch (degrees) — see `estimatePitchDegrees`'s
 * doc comment for why this is an estimate, not real attitude data. */
const MAX_ESTIMATED_PITCH_DEGREES = 20;

/**
 * ADS-B carries no real pitch/attitude data. This estimates a visually
 * plausible pitch the same way most consumer flight trackers do — the climb
 * angle implied by vertical rate over ground speed (`atan2`, so a
 * near-zero ground speed doesn't blow up toward ±90°) — clamped to a small
 * range so an unusual/noisy reading never pitches the model to an extreme
 * angle. This is a display approximation, not a claim of real aircraft
 * attitude (design.md's "Estimated pitch is not real attitude data" risk).
 * Returns `0` when either input is unknown.
 */
export function estimatePitchDegrees(
  verticalRateFeetPerMinute: number | undefined,
  groundSpeedKnots: number | undefined,
): number {
  if (verticalRateFeetPerMinute === undefined || groundSpeedKnots === undefined) return 0;
  const verticalRateMetersPerSecond = verticalRateFeetPerMinute * METERS_PER_SECOND_PER_FOOT_PER_MINUTE;
  const groundSpeedMetersPerSecond = groundSpeedKnots * METERS_PER_SECOND_PER_KNOT;
  if (groundSpeedMetersPerSecond === 0) return 0;
  const radians = Math.atan2(verticalRateMetersPerSecond, groundSpeedMetersPerSecond);
  const degrees = (radians * 180) / Math.PI;
  return Math.max(-MAX_ESTIMATED_PITCH_DEGREES, Math.min(MAX_ESTIMATED_PITCH_DEGREES, degrees));
}

/**
 * Builds the compass card's live `CompassTrackState` from this app's own
 * `SelectedAircraftInfo`, converting units once here: altitude (feet→
 * meters), ground speed (knots→meters/second), and an estimated pitch (see
 * `estimatePitchDegrees`). `undefined` heading/position fields fall back to
 * `0` — the same "no fabricated data, just an honest zero" tolerance this
 * card's own visual approximation already accepts for pitch.
 */
export function buildCompassTrackState(info: CompassTrackTelemetryInput): CompassTrackState {
  const groundSpeedMetersPerSecond =
    info.groundSpeed === undefined ? undefined : info.groundSpeed * METERS_PER_SECOND_PER_KNOT;

  return {
    headingDegrees: info.track ?? 0,
    pitchDegrees: estimatePitchDegrees(info.verticalRate, info.groundSpeed),
    altitudeMeters: info.altitude === undefined ? 0 : info.altitude * METERS_PER_FOOT,
    latitude: info.lat ?? 0,
    longitude: info.lon ?? 0,
    groundSpeedMetersPerSecond,
  };
}

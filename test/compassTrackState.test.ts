import test from "node:test";
import assert from "node:assert/strict";
import {
  estimatePitchDegrees,
  buildCompassTrackState,
  type CompassTrackTelemetryInput,
} from "../components/map/overlay/compassCard/compassTrackState";

function makeInfo(overrides: CompassTrackTelemetryInput = {}): CompassTrackTelemetryInput {
  return { ...overrides };
}

test("estimatePitchDegrees: climbing yields a positive pitch", () => {
  const pitch = estimatePitchDegrees(1000, 150);
  assert.ok(pitch > 0, `expected positive pitch, got ${pitch}`);
});

test("estimatePitchDegrees: descending yields a negative pitch", () => {
  const pitch = estimatePitchDegrees(-1000, 150);
  assert.ok(pitch < 0, `expected negative pitch, got ${pitch}`);
});

test("estimatePitchDegrees: level flight yields zero pitch", () => {
  assert.equal(estimatePitchDegrees(0, 150), 0);
});

test("estimatePitchDegrees: zero ground speed yields zero pitch (no divide-by-zero blowup)", () => {
  assert.equal(estimatePitchDegrees(1000, 0), 0);
});

test("estimatePitchDegrees: unknown inputs yield zero pitch", () => {
  assert.equal(estimatePitchDegrees(undefined, 150), 0);
  assert.equal(estimatePitchDegrees(1000, undefined), 0);
});

test("estimatePitchDegrees: extreme climb rate clamps to the max", () => {
  const pitch = estimatePitchDegrees(100_000, 1);
  assert.equal(pitch, 20);
});

test("estimatePitchDegrees: extreme descent rate clamps to the min", () => {
  const pitch = estimatePitchDegrees(-100_000, 1);
  assert.equal(pitch, -20);
});

test("buildCompassTrackState: converts units and passes heading/position through", () => {
  const info = makeInfo({
    track: 270,
    altitude: 10_000, // feet
    groundSpeed: 200, // knots
    verticalRate: 0,
    lat: 40.5,
    lon: -74.1,
  });
  const state = buildCompassTrackState(info);
  assert.equal(state.headingDegrees, 270);
  assert.equal(state.latitude, 40.5);
  assert.equal(state.longitude, -74.1);
  assert.ok(Math.abs(state.altitudeMeters - 3048) < 0.01);
  assert.ok(Math.abs((state.groundSpeedMetersPerSecond ?? 0) - 102.8888) < 0.01);
  assert.equal(state.pitchDegrees, 0);
});

test("buildCompassTrackState: unknown fields fall back to honest zeros, not fabricated values", () => {
  const state = buildCompassTrackState(makeInfo());
  assert.equal(state.headingDegrees, 0);
  assert.equal(state.latitude, 0);
  assert.equal(state.longitude, 0);
  assert.equal(state.altitudeMeters, 0);
  assert.equal(state.groundSpeedMetersPerSecond, undefined);
});

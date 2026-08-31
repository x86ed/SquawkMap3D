import test from "node:test";
import assert from "node:assert/strict";
import { cursorIndexFromFraction, nearestPointByTimestamp } from "../components/map/overlay/FlightInfoPane";
import type { SparklinePoint } from "../components/map/overlay/selectedAircraftInfo";

function point(timestamp: number, value = 0): SparklinePoint {
  return { timestamp, value };
}

test("cursorIndexFromFraction returns null for an empty series", () => {
  assert.equal(cursorIndexFromFraction(0, 0.5), null);
});

test("cursorIndexFromFraction always returns 0 for a single-point series", () => {
  assert.equal(cursorIndexFromFraction(1, 0), 0);
  assert.equal(cursorIndexFromFraction(1, 0.5), 0);
  assert.equal(cursorIndexFromFraction(1, 1), 0);
});

test("cursorIndexFromFraction resolves fraction 0 to the first index", () => {
  assert.equal(cursorIndexFromFraction(5, 0), 0);
});

test("cursorIndexFromFraction resolves fraction 1 to the last index", () => {
  assert.equal(cursorIndexFromFraction(5, 1), 4);
});

test("cursorIndexFromFraction resolves a mid-range fraction to the nearest index", () => {
  assert.equal(cursorIndexFromFraction(5, 0.5), 2);
});

test("cursorIndexFromFraction clamps out-of-range fractions before rounding", () => {
  assert.equal(cursorIndexFromFraction(5, -0.5), 0);
  assert.equal(cursorIndexFromFraction(5, 1.5), 4);
});

test("nearestPointByTimestamp returns undefined for an empty series", () => {
  assert.equal(nearestPointByTimestamp([], 1_000), undefined);
});

test("nearestPointByTimestamp returns an exact timestamp match", () => {
  const series = [point(0), point(1_000), point(2_000)];
  assert.equal(nearestPointByTimestamp(series, 1_000), series[1]);
});

test("nearestPointByTimestamp resolves to the nearest-below point when closer", () => {
  const series = [point(0), point(1_000), point(3_000)];
  assert.equal(nearestPointByTimestamp(series, 1_100), series[1]);
});

test("nearestPointByTimestamp resolves to the nearest-above point when closer", () => {
  const series = [point(0), point(1_000), point(3_000)];
  assert.equal(nearestPointByTimestamp(series, 2_900), series[2]);
});

test("nearestPointByTimestamp breaks an exact-distance tie in favor of the earlier point", () => {
  const series = [point(1_000), point(3_000)];
  assert.equal(nearestPointByTimestamp(series, 2_000), series[0]);
});

test("nearestPointByTimestamp always returns the single point for a one-point series", () => {
  const series = [point(5_000)];
  assert.equal(nearestPointByTimestamp(series, 999_999), series[0]);
});

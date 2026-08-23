import test from "node:test";
import assert from "node:assert/strict";
import {
  sunEquatorialPosition,
  julianDay,
  terminatorLatitudeAtLongitude,
} from "../components/map/terminator";

const DEG = Math.PI / 180;

test("declination is near Earth's axial tilt at the June solstice", () => {
  const { declinationDeg } = sunEquatorialPosition(
    julianDay(new Date("2024-06-21T00:00:00Z")),
  );
  assert.ok(
    Math.abs(declinationDeg - 23.44) < 0.5,
    `expected ~23.44°, got ${declinationDeg}`,
  );
});

test("declination is near the negative axial tilt at the December solstice", () => {
  const { declinationDeg } = sunEquatorialPosition(
    julianDay(new Date("2024-12-21T00:00:00Z")),
  );
  assert.ok(
    Math.abs(declinationDeg - -23.44) < 0.5,
    `expected ~-23.44°, got ${declinationDeg}`,
  );
});

test("declination is near zero at the March equinox", () => {
  // 2024 March equinox was ~2024-03-20T03:06Z.
  const { declinationDeg } = sunEquatorialPosition(
    julianDay(new Date("2024-03-20T03:06:00Z")),
  );
  assert.ok(
    Math.abs(declinationDeg) < 0.5,
    `expected ~0°, got ${declinationDeg}`,
  );
});

test("terminatorLatitudeAtLongitude at elevation=0 matches the closed-form tan(lat) = -cos(H)/tan(delta)", () => {
  const samples: Array<[declinationDeg: number, hourAngleDeg: number]> = [
    [10, 30],
    [-15, 120],
    [23.4, -60],
    [-5, 200],
    [1, -10],
  ];
  for (const [declinationDeg, hourAngleDeg] of samples) {
    const expected =
      Math.atan(-Math.cos(hourAngleDeg * DEG) / Math.tan(declinationDeg * DEG)) /
      DEG;
    const actual = terminatorLatitudeAtLongitude(0, declinationDeg, hourAngleDeg);
    assert.ok(actual !== null, `expected a solution for delta=${declinationDeg}, H=${hourAngleDeg}`);
    assert.ok(
      Math.abs((actual as number) - expected) < 1e-6,
      `delta=${declinationDeg} H=${hourAngleDeg}: expected ${expected}, got ${actual}`,
    );
  }
});

test("terminatorLatitudeAtLongitude returns null when no crossing exists", () => {
  // At a very high elevation threshold with a small declination, no
  // latitude can reach that elevation.
  const result = terminatorLatitudeAtLongitude(80, 5, 90);
  assert.equal(result, null);
});

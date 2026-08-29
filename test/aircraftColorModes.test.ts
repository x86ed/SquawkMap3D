import test from "node:test";
import assert from "node:assert/strict";
import {
  ALTITUDE_COLOR_STOPS,
  airspeedToColor,
  altitudeToColor,
  hexColorToRgb,
  rarityToColor,
  resolveAircraftColor,
  resolveTrackPointColor,
} from "../components/map/aircraftIcons";
import { MACH1_APPROX_KTS } from "../components/map/constants";
import { AIRPORT_FILL_COLOR } from "../components/map/layers";
import type { Aircraft } from "../components/map/aircraft";
import { RARITY_TIER_STYLES } from "../components/map/aircraftRarity";

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { hex: "abc123", ...overrides };
}

test("altitudeToColor at/below the first stop returns that stop's color exactly", () => {
  assert.deepEqual(altitudeToColor(0), ALTITUDE_COLOR_STOPS[0].rgb);
  assert.deepEqual(altitudeToColor(-100), ALTITUDE_COLOR_STOPS[0].rgb);
});

test("altitudeToColor at/above the last stop returns that stop's color exactly", () => {
  const last = ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1];
  assert.deepEqual(altitudeToColor(last.ft), last.rgb);
  assert.deepEqual(altitudeToColor(last.ft + 10_000), last.rgb);
});

test("altitudeToColor interpolates linearly between two adjacent stops", () => {
  const [lower, upper] = ALTITUDE_COLOR_STOPS;
  const midFt = (lower.ft + upper.ft) / 2;
  const result = altitudeToColor(midFt);
  for (let i = 0; i < 3; i++) {
    const expected = Math.round(lower.rgb[i] + (upper.rgb[i] - lower.rgb[i]) * 0.5);
    assert.equal(result[i], expected);
  }
});

test("airspeedToColor: stopped or unknown speed is grey", () => {
  assert.deepEqual(airspeedToColor(undefined), [148, 148, 148]);
  assert.deepEqual(airspeedToColor(0), [148, 148, 148]);
});

test("airspeedToColor buckets each knot band to its assigned color", () => {
  assert.deepEqual(airspeedToColor(50), [34, 197, 94]); // green, <100
  assert.deepEqual(airspeedToColor(150), [234, 179, 8]); // yellow, 100-200
  assert.deepEqual(airspeedToColor(300), [249, 115, 22]); // orange, 200-400
  assert.deepEqual(airspeedToColor(450), [220, 38, 38]); // red, 400-500
  assert.deepEqual(airspeedToColor(550), [217, 70, 239]); // magenta, >500
});

test("airspeedToColor renders the airport-icon accent color above the approximate Mach 1 threshold", () => {
  assert.deepEqual(airspeedToColor(MACH1_APPROX_KTS + 1), hexColorToRgb(AIRPORT_FILL_COLOR.light));
});

test("hexColorToRgb parses a #rrggbb hex string", () => {
  assert.deepEqual(hexColorToRgb("#ff0080"), [255, 0, 128]);
});

test("rarityToColor matches RARITY_TIER_STYLES for an unrecognized type designator", () => {
  const aircraft = makeAircraft({ typeDesignator: "ZZZZ-NOT-A-REAL-TYPE" });
  assert.deepEqual(rarityToColor(aircraft), hexColorToRgb(RARITY_TIER_STYLES.unidentified.color));
});

test("resolveAircraftColor dispatches to the matching mode's color function", () => {
  const aircraft = makeAircraft({ altitude: 0, groundSpeed: 50 });
  assert.deepEqual(resolveAircraftColor(aircraft, "altitude"), altitudeToColor(0));
  assert.deepEqual(resolveAircraftColor(aircraft, "airspeed"), airspeedToColor(50));
  assert.deepEqual(resolveAircraftColor(aircraft, "rarity"), rarityToColor(aircraft));
});

test("resolveTrackPointColor in rarity mode uses the passed-in typeDesignator, not the point itself", () => {
  const point = { altitude: 1000, groundSpeed: 50 };
  const result = resolveTrackPointColor(point, "rarity", "ZZZZ-NOT-A-REAL-TYPE");
  assert.deepEqual(result, hexColorToRgb(RARITY_TIER_STYLES.unidentified.color));
});

test("resolveTrackPointColor in altitude/airspeed modes ignores typeDesignator", () => {
  const point = { altitude: 0, groundSpeed: 50 };
  assert.deepEqual(resolveTrackPointColor(point, "altitude", undefined), altitudeToColor(0));
  assert.deepEqual(resolveTrackPointColor(point, "airspeed", undefined), airspeedToColor(50));
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaneListingRow } from "../components/map/drawer/aircraftDisplay";
import type { Aircraft } from "../components/map/aircraft";

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { hex: "a1b2c3", ...overrides };
}

test("buildPlaneListingRow computes distance from site location when both are known", () => {
  const aircraft = makeAircraft({ lat: 34.1, lon: -118.4 });
  const row = buildPlaneListingRow(aircraft, { latitude: 34.0, longitude: -118.2437 });
  assert.ok(row.distanceNm !== undefined && row.distanceNm > 0);
});

test("buildPlaneListingRow leaves distance undefined with no site location", () => {
  const aircraft = makeAircraft({ lat: 34.1, lon: -118.4 });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.distanceNm, undefined);
});

test("buildPlaneListingRow leaves distance undefined with no aircraft position", () => {
  const aircraft = makeAircraft();
  const row = buildPlaneListingRow(aircraft, { latitude: 34.0, longitude: -118.2437 });
  assert.equal(row.distanceNm, undefined);
});

test("buildPlaneListingRow resolves countryCode from registration", () => {
  const aircraft = makeAircraft({ registration: "N12345" });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.countryCode, "US");
});

test("buildPlaneListingRow resolves airlineName from callsign", () => {
  const aircraft = makeAircraft({ callsign: "UAL123" });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.airlineName, "United Airlines");
});

test("buildPlaneListingRow route starts null (resolved separately)", () => {
  const aircraft = makeAircraft({ callsign: "UAL123", lat: 34, lon: -118 });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.route, null);
});

test("buildPlaneListingRow carries through real telemetry fields unchanged", () => {
  const aircraft = makeAircraft({
    altitude: 35000,
    groundSpeed: 450,
    verticalRate: -500,
    track: 270,
    squawk: "1200",
    secondsSinceLastMessage: 3,
    messages: 5000,
    rssi: -12.5,
    sourceType: "adsb_icao",
    isMilitary: true,
    category: "A3",
    isPia: false,
    isLadd: true,
    windDirection: 90,
    windSpeed: 20,
  });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.altitude, 35000);
  assert.equal(row.groundSpeed, 450);
  assert.equal(row.verticalRate, -500);
  assert.equal(row.track, 270);
  assert.equal(row.squawk, "1200");
  assert.equal(row.secondsSinceLastMessage, 3);
  assert.equal(row.messages, 5000);
  assert.equal(row.rssi, -12.5);
  assert.equal(row.sourceType, "adsb_icao");
  assert.equal(row.isMilitary, true);
  assert.equal(row.category, "A3");
  assert.equal(row.isPia, false);
  assert.equal(row.isLadd, true);
  assert.equal(row.windDirection, 90);
  assert.equal(row.windSpeed, 20);
});

test("buildPlaneListingRow resolves rarityTier as unidentified for an unknown type", () => {
  const aircraft = makeAircraft({ typeDesignator: "ZZZZ-NOT-REAL" });
  const row = buildPlaneListingRow(aircraft, null);
  assert.equal(row.rarityTier, "unidentified");
});

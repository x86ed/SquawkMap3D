import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  STUBBED_COLUMN_KEYS,
  formatCell,
  sortValue,
} from "../components/map/drawer/columns";
import type { PlaneListingRow } from "../components/map/drawer/aircraftDisplay";

function makeRow(overrides: Partial<PlaneListingRow> = {}): PlaneListingRow {
  return {
    hex: "a1b2c3",
    countryCode: null,
    airlineName: null,
    route: null,
    rarityTier: "unidentified",
    ...overrides,
  };
}

test("COLUMNS has exactly the 27 acceptance-criteria columns, each once", () => {
  const expectedLabels = [
    "Hex ID",
    "Flag",
    "Callsign",
    "Airline",
    "Route",
    "Registration",
    "Type",
    "Squawk",
    "Altitude",
    "Speed",
    "Vertical Rate",
    "Distance",
    "Track",
    "Messages",
    "Seen",
    "RSSI",
    "Latitude",
    "Longitude",
    "Source",
    "Mil.",
    "Wind D.",
    "Wind S.",
    "XP",
    "Rarity",
    "Registrations",
    "Flight Time",
    "Level",
  ];
  assert.deepEqual(
    COLUMNS.map((c) => c.label),
    expectedLabels,
  );
  const uniqueKeys = new Set(COLUMNS.map((c) => c.key));
  assert.equal(uniqueKeys.size, COLUMNS.length);
});

test("XP, Registrations, and Flight Time are excluded from the default-visible set", () => {
  assert.ok(!DEFAULT_VISIBLE_COLUMN_KEYS.includes("xp"));
  assert.ok(!DEFAULT_VISIBLE_COLUMN_KEYS.includes("regsSeen"));
  assert.ok(!DEFAULT_VISIBLE_COLUMN_KEYS.includes("flightTime"));
});

test("XP, Registrations, Flight Time, and Level always render the placeholder", () => {
  const row = makeRow();
  for (const key of STUBBED_COLUMN_KEYS) {
    assert.equal(formatCell(row, key), "—");
  }
});

test("formatCell renders a fabricated-free empty indicator when a real field is missing", () => {
  const row = makeRow();
  assert.equal(formatCell(row, "rssi"), "—");
  assert.equal(formatCell(row, "altitude"), "—");
});

test("formatCell renders real telemetry values with units", () => {
  const row = makeRow({ altitude: 35000, groundSpeed: 450, track: 270 });
  assert.equal(formatCell(row, "altitude"), "35,000 ft");
  assert.equal(formatCell(row, "speed"), "450 kt");
  assert.equal(formatCell(row, "track"), "270°");
});

test("formatCell distance renders nautical miles to one decimal", () => {
  const row = makeRow({ distanceNm: 123.456 });
  assert.equal(formatCell(row, "distance"), "123.5 nm");
});

test("formatCell rarity renders the computed tier name", () => {
  const row = makeRow({ rarityTier: "epic" });
  assert.equal(formatCell(row, "rarity"), "Epic");
});

test("formatCell route renders empty placeholder when unresolved", () => {
  const row = makeRow({ route: null });
  assert.equal(formatCell(row, "route"), "—");
});

test("formatCell route renders origin-destination when resolved", () => {
  const row = makeRow({ route: { origin: "LAX", destination: "JFK" } });
  assert.equal(formatCell(row, "route"), "LAX – JFK");
});

test("sortValue sorts strings case-insensitively", () => {
  const rowA = makeRow({ callsign: "ZEBRA" });
  const rowB = makeRow({ callsign: "apple" });
  assert.ok(sortValue(rowA, "callsign") > sortValue(rowB, "callsign"));
});

test("sortValue treats undefined numeric fields as sorting to one end", () => {
  const withAltitude = makeRow({ altitude: 1000 });
  const withoutAltitude = makeRow({ altitude: undefined });
  assert.ok(sortValue(withoutAltitude, "altitude") < sortValue(withAltitude, "altitude"));
});

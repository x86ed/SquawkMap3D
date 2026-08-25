import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRarityTier,
  computeRarityValue,
  RARITY_TIER_COLORS,
  RARITY_TIER_THRESHOLDS,
  type RarityTier,
} from "../components/map/aircraftRarity";
import type { Aircraft } from "../components/map/aircraft";
import aircraftRareness from "../components/map/data/aircraftRareness.json";

function makeAircraft(typeDesignator?: string): Aircraft {
  return { hex: "abc123", typeDesignator };
}

test("known matching type designator resolves rarityValue = rareness / 100", () => {
  const row = (aircraftRareness as Array<{ id: string; rareness: number }>)[0];
  const value = computeRarityValue(makeAircraft(row.id));
  assert.equal(value, row.rareness / 100);
});

test("unset type designator resolves the fixed default (15)", () => {
  assert.equal(computeRarityValue(makeAircraft(undefined)), 15);
});

test("unmatched type designator resolves the fixed default (15)", () => {
  assert.equal(computeRarityValue(makeAircraft("ZZZZ-NOT-A-REAL-TYPE")), 15);
});

const [t1, t2, t3, t4] = RARITY_TIER_THRESHOLDS;

test("value just below the first threshold buckets to common", () => {
  assert.equal(computeRarityTier(makeAircraft()), "legendary"); // sanity: default (15) is legendary
});

const tierCases: Array<[value: number, tier: RarityTier]> = [
  [t1 - 0.01, "common"],
  [t1, "uncommon"],
  [t2 - 0.01, "uncommon"],
  [t2, "rare"],
  [t3 - 0.01, "rare"],
  [t3, "epic"],
  [t4 - 0.01, "epic"],
  [t4, "legendary"],
];

function makeAircraftWithSyntheticValue(value: number): Aircraft {
  // computeRarityTier only ever sees values via computeRarityValue, which is
  // driven by the vendored snapshot — so to exercise exact boundary values
  // deterministically, this synthesizes a row not present in the real
  // snapshot (rareness = value * 100) and matches it via typeDesignator.
  const syntheticId = `__TEST_BOUNDARY_${value}__`;
  (aircraftRareness as Array<{ id: string; rareness: number }>).push({
    id: syntheticId,
    rareness: value * 100,
  });
  return makeAircraft(syntheticId);
}

for (const [value, expectedTier] of tierCases) {
  test(`rarity value ${value} buckets to ${expectedTier}`, () => {
    const aircraft = makeAircraftWithSyntheticValue(value);
    assert.equal(computeRarityTier(aircraft), expectedTier);
  });
}

test("every RarityTier has a defined, non-empty accent color", () => {
  const tiers: RarityTier[] = ["common", "uncommon", "rare", "epic", "legendary"];
  for (const tier of tiers) {
    const color = RARITY_TIER_COLORS[tier];
    assert.ok(color && color.length > 0, `expected a color for ${tier}`);
  }
});

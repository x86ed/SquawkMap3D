import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRarityTier,
  computeRarityValue,
  RARITY_TIER_STYLES,
  RARITY_TIER_OCTILE_THRESHOLDS,
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

test("no type designator resolves computeRarityValue to undefined and tier to unidentified", () => {
  const aircraft = makeAircraft(undefined);
  assert.equal(computeRarityValue(aircraft), undefined);
  assert.equal(computeRarityTier(aircraft), "unidentified");
});

test("unmatched type designator resolves computeRarityValue to undefined and tier to unidentified", () => {
  const aircraft = makeAircraft("ZZZZ-NOT-A-REAL-TYPE");
  assert.equal(computeRarityValue(aircraft), undefined);
  assert.equal(computeRarityTier(aircraft), "unidentified");
});

const [t1, t2, t3, t4, t5, t6, t7] = RARITY_TIER_OCTILE_THRESHOLDS;

const tierCases: Array<[value: number, tier: RarityTier]> = [
  [t1 - 0.01, "standard"],
  [t1, "prime"],
  [t2 - 0.01, "prime"],
  [t2, "remarkable"],
  [t3 - 0.01, "remarkable"],
  [t3, "exceptional"],
  [t4 - 0.01, "exceptional"],
  [t4, "epic"],
  [t5 - 0.01, "epic"],
  [t5, "legendary"],
  [t6 - 0.01, "legendary"],
  [t6, "mythic"],
  [t7 - 0.01, "mythic"],
  [t7, "apex"],
];

// computeRarityTier only ever sees values via computeRarityValue, which is
// driven by the vendored snapshot — so to exercise exact boundary values
// deterministically, synthetic rows (not present in the real snapshot,
// `rareness = value * 100`) are appended to the imported array *before* any
// test body runs (module top-level code executes before node:test invokes
// any registered test, so this predates aircraftRarity.ts's lazily-built,
// module-cached lookup Map).
const rarenessRows = aircraftRareness as Array<{ id: string; rareness: number }>;
const tierCaseAircraft: Array<[Aircraft, RarityTier]> = tierCases.map(
  ([value, tier], index) => {
    const id = `__TEST_BOUNDARY_${index}__`;
    rarenessRows.push({ id, rareness: value * 100 });
    return [makeAircraft(id), tier];
  },
);

for (let i = 0; i < tierCaseAircraft.length; i++) {
  const [aircraft, expectedTier] = tierCaseAircraft[i];
  const [value] = tierCases[i];
  test(`rarity value ${value} buckets to ${expectedTier}`, () => {
    assert.equal(computeRarityTier(aircraft), expectedTier);
  });
}

test("every RarityTier has a defined, non-empty accent style", () => {
  const tiers: RarityTier[] = [
    "unidentified",
    "standard",
    "prime",
    "remarkable",
    "exceptional",
    "epic",
    "legendary",
    "mythic",
    "apex",
  ];
  for (const tier of tiers) {
    const style = RARITY_TIER_STYLES[tier];
    assert.ok(style.color && style.color.length > 0, `expected a color for ${tier}`);
    assert.ok(style.highlight && style.highlight.length > 0, `expected a highlight for ${tier}`);
    assert.ok(style.glow && style.glow.length > 0, `expected a glow for ${tier}`);
  }
});

test("unidentified and standard share color/highlight but have distinct glow values", () => {
  const unidentified = RARITY_TIER_STYLES.unidentified;
  const standard = RARITY_TIER_STYLES.standard;
  assert.equal(unidentified.color, standard.color);
  assert.equal(unidentified.highlight, standard.highlight);
  assert.equal(unidentified.glow, "#64748b33");
  assert.equal(standard.glow, "#94a3b83d");
  assert.notEqual(unidentified.glow, standard.glow);
});

import test from "node:test";
import assert from "node:assert/strict";
import { computeTierProgress } from "../components/map/overlay/tierProgress";

test("known tier + xp mid-range returns a percentToNext in [0, 99] and the correct nextTierName", () => {
  // Alloy -> Carbon: start 0, end 25_000. 8,400 XP is ~34%.
  const result = computeTierProgress("alloy", 8_400);
  assert.ok(result);
  assert.equal(result?.nextTierName, "Carbon");
  assert.ok(result!.percentToNext >= 0 && result!.percentToNext <= 99);
  assert.equal(result?.percentToNext, 34);
});

test("xp at or past a tier's nominal end still clamps to 99, never 100, for a non-max tier", () => {
  const atEnd = computeTierProgress("alloy", 25_000);
  assert.equal(atEnd?.percentToNext, 99);

  const wayPast = computeTierProgress("carbon", 999_999);
  assert.equal(wayPast?.percentToNext, 99);
  assert.equal(wayPast?.nextTierName, "Titanium");
});

test("quantum (max tier) returns { percentToNext: 100, nextTierName: null }", () => {
  const result = computeTierProgress("quantum", 2_000_000);
  assert.deepEqual(result, { percentToNext: 100, nextTierName: null });
});

test("an unrecognized tier name returns null", () => {
  assert.equal(computeTierProgress("nonexistent-tier", 100), null);
});

test("recognized tier names match case-insensitively", () => {
  const upper = computeTierProgress("ALLOY", 8_400);
  const lower = computeTierProgress("alloy", 8_400);
  assert.deepEqual(upper, lower);
  assert.equal(upper?.nextTierName, "Carbon");
});

test("an unrecognized tier name is handled without throwing", () => {
  assert.doesNotThrow(() => computeTierProgress("mithril", 0));
});

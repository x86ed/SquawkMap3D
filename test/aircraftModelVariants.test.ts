import test from "node:test";
import assert from "node:assert/strict";
import { resolveVariant } from "../components/map/aircraft";
import { resolveAircraftShape, type AircraftShape } from "../components/map/aircraftShapes";

// aircraft.ts's registration→variant lookup (see resolveVariant's doc
// comment for why it's parameterized rather than closing over the real
// aircraftVariants.json directly).
test("resolveVariant matches a registration case-insensitively", () => {
  assert.equal(resolveVariant("n182fl", { N182FL: "FLOATS" }), "FLOATS");
});

test("resolveVariant returns undefined for a missing registration", () => {
  assert.equal(resolveVariant(undefined, { N182FL: "FLOATS" }), undefined);
});

test("resolveVariant returns undefined for an unmatched registration", () => {
  assert.equal(resolveVariant("N999ZZ", { N182FL: "FLOATS" }), undefined);
});

// aircraftShapes.ts's variant-aware shape resolution (see
// resolveAircraftShape's doc comment for why it's parameterized rather than
// closing over the real, generator-owned aircraftShapes.json directly).
const DEFAULT_SHAPE: AircraftShape = { viewBox: "0 0 10 10", markup: "<path d='default'/>" };
const VARIANT_SHAPE: AircraftShape = { viewBox: "0 0 10 10", markup: "<path d='floats'/>" };
const UNIDENTIFIED_SHAPE: AircraftShape = { viewBox: "0 0 10 10", markup: "<path d='unidentified'/>" };
const FIXTURE_SHAPES: Record<string, AircraftShape> = {
  C182: DEFAULT_SHAPE,
  "C182-FLOATS": VARIANT_SHAPE,
  UNIDENTIFIED: UNIDENTIFIED_SHAPE,
};

test("resolveAircraftShape returns the variant shape when vendored", () => {
  assert.equal(resolveAircraftShape(FIXTURE_SHAPES, "C182", undefined, "FLOATS"), VARIANT_SHAPE);
});

test("resolveAircraftShape falls back to the default shape when the variant isn't vendored", () => {
  assert.equal(resolveAircraftShape(FIXTURE_SHAPES, "C182", undefined, "SKIS"), DEFAULT_SHAPE);
});

test("resolveAircraftShape returns the default shape when no variant is set", () => {
  assert.equal(resolveAircraftShape(FIXTURE_SHAPES, "C182", undefined, undefined), DEFAULT_SHAPE);
});

test("resolveAircraftShape variant lookup is case-insensitive", () => {
  assert.equal(resolveAircraftShape(FIXTURE_SHAPES, "C182", undefined, "floats"), VARIANT_SHAPE);
});

test("resolveAircraftShape falls through to Unidentified when the type itself isn't vendored, regardless of variant", () => {
  assert.equal(resolveAircraftShape(FIXTURE_SHAPES, "ZZZZ", undefined, "FLOATS"), UNIDENTIFIED_SHAPE);
});

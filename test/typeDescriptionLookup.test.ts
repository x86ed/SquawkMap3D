import test from "node:test";
import assert from "node:assert/strict";
import { typeDescriptionForCode } from "../components/map/typeDescriptionLookup";

test("known type designator resolves to its decoded description", () => {
  assert.equal(typeDescriptionForCode("A320"), "Airbus A320");
});

test("known type designator resolves case-insensitively", () => {
  assert.equal(typeDescriptionForCode("b738"), "Boeing 737-800");
});

test("unknown type designator resolves to null", () => {
  assert.equal(typeDescriptionForCode("ZZZZ"), null);
});

test("missing type designator resolves to null", () => {
  assert.equal(typeDescriptionForCode(undefined), null);
});

test("empty type designator resolves to null", () => {
  assert.equal(typeDescriptionForCode(""), null);
});

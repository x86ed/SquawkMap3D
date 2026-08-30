import test from "node:test";
import assert from "node:assert/strict";
import { airlineNameForCallsign } from "../components/map/airlineLookup";

test("known ICAO prefix resolves to airline name", () => {
  assert.equal(airlineNameForCallsign("UAL123"), "United Airlines");
});

test("known ICAO prefix resolves case-insensitively", () => {
  assert.equal(airlineNameForCallsign("dal456"), "Delta Air Lines");
});

test("unknown prefix resolves to null", () => {
  assert.equal(airlineNameForCallsign("XQZ999"), null);
});

test("missing callsign resolves to null", () => {
  assert.equal(airlineNameForCallsign(undefined), null);
});

test("empty callsign resolves to null", () => {
  assert.equal(airlineNameForCallsign(""), null);
});

test("general-aviation tail-number-style callsign with no letter prefix resolves to null", () => {
  assert.equal(airlineNameForCallsign("N12345"), null);
});

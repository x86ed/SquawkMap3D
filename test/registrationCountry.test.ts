import test from "node:test";
import assert from "node:assert/strict";
import { countryCodeForRegistration, countryNameForCode } from "../components/map/registrationCountry";

test("known single-letter prefix resolves", () => {
  assert.equal(countryCodeForRegistration("N12345"), "US");
});

test("known multi-character prefix resolves", () => {
  assert.equal(countryCodeForRegistration("VH-ABC"), "AU");
});

test("longer known prefix wins over a shorter overlapping one", () => {
  // "VP-B" (Bermuda) shouldn't be shadowed by matching just "V" or "VP" if
  // those were ever both present in the table.
  assert.equal(countryCodeForRegistration("VP-BXY"), "BM");
});

test("unknown prefix resolves to null", () => {
  assert.equal(countryCodeForRegistration("QQQ-XX"), null);
});

test("missing registration resolves to null", () => {
  assert.equal(countryCodeForRegistration(undefined), null);
});

test("empty registration resolves to null", () => {
  assert.equal(countryCodeForRegistration("   "), null);
});

test("lowercase registration still resolves (case-insensitive)", () => {
  assert.equal(countryCodeForRegistration("n12345"), "US");
});

test("known country code resolves to its name", () => {
  assert.equal(countryNameForCode("US"), "United States");
});

test("another known country code resolves to its name", () => {
  assert.equal(countryNameForCode("AU"), "Australia");
});

test("unknown country code resolves to null", () => {
  assert.equal(countryNameForCode("XX"), null);
});

test("missing country code resolves to null", () => {
  assert.equal(countryNameForCode(undefined), null);
});

test("empty country code resolves to null", () => {
  assert.equal(countryNameForCode(""), null);
});

test("malformed country code resolves to null instead of throwing", () => {
  assert.equal(countryNameForCode("NOTACODE"), null);
});

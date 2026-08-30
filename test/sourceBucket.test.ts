import test from "node:test";
import assert from "node:assert/strict";
import { bucketForSourceType } from "../components/map/drawer/sourceBucket";

test("adsb_icao and friends bucket as adsb", () => {
  for (const t of ["adsb_icao", "adsb_icao_nt", "adsb_other", "adsb_nonicao"]) {
    assert.equal(bucketForSourceType(t), "adsb");
  }
});

test("uat/adsr-family types bucket as uat_adsr", () => {
  for (const t of ["adsr_icao", "adsr_other", "adsr_nonicao", "uat", "adsc"]) {
    assert.equal(bucketForSourceType(t), "uat_adsr");
  }
});

test("mlat buckets as mlat", () => {
  assert.equal(bucketForSourceType("mlat"), "mlat");
});

test("tisb-family types bucket as tisb", () => {
  for (const t of ["tisb_icao", "tisb_other", "tisb_nonicao", "tisb_trackfile"]) {
    assert.equal(bucketForSourceType(t), "tisb");
  }
});

test("mode_s and mode_ac bucket as mode_s", () => {
  assert.equal(bucketForSourceType("mode_s"), "mode_s");
  assert.equal(bucketForSourceType("mode_ac"), "mode_s");
});

test("other and unrecognized values bucket as other", () => {
  assert.equal(bucketForSourceType("other"), "other");
  assert.equal(bucketForSourceType("some_future_type"), "other");
});

test("undefined sourceType buckets as other", () => {
  assert.equal(bucketForSourceType(undefined), "other");
});

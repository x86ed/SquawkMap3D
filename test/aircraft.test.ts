import test from "node:test";
import assert from "node:assert/strict";
import { fetchAircraft } from "../components/map/aircraft";

// `normalize()` isn't exported directly; exercised indirectly via
// `fetchAircraft()` by stubbing `fetch` and the feeder URL env var, mirroring
// how `aircraft.ts`'s own doc comments describe its optional-field contract.
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_FEEDER_URL = process.env.NEXT_PUBLIC_FEEDER_URL;

function stubFetch(aircraft: unknown[]): void {
  process.env.NEXT_PUBLIC_FEEDER_URL = "http://feeder.local/data/aircraft.json";
  global.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ aircraft }),
    }) as unknown as Response) as typeof fetch;
}

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env.NEXT_PUBLIC_FEEDER_URL = ORIGINAL_FEEDER_URL;
});

test("normalize maps messages/rssi/type/wd/ws when present", async () => {
  stubFetch([
    {
      hex: "abc123",
      messages: 12345,
      rssi: -12.3,
      type: "adsb_icao",
      wd: 270,
      ws: 15,
    },
  ]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.messages, 12345);
  assert.equal(aircraft.rssi, -12.3);
  assert.equal(aircraft.sourceType, "adsb_icao");
  assert.equal(aircraft.windDirection, 270);
  assert.equal(aircraft.windSpeed, 15);
});

test("normalize leaves messages/rssi/sourceType/wind fields undefined when absent", async () => {
  stubFetch([{ hex: "abc123" }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.messages, undefined);
  assert.equal(aircraft.rssi, undefined);
  assert.equal(aircraft.sourceType, undefined);
  assert.equal(aircraft.windDirection, undefined);
  assert.equal(aircraft.windSpeed, undefined);
});

test("normalize resolves isMilitary false when dbFlags is absent", async () => {
  stubFetch([{ hex: "abc123" }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, false);
});

test("normalize resolves isMilitary false when dbFlags is 0", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, false);
});

test("normalize resolves isMilitary true when dbFlags bit 0x1 is set", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 1 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, true);
});

test("normalize resolves isMilitary false when other bits are set without bit 0x1", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0b1110 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, false);
});

test("normalize resolves isMilitary true when bit 0x1 is set alongside other bits", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0b1111 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, true);
});

test("normalize passes category through unchanged when present", async () => {
  stubFetch([{ hex: "abc123", category: "A3" }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.category, "A3");
});

test("normalize leaves category undefined when absent", async () => {
  stubFetch([{ hex: "abc123" }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.category, undefined);
});

test("normalize resolves isPia/isLadd false when dbFlags is absent", async () => {
  stubFetch([{ hex: "abc123" }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isPia, false);
  assert.equal(aircraft.isLadd, false);
});

test("normalize resolves isPia true when dbFlags bit 0x4 is set", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0x4 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isPia, true);
  assert.equal(aircraft.isLadd, false);
  assert.equal(aircraft.isMilitary, false);
});

test("normalize resolves isLadd true when dbFlags bit 0x8 is set", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0x8 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isLadd, true);
  assert.equal(aircraft.isPia, false);
  assert.equal(aircraft.isMilitary, false);
});

test("normalize resolves isMilitary/isPia/isLadd all true when all bits are set", async () => {
  stubFetch([{ hex: "abc123", dbFlags: 0x1 | 0x4 | 0x8 }]);
  const [aircraft] = await fetchAircraft();
  assert.equal(aircraft.isMilitary, true);
  assert.equal(aircraft.isPia, true);
  assert.equal(aircraft.isLadd, true);
});

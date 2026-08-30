import test from "node:test";
import assert from "node:assert/strict";

// Each test re-imports a fresh module instance (module-level cache state
// would otherwise leak between tests) by appending a cache-busting query
// param recognized by Node's ESM loader.
async function freshFlightRouteModule() {
  return import(`../components/map/flightRoute.ts?t=${Date.now()}-${Math.random()}`);
}

const ORIGINAL_FETCH = global.fetch;

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

function stubRouteset(callCounter: { count: number }, response: unknown) {
  global.fetch = (async () => {
    callCounter.count += 1;
    return {
      ok: true,
      json: async () => response,
    } as unknown as Response;
  }) as typeof fetch;
}

test("first call for a key fetches and caches", async () => {
  const { getCachedFlightRoute } = await freshFlightRouteModule();
  const calls = { count: 0 };
  stubRouteset(calls, [{ _airports: [{ iata: "LAX" }, { iata: "JFK" }] }]);

  const route = await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  assert.deepEqual(route, { origin: "LAX", destination: "JFK" });
  assert.equal(calls.count, 1);
});

test("second call for the same key does not re-fetch", async () => {
  const { getCachedFlightRoute } = await freshFlightRouteModule();
  const calls = { count: 0 };
  stubRouteset(calls, [{ _airports: [{ iata: "LAX" }, { iata: "JFK" }] }]);

  await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  const route = await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  assert.deepEqual(route, { origin: "LAX", destination: "JFK" });
  assert.equal(calls.count, 1);
});

test("different keys fetch independently", async () => {
  const { getCachedFlightRoute } = await freshFlightRouteModule();
  const calls = { count: 0 };
  stubRouteset(calls, [{ _airports: [{ iata: "LAX" }, { iata: "JFK" }] }]);

  await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  await getCachedFlightRoute("def456", "DAL456", 34, -118);
  assert.equal(calls.count, 2);
});

test("clearFlightRouteCache forces a re-fetch afterward", async () => {
  const { getCachedFlightRoute, clearFlightRouteCache } = await freshFlightRouteModule();
  const calls = { count: 0 };
  stubRouteset(calls, [{ _airports: [{ iata: "LAX" }, { iata: "JFK" }] }]);

  await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  clearFlightRouteCache();
  await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  assert.equal(calls.count, 2);
});

test("a null (no-match) result is also cached, not re-fetched", async () => {
  const { getCachedFlightRoute } = await freshFlightRouteModule();
  const calls = { count: 0 };
  stubRouteset(calls, [{}]);

  const first = await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  const second = await getCachedFlightRoute("abc123", "UAL123", 34, -118);
  assert.equal(first, null);
  assert.equal(second, null);
  assert.equal(calls.count, 1);
});

import test from "node:test";
import assert from "node:assert/strict";

// Each test re-imports a fresh module instance (module-level cache state
// would otherwise leak between tests) by appending a cache-busting query
// param recognized by Node's ESM loader — mirrors flightRoute.test.ts.
async function freshAircraftModelCardModule() {
  return import(`../components/map/overlay/aircraftModelCard.ts?t=${Date.now()}-${Math.random()}`);
}

const ORIGINAL_FETCH = global.fetch;

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

const SUCCESS_ATTRIBUTES = {
  name: "Boeing 737-800",
  manufacturer: "Boeing",
  tier: "Alloy",
  xp: 8400,
  unique_aircraft: 12,
  unique_registrations: 10,
  flights_captured: 40,
  observed_seconds: 3600,
  maximum_altitude_ft: null,
  first_seen_at: "2024-01-01T00:00:00Z",
  last_seen_at: "2024-02-01T00:00:00Z",
  historical_through: "2024-02-01T00:00:00Z",
};

function stubResponse(
  callCounter: { count: number; urls: string[]; headers: (HeadersInit | undefined)[] },
  status: number,
  body: unknown,
) {
  global.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    callCounter.count += 1;
    callCounter.urls.push(String(url));
    callCounter.headers.push(init?.headers);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  }) as typeof fetch;
}

test("200 success parses data.attributes into camelCase fields, including a null maximumAltitudeFt", async () => {
  const { fetchAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 200, { data: { attributes: SUCCESS_ATTRIBUTES } });

  const result = await fetchAircraftModelCard("B738", "feeder-uuid-1");
  assert.deepEqual(result, {
    status: "ok",
    attributes: {
      name: "Boeing 737-800",
      manufacturer: "Boeing",
      tier: "Alloy",
      xp: 8400,
      uniqueAircraft: 12,
      uniqueRegistrations: 10,
      flightsCaptured: 40,
      observedSeconds: 3600,
      maximumAltitudeFt: null,
      firstSeenAt: "2024-01-01T00:00:00Z",
      lastSeenAt: "2024-02-01T00:00:00Z",
      historicalThrough: "2024-02-01T00:00:00Z",
    },
  });
});

test("401 maps to invalid_token", async () => {
  const { fetchAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 401, { error: { code: "invalid_token" } });

  const result = await fetchAircraftModelCard("B738", "feeder-uuid-1");
  assert.deepEqual(result, { status: "invalid_token" });
});

test("404 maps to not_found", async () => {
  const { fetchAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 404, { error: { code: "not_found" } });

  const result = await fetchAircraftModelCard("B738", "feeder-uuid-1");
  assert.deepEqual(result, { status: "not_found" });
});

test("a thrown/rejected fetch maps to error", async () => {
  const { fetchAircraftModelCard } = await freshAircraftModelCardModule();
  global.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const result = await fetchAircraftModelCard("B738", "feeder-uuid-1");
  assert.deepEqual(result, { status: "error" });
});

test("a second call for the same (typeDesignator, feederUuid) does not re-fetch", async () => {
  const { getCachedAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 200, { data: { attributes: SUCCESS_ATTRIBUTES } });

  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  assert.equal(calls.count, 1);
});

test("an error result is not cached — a following call re-fetches", async () => {
  const { getCachedAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  global.fetch = (async () => {
    calls.count += 1;
    throw new Error("network down");
  }) as typeof fetch;

  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  assert.equal(calls.count, 2);
});

test("a different feederUuid for the same typeDesignator fetches independently", async () => {
  const { getCachedAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 200, { data: { attributes: SUCCESS_ATTRIBUTES } });

  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  await getCachedAircraftModelCard("B738", "feeder-uuid-2");
  assert.equal(calls.count, 2);
});

test("clearAircraftModelCardCache forces a re-fetch afterward", async () => {
  const { getCachedAircraftModelCard, clearAircraftModelCardCache } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 200, { data: { attributes: SUCCESS_ATTRIBUTES } });

  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  clearAircraftModelCardCache();
  await getCachedAircraftModelCard("B738", "feeder-uuid-1");
  assert.equal(calls.count, 2);
});

test("the request URL never contains the feeder UUID; it is present only in the Authorization header", async () => {
  const { fetchAircraftModelCard } = await freshAircraftModelCardModule();
  const calls = { count: 0, urls: [] as string[], headers: [] as (HeadersInit | undefined)[] };
  stubResponse(calls, 200, { data: { attributes: SUCCESS_ATTRIBUTES } });

  const secretUuid = "super-secret-feeder-uuid-value";
  await fetchAircraftModelCard("B738", secretUuid);

  assert.equal(calls.urls.length, 1);
  assert.ok(!calls.urls[0].includes(secretUuid));
  const headers = calls.headers[0] as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${secretUuid}`);
});

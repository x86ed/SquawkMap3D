import test from "node:test";
import assert from "node:assert/strict";

// Fresh module per test — mirrors aircraftModelCard.test.ts's own convention
// for isolating `global.fetch` stubs.
async function freshFeederUuidDiscoveryModule() {
  return import(`../components/map/overlay/feederUuidDiscovery.ts?t=${Date.now()}-${Math.random()}`);
}

const ORIGINAL_FETCH = global.fetch;

test.afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

function stubTextResponse(status: number, body: string) {
  global.fetch = (async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as unknown as Response;
  }) as typeof fetch;
}

function aggregatorsFixture(uuidValue: string) {
  return `
    <div class="form-group col-12 col-md-8 uuid-fields" id="ADSBWIN_ULTRAFEEDER_FIELDS">
      <label class="pr-2" for="adsbwin--ultrafeeder--uuid">UUID</label>
      <input type="text" id="adsbwin--ultrafeeder--uuid" name="adsbwin--ultrafeeder--uuid"
             class="form-control" placeholder=" adsb.win UUID"
             value="${uuidValue}">
    </div>
  `;
}

test("extracts the UUID from a realistic /aggregators fixture", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, aggregatorsFixture("11111111-2222-3333-4444-555555555555"));

  assert.equal(await discoverFeederUuid(), "11111111-2222-3333-4444-555555555555");
});

test("returns null when the uuid field is present but empty", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, aggregatorsFixture(""));

  assert.equal(await discoverFeederUuid(), null);
});

test("returns null when the adsbwin field is absent entirely", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, "<html><body>no aggregators configured</body></html>");

  assert.equal(await discoverFeederUuid(), null);
});

test("returns null on malformed HTML", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, "<<<not html at all>>>");

  assert.equal(await discoverFeederUuid(), null);
});

test("returns null on a non-2xx response", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(302, "<html>login redirect</html>");

  assert.equal(await discoverFeederUuid(), null);
});

test("returns null when fetch throws (network failure)", async () => {
  const { discoverFeederUuid } = await freshFeederUuidDiscoveryModule();
  global.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  assert.equal(await discoverFeederUuid(), null);
});

// `autoDiscoverFeederUuidIfUnset` is the MapView-mount call site's own logic
// (design.md's Decision 4), extracted so it's testable without mounting the
// whole map component. There's no jsdom in this test environment (plain
// `node --test`, per test/registerCssStub.mjs's own doc comment), and
// feederUuid.ts's storage functions are SSR-guarded on `typeof window ===
// "undefined"` — so a minimal fake `window.localStorage` is installed here,
// scoped to this file, to exercise the real storage read/write path rather
// than stubbing feederUuid.ts's exports directly.
const FEEDER_UUID_STORAGE_KEY = "squawkmap3d:adsbWinFeederUuid";
const ORIGINAL_WINDOW = (global as Record<string, unknown>).window;

function installFakeWindow() {
  const store = new Map<string, string>();
  (global as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  return store;
}

test.afterEach(() => {
  (global as Record<string, unknown>).window = ORIGINAL_WINDOW;
});

test("fires discovery and stores the result when no UUID is stored yet", async () => {
  const store = installFakeWindow();
  const { autoDiscoverFeederUuidIfUnset } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, aggregatorsFixture("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"));

  await autoDiscoverFeederUuidIfUnset();

  assert.equal(store.get(FEEDER_UUID_STORAGE_KEY), "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
});

test("does not call fetch, and leaves the stored value alone, when a UUID is already stored", async () => {
  const store = installFakeWindow();
  store.set(FEEDER_UUID_STORAGE_KEY, "already-stored-uuid");
  const { autoDiscoverFeederUuidIfUnset } = await freshFeederUuidDiscoveryModule();
  let fetchCalled = false;
  global.fetch = (async () => {
    fetchCalled = true;
    return { ok: true, status: 200, text: async () => aggregatorsFixture("discovered-uuid") } as unknown as Response;
  }) as typeof fetch;

  await autoDiscoverFeederUuidIfUnset();

  assert.equal(fetchCalled, false);
  assert.equal(store.get(FEEDER_UUID_STORAGE_KEY), "already-stored-uuid");
});

test("does nothing observable when discovery finds no UUID", async () => {
  const store = installFakeWindow();
  const { autoDiscoverFeederUuidIfUnset } = await freshFeederUuidDiscoveryModule();
  stubTextResponse(200, "<html>no aggregators configured</html>");

  await autoDiscoverFeederUuidIfUnset();

  assert.equal(store.has(FEEDER_UUID_STORAGE_KEY), false);
});

## 1. Server-side discovery endpoint

- [ ] 1.1 Add `app/api/feeder-uuid/route.ts` (Next.js `GET` route handler) that: derives the target hostname from the incoming request, fetches `http://{host}/aggregators`, and on failure retries `http://adsb-feeder.local/aggregators`
- [ ] 1.2 Extract the adsb.win UUID from the response HTML by matching the `adsbwin--ultrafeeder--uuid` field's `value` attribute (attribute-order tolerant); treat an empty/absent value the same as "not found"
- [ ] 1.3 Return `{ uuid: string }` on success and `{ uuid: null }` for every failure/not-found case (network error, non-2xx, no match) — never throw or surface a 5xx to the caller
- [ ] 1.4 Never log the extracted UUID or the raw admin-UI response body to server console output (mirrors the existing no-logging rule for this credential)

## 2. Client-side autodiscovery call

- [ ] 2.1 In `MapView.tsx`, on mount, call `getStoredFeederUuid()`; if it returns `null`, call the new `/api/feeder-uuid` route
- [ ] 2.2 On a successful response with a non-null `uuid`, call `storeFeederUuid(uuid)` so it persists and is picked up by the existing polling logic exactly like a manually-entered value
- [ ] 2.3 On any failure or `uuid: null` response, do nothing — leave the existing `"not_configured"` UI path (today's `FeederUuidForm` in `PlaneCard.tsx`) as the fallback, untouched
- [ ] 2.4 Ensure this call only ever fires once per load when nothing is stored yet — never re-fires while a UUID (manual or autodiscovered) is already present

## 3. Tests

- [ ] 3.1 Unit test the route handler's HTML-parsing helper: extracts the UUID from a realistic `/aggregators`-shaped fixture, returns `null` for empty value / missing field / malformed HTML
- [ ] 3.2 Unit test the route handler's fallback-hostname behavior (request-host attempt fails → falls back to `adsb-feeder.local`)
- [ ] 3.3 Unit test the client call site: fires when no UUID stored, stores the returned UUID via `storeFeederUuid`, does not fire when a UUID is already stored, and does nothing observable on a `uuid: null`/error response
- [ ] 3.4 Confirm existing `adsb-win-aircraft-stats` tests (manual entry, caching, error states) still pass unmodified

## 4. Manual verification

- [ ] 4.1 On an actual deployed feeder box with adsb.win configured in its admin UI, confirm the stats card populates with no manual UUID entry needed on first load
- [ ] 4.2 Confirm manual entry still works unchanged when the admin UI is unreachable (e.g. port 80 blocked) or has no adsb.win UUID set

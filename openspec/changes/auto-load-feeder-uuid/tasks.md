## 1. Deploy-side proxy (nginx + deploy script)

- [ ] 1.1 Add a `location` block to `scripts/squawkmap3d.nginx.conf` that proxies a same-origin path (e.g. `/feeder-config/aggregators`) to `http://host.docker.internal:80/aggregators`
- [ ] 1.2 Add `--add-host=host.docker.internal:host-gateway` to the sidecar's `docker run` invocation in the deploy script
- [ ] 1.3 Add a deploy-script prerequisite check that the host-gateway alias resolves (consistent with `feeder-deployment`'s "fails fast on missing prerequisites" requirement); on failure, warn but don't block deploy since this feature degrades gracefully to manual entry
- [ ] 1.4 Document the new proxy path and redeploy requirement in `README.md`

## 2. Client-side discovery and parsing

- [ ] 2.1 Add a small client-side module (e.g. `components/map/overlay/feederUuidDiscovery.ts`) that fetches the same-origin proxy path and extracts the UUID from the `adsbwin--ultrafeeder--uuid` field via a targeted regex
- [ ] 2.2 Treat any non-2xx response, network failure, or missing/empty field value identically as "no UUID discovered" — no thrown error, no console logging of response bodies (never log the extracted UUID either, per the existing no-logging rule)
- [ ] 2.3 In `MapView.tsx`, on mount, call `getStoredFeederUuid()`; if it returns `null`, call the new discovery module
- [ ] 2.4 On a successful discovery, call `storeFeederUuid(uuid)` so it persists and is picked up by the existing polling logic exactly like a manually-entered value
- [ ] 2.5 On no discovery, do nothing — leave the existing `"not_configured"` UI path (today's `FeederUuidForm` in `PlaneCard.tsx`) as the fallback, untouched
- [ ] 2.6 Ensure this call only ever fires once per load when nothing is stored yet — never re-fires while a UUID (manual or autodiscovered) is already present

## 3. Tests

- [ ] 3.1 Unit test the parsing helper: extracts the UUID from a realistic `/aggregators`-shaped HTML fixture, returns nothing for empty value / missing field / malformed HTML
- [ ] 3.2 Unit test the discovery module's fetch handling: non-2xx response, network failure, and malformed body all resolve to "no UUID discovered" without throwing
- [ ] 3.3 Unit test the `MapView.tsx` call site: fires when no UUID stored, stores the returned UUID via `storeFeederUuid`, does not fire when a UUID is already stored, and does nothing observable on a "no UUID discovered" result
- [ ] 3.4 Confirm existing `adsb-win-aircraft-stats` tests (manual entry, caching, error states) still pass unmodified

## 4. Manual verification

- [ ] 4.1 Redeploy to an actual feeder box with adsb.win configured in its admin UI; confirm the stats card populates with no manual UUID entry needed on first load
- [ ] 4.2 Confirm manual entry still works unchanged when the admin UI is unreachable (e.g. stopped) or has no adsb.win UUID set
- [ ] 4.3 Confirm `curl http://<feeder>:7500/feeder-config/aggregators` returns the admin UI's page content from the deployed box, verifying the proxy independent of the app's own JS

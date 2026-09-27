## Why

Today the adsb.win feeder UUID that unlocks per-aircraft stats must be typed in by hand (`FeederUuidForm` in `PlaneCard.tsx`), even though this app is deployed straight onto the feeder box itself (per `feeder-deployment`) and that box's own admin UI (`http://adsb-feeder.local/aggregators`, from the `dirkhh/adsb-feeder-image` project) already has the UUID stored server-side. Requiring the user to copy it by hand is unnecessary friction for a value the box already knows.

## What Changes

- Add a same-origin lookup path, proxied at the deploy's own nginx layer to the feeder box's `/aggregators` admin page, and extract the adsb.win UUID (`<input name="adsbwin--ultrafeeder--uuid" value="...">`) already configured there in client-side code (this app is a static export with no server-side runtime, so the proxy step is required to avoid the browser hitting CORS against the admin UI directly).
- On app load, if no feeder UUID is yet stored locally, call this lookup and, if it returns a UUID, store it exactly as if the user had typed it in — no new UI, no prompt.
- Keep the existing manual `FeederUuidForm` entirely as-is as a fallback: it still appears whenever no UUID is configured or the stored one is invalid, so autodiscovery failure (feeder unreachable, auth enabled, different feeder software, no adsb.win aggregator configured) degrades to exactly today's manual flow.
- The lookup targets the standard `adsb-feeder-image` admin UI shape generically (by parsing the identifier-scoped field, not a hardcoded value, and reaching the admin UI via the Docker host-gateway rather than any specific hostname), so it works on any box running that stock feeder image, not just one specific unit.

## Capabilities

### New Capabilities
- `feeder-uuid-autodiscovery`: server-side capability that queries a local ADS-B feeder box's own admin UI for an already-configured aggregator UUID and returns it to the client.

### Modified Capabilities
- `adsb-win-aircraft-stats`: adds an automatic, on-load population path for the feeder UUID sourced from `feeder-uuid-autodiscovery`, in addition to the existing manual-entry path (which is unchanged and remains the fallback).

## Impact

- New `location` block in the deploy's own `scripts/squawkmap3d.nginx.conf` proxying a same-origin path to the feeder box's admin UI (`/aggregators`), plus a new `--add-host=host.docker.internal:host-gateway` flag on the sidecar's `docker run` invocation in the deploy script — this app has no Node/Next.js server at runtime (static export, per `feeder-deployment`), so there is no server route to add; the proxy has to live at the nginx layer instead.
- New client-side module that fetches that same-origin path and parses the returned HTML for the UUID field — runs entirely in the browser, no build-time or server-side dependency added.
- `components/map/overlay/feederUuid.ts`: gains an autodiscovery call site (likely invoked once from `MapView.tsx` on mount) that calls `storeFeederUuid()` on success; no change to its existing exported functions' behavior.
- No change to `PlaneCard.tsx`'s existing form, its copy, or `AircraftModelCardResult` states — this change only adds a way to skip ever seeing that form when autodiscovery succeeds.
- No new required user configuration, environment variables, or build-time values. Requires one redeploy (updated nginx config + deploy script) to take effect on an already-running box.

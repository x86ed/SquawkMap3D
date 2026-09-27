## Why

Today the adsb.win feeder UUID that unlocks per-aircraft stats must be typed in by hand (`FeederUuidForm` in `PlaneCard.tsx`), even though this app is deployed straight onto the feeder box itself (per `feeder-deployment`) and that box's own admin UI (`http://adsb-feeder.local/aggregators`, from the `dirkhh/adsb-feeder-image` project) already has the UUID stored server-side. Requiring the user to copy it by hand is unnecessary friction for a value the box already knows.

## What Changes

- Add a server-side lookup that fetches the feeder box's own `/aggregators` admin page and extracts the adsb.win UUID (`<input name="adsbwin--ultrafeeder--uuid" value="...">`) already configured there.
- On app load, if no feeder UUID is yet stored locally, call this lookup and, if it returns a UUID, store it exactly as if the user had typed it in — no new UI, no prompt.
- Keep the existing manual `FeederUuidForm` entirely as-is as a fallback: it still appears whenever no UUID is configured or the stored one is invalid, so autodiscovery failure (feeder unreachable, auth enabled, different feeder software, no adsb.win aggregator configured) degrades to exactly today's manual flow.
- The lookup targets the standard `adsb-feeder-image` admin UI shape generically (by parsing the identifier-scoped field, not a hardcoded value), so it works on any box running that stock feeder image, not just one specific unit.

## Capabilities

### New Capabilities
- `feeder-uuid-autodiscovery`: server-side capability that queries a local ADS-B feeder box's own admin UI for an already-configured aggregator UUID and returns it to the client.

### Modified Capabilities
- `adsb-win-aircraft-stats`: adds an automatic, on-load population path for the feeder UUID sourced from `feeder-uuid-autodiscovery`, in addition to the existing manual-entry path (which is unchanged and remains the fallback).

## Impact

- New Next.js server route (e.g. `app/api/feeder-uuid/route.ts`) that makes an outbound HTTP request from the server to the feeder's admin UI and parses HTML — avoids doing this fetch from the browser, which would hit CORS against an admin UI not designed to allow cross-origin reads.
- `components/map/overlay/feederUuid.ts`: gains an autodiscovery call site (likely invoked once from `MapView.tsx` on mount) that calls `storeFeederUuid()` on success; no change to its existing exported functions' behavior.
- No change to `PlaneCard.tsx`'s existing form, its copy, or `AircraftModelCardResult` states — this change only adds a way to skip ever seeing that form when autodiscovery succeeds.
- No new required user configuration, environment variables, or build-time values.

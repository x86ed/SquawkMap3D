## Why

`PlaneCard` (`components/map/overlay/PlaneCard.tsx`), part of the aircraft-selection overlay, has always rendered its fleet-wide stat region ("not tracked yet") as a permanent empty state — `SelectedAircraftInfo`'s six stat fields (`uniqueRegistrationsCount`, `flightsCapturedCount`, `observedFlightTimeSeconds`, `highestAltitudeObserved`, `xp`, `xpProgressToNextTier`) plus `viewRegistrationsHref` were forward-plumbed in `aircraft-info-overlay` (design.md Decision 14) with an explicit note that "no data source for these exists in this codebase or the feeder stack." That data source now exists: adsb.win publishes a per-account, per-aircraft-type "Aircraft Card" JSON API (`GET https://app-api.adsb.win/api/v1/aircraft-models/{ICAO_TYPE}`, `Authorization: Bearer {feeder UUID}`) returning real unique-registrations/flights-captured/observed-time/highest-altitude/XP/tier values. This change wires that API into `PlaneCard` so the stat region shows the user's own real adsb.win progress for the selected aircraft's type instead of a permanent placeholder.

## What Changes

- Add a feeder UUID (adsb.win account bearer credential) as a new, user-entered, browser-local setting — stored in `localStorage` (never a `NEXT_PUBLIC_*` build-time env var, since this app ships as a static export with no runtime server to keep it server-side; see design.md's tradeoff writeup). Entered inline in `PlaneCard` itself the first time it has nothing to show (contextual, not a new global settings surface).
- Fetch `GET https://app-api.adsb.win/api/v1/aircraft-models/{typeDesignator}` directly from the browser (CORS-enabled by adsb.win specifically for this use case) with `Authorization: Bearer {feederUuid}`, keyed off the selected aircraft's existing `typeDesignator` — no new aircraft data needed. **Never** uses the response's `meta.embed_url`/iframe path; hydrates `PlaneCard` from `data.attributes` only.
- Distinguish and render each real outcome the API defines: success (`data.attributes`), `401 invalid_token` (feeder UUID missing/unrecognized/unclaimed), `404 not_found` (this account hasn't captured that model — generic wording, doesn't reveal whether another account has), and any other network/parse failure — plus the pre-existing "no feeder UUID configured yet" and "aircraft type unknown" cases.
- **BREAKING (internal component contract only, not a public API)**: `PlaneCardProps`'s six always-`undefined` stat fields and `viewRegistrationsHref` are replaced by a single `cardStats` discriminated-union prop; `SelectedAircraftInfo`'s matching fields are replaced the same way. No external consumers of these types exist outside this repo.
- Restores `xpProgressToNextTier`/"N% to next tier" progress bar, driven by a new, explicitly-**provisional** default per-tier XP threshold table (`components/map/overlay/tierProgress.ts`) — adsb.win's API documents no per-tier threshold, so this table is a best-effort estimate from tester-supplied reference screenshots (only the Alloy→Carbon boundary is well-confirmed), clamped to never claim 100% ahead of the API's own `tier` field, and isolated for a cheap swap once real numbers are available in a follow-up change. The `tier` field itself (e.g. "Alloy") is adsb.win's own distinct *material*-tier ladder — unrelated to and not replacing this app's existing *rarity*-tier ladder (`aircraft-rarity` capability, Decision 5), which stays wired to its own local vendored dataset, untouched by this change. See design.md Decision 4/4a.
- Caches fetched cards per `(feederUuid, typeDesignator)` for the session (mirrors `flightRoute.ts`'s existing `getCachedFlightRoute`/`clearFlightRouteCache` pattern) so the ~1s aircraft-poll loop that already re-resolves `SelectedAircraftInfo` doesn't hammer the API every tick.
- Security: feeder UUID is sent only in the `Authorization` header (never a URL/query param), is never written to `console.*`/error text/analytics, and the fetch/cache layer is the only place it's read from storage.

## Capabilities

### New Capabilities

- `adsb-win-aircraft-stats`: configuring an adsb.win feeder UUID locally in the browser, fetching a per-aircraft-type stats card from adsb.win's Aircraft Card API authenticated with that UUID, and handling its success/error outcomes (including the security constraints on the UUID itself).

### Modified Capabilities

- `aircraft-info-overlay`: the "PlaneCard shows optional fleet-wide stats when available, never fabricated" requirement changes from "always renders the empty state, since no data source exists" to describing `PlaneCard`'s real set of stat-region states (not configured, loading not applicable — resolved before `SelectedAircraftInfo` updates, same as route lookup — real data, feeder-UUID-invalid, not-yet-captured, and generic error), sourced from the new `adsb-win-aircraft-stats` capability, and drops the fabricated XP-progress-bar language in favor of showing the real `xp` count and `tier` name.

## Impact

- `components/map/overlay/aircraftModelCard.ts` (new): types + `fetchAircraftModelCard`/`getCachedAircraftModelCard`/`clearAircraftModelCardCache`, mirroring `components/map/flightRoute.ts`'s structure and never-throws discipline.
- `components/map/overlay/tierProgress.ts` (new): `computeTierProgress(tierName, xp)` plus the provisional default per-tier XP threshold table, isolated so it can be replaced with real numbers in a follow-up change without touching `aircraftModelCard.ts`.
- `components/map/overlay/feederUuid.ts` (new): `getStoredFeederUuid`/`storeFeederUuid`/`clearStoredFeederUuid`, mirroring `components/map/theme.ts`'s `localStorage` accessor pattern.
- `components/map/overlay/selectedAircraftInfo.ts`: `SelectedAircraftInfo`'s six stat fields + `viewRegistrationsHref` replaced by one `cardStats?: AircraftModelCardResult` field; `buildSelectedAircraftInfo` gains a `cardStats` parameter (resolved by the caller, same pattern as its existing `route` parameter).
- `components/map/overlay/PlaneCard.tsx` + `PlaneCard.module.css`: `PlaneCardProps` stat fields replaced by `cardStats`; new render branches for each state; new inline feeder-UUID entry form.
- `components/map/overlay/AircraftOverlay.tsx`: passes `info.cardStats` through instead of the six removed props.
- `components/map/MapView.tsx`: `refreshAircraft()` resolves `cardStats` via `getCachedAircraftModelCard()` alongside its existing `route` resolution, before calling `buildSelectedAircraftInfo`.
- `README.md`: documents the new in-app (not env-var) feeder UUID setting.
- No new npm dependencies (plain `fetch`, already used throughout this codebase for `flightRoute.ts`/`feederLocation.ts`/etc.).
- No server/nginx changes — the request goes straight from the browser to `app-api.adsb.win`, which is explicitly CORS-enabled for this; this app's static-export deploy topology (`next.config.js`'s `output: "export"`) has no runtime server process to proxy through (see design.md's tradeoff writeup).

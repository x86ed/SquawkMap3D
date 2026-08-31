## 1. Feeder UUID storage

- [ ] 1.1 Add `components/map/overlay/feederUuid.ts`, mirroring `components/map/theme.ts`'s `localStorage` accessor pattern exactly (SSR guard, try/catch): `FEEDER_UUID_STORAGE_KEY = "squawkmap3d:adsbWinFeederUuid"`, `getStoredFeederUuid(): string | null`, `storeFeederUuid(uuid: string): void` (trim whitespace; trimmed-empty clears the key instead of storing `""`), `clearStoredFeederUuid(): void`

## 2. Aircraft-model card fetch/cache module

- [ ] 2.1 Add `components/map/overlay/aircraftModelCard.ts` with `AircraftModelCardAttributes` (camelCase fields for every `data.attributes` field in the API response — `name`, `manufacturer`, `tier`, `xp`, `uniqueAircraft`, `uniqueRegistrations`, `flightsCaptured`, `observedSeconds`, `maximumAltitudeFt: number | null`, `firstSeenAt`, `lastSeenAt`, `historicalThrough`) and `AircraftModelCardResult` (design.md Decision 5's discriminated union: `ok` / `not_configured` / `invalid_token` / `not_found` / `error`)
- [ ] 2.2 Implement `fetchAircraftModelCard(typeDesignator: string, feederUuid: string): Promise<AircraftModelCardResult>` — `GET https://app-api.adsb.win/api/v1/aircraft-models/${encodeURIComponent(typeDesignator.toUpperCase())}` with `Authorization: Bearer ${feederUuid}` (header only — never append the UUID to the URL/query string); maps `200` → `{status:"ok", attributes}` (snake_case → camelCase), `401` → `{status:"invalid_token"}`, `404` → `{status:"not_found"}`, anything else (network throw, non-JSON body, unexpected shape, other status) → `{status:"error"}`. Never throws (try/catch internally, mirroring `flightRoute.ts`'s `getFlightRoute()`). Never includes the UUID value in any thrown/caught error message or `console.*` call
- [ ] 2.3 Implement `getCachedAircraftModelCard(typeDesignator, feederUuid): Promise<AircraftModelCardResult>` — module-level `Map<string, AircraftModelCardResult>` keyed `${feederUuid}::${typeDesignator.toUpperCase()}`; returns the cached entry if present; otherwise calls `fetchAircraftModelCard`, and caches the result **unless** its status is `"error"` (design.md Decision 6 — error results must be retried, not cached)
- [ ] 2.4 Implement `clearAircraftModelCardCache(): void`

## 3. Provisional tier-progress module

- [ ] 3.1 Add `components/map/overlay/tierProgress.ts` per design.md Decision 4a: `PROVISIONAL_TIER_START_XP` (lowercase-keyed: `alloy`/`carbon`/`titanium`/`iridium`/`plasma`/`quantum`, values `0`/`25_000`/`100_000`/`300_000`/`750_000`/`1_500_000`), a top-of-file comment marking every value as provisional/unsourced pending a follow-up change, and `computeTierProgress(tierName: string, xp: number): { percentToNext: number; nextTierName: string | null } | null`
- [ ] 3.2 `computeTierProgress` matches `tierName` case-insensitively against the table; returns `null` for any unrecognized name (no bar rendered — never a guessed percentage for a tier this table doesn't know); for the last known tier (`quantum`) returns `{ percentToNext: 100, nextTierName: null }`; otherwise returns `{ percentToNext, nextTierName }` with `percentToNext` computed as `(xp - start) / (nextStart - start) * 100`, clamped to `[0, 99]` and rounded — never `100` for a non-max tier, so the bar can't visually claim a promotion the API's own `tier` field hasn't reported yet

## 5. Wire the fetch into the existing per-poll flow

- [ ] 5.1 In `components/map/overlay/selectedAircraftInfo.ts`: remove `uniqueRegistrationsCount`, `flightsCapturedCount`, `observedFlightTimeSeconds`, `highestAltitudeObserved`, `xp`, `xpProgressToNextTier`, `viewRegistrationsHref` from `SelectedAircraftInfo`; add `cardStats?: AircraftModelCardResult`. Add a `cardStats: AircraftModelCardResult | undefined` parameter to `buildSelectedAircraftInfo(...)` and assign it straight onto the returned object (same pattern as the existing `route` parameter)
- [ ] 5.2 In `components/map/MapView.tsx`'s `refreshAircraft()`: right after the existing `route` resolution (and before the `buildSelectedAircraftInfo(...)` call), resolve `cardStats` per design.md Decision 6's sketch — `{status:"not_configured"}` when `getStoredFeederUuid()` is `null`, otherwise `await getCachedAircraftModelCard(selected.typeDesignator, feederUuid)`; leave `cardStats` as `undefined` when `selected.typeDesignator` itself is unset. Pass it into `buildSelectedAircraftInfo(...)`
- [ ] 5.3 In `components/map/overlay/feederUuid.ts`'s `storeFeederUuid()`/`clearStoredFeederUuid()`, also call `clearAircraftModelCardCache()` (design.md Decision 6 — defensive, on top of the cache key already being UUID-scoped)
- [ ] 5.4 Do **not** add a `clearAircraftModelCardCache()` call to `MapView.tsx`'s existing deselect/drop-out `clearFlightRouteCache()` call sites — this cache is intentionally not cleared on deselect (design.md Decision 6's second divergence)

## 6. PlaneCard rendering

- [ ] 6.1 In `components/map/overlay/PlaneCard.tsx`: replace the seven removed props with `cardStats?: AircraftModelCardResult` in `PlaneCardProps`; delete the `statsPresent` all-six-defined gate and the old `nextRarityTier`-driven progress-bar markup (it's being replaced by `computeTierProgress`-driven markup, not deleted outright — see 6.2)
- [ ] 6.2 Render a `switch`/branch on `cardStats?.status` (treat `undefined` and `"not_found"` identically):
  - `undefined` or `"not_found"` → the existing `.statsEmpty` "Not tracked yet" markup, unchanged
  - `"not_configured"` → a prompt ("Connect your adsb.win feeder ID to see stats for this aircraft") plus a `type="password"` input and a Save button; on submit, trim the value and call `storeFeederUuid()` from `feederUuid.ts` directly (no callback prop — matches `theme.ts`'s direct-import convention used elsewhere in this app)
  - `"invalid_token"` → a message that the feeder UUID isn't recognized, plus the same input UI pre-labeled "Update"
  - `"error"` → a generic "Unable to load stats right now" message, no input, no fabricated data
  - `"ok"` → the stat grid (unique registrations, flights captured, `formatDuration(observedSeconds)`, highest altitude — render `"—"` when `maximumAltitudeFt` is `null` rather than calling `.toLocaleString()` on `null`) plus an XP/tier row showing `${xp} XP` and the `tier` name; call `computeTierProgress(attributes.tier, attributes.xp)` (from `tierProgress.ts`, task 3) and: if it returns `null`, render just the XP/tier plain values with no bar (unrecognized tier name); if `nextTierName` is `null` (max tier), render a full-width bar with a "Maximum tier" label, no percentage; otherwise render the bar at `percentToNext`% with a `"{percentToNext}% to {nextTierName}"` label, mirroring the reference screenshots' layout
- [ ] 6.3 Update `PlaneCard.module.css`: add styles for the config-prompt/input/Save-button, invalid-token, and error states, consistent with the card's existing dark/rarity-accented visual language; reuse (not remove) `.xpLabelRow`/`.progressLabel`/`.progressTrack`/`.progressFill` for the `computeTierProgress`-driven bar, adding a max-tier-label variant for the no-percentage full-bar case
- [ ] 6.4 In `components/map/overlay/AircraftOverlay.tsx`: replace the seven removed `<PlaneCard ... />` props with `cardStats={info.cardStats}`

## 7. Docs

- [ ] 7.1 Add a short section to `README.md`'s `## Setup` (or a new subsection) documenting the feeder UUID setting: entered in-app via `PlaneCard`'s prompt (not an env var), stored only in browser `localStorage`, where to find a feeder UUID on adsb.win
- [ ] 7.2 Note in `README.md` (or a code comment pointer to `tierProgress.ts`) that the XP progress-bar thresholds are provisional estimates pending a follow-up change with real adsb.win numbers — so this isn't rediscovered as a surprise later

## 8. Tests

- [ ] 8.1 Add `test/aircraftModelCard.test.ts`, mirroring `test/flightRoute.test.ts`'s structure (fresh-module-per-test via cache-busting import, `global.fetch` stub restored in `afterEach`): cover a `200` success parses `data.attributes` into camelCase fields including a `null` `maximumAltitudeFt`; a `401` body maps to `"invalid_token"`; a `404` body maps to `"not_found"`; a thrown/rejected fetch maps to `"error"`; a second call for the same `(typeDesignator, feederUuid)` does not re-fetch (cache hit); an `"error"` result is *not* cached (a following call re-fetches); a different `feederUuid` for the same `typeDesignator` fetches independently (not served from the other UUID's cache); `clearAircraftModelCardCache()` forces a re-fetch afterward
- [ ] 8.2 Add a test (in `aircraftModelCard.test.ts` or a small dedicated case) asserting the request URL passed to the stubbed `fetch` never contains the feeder UUID substring, and that it's present only in the request's `Authorization` header
- [ ] 8.3 Add `test/tierProgress.test.ts`: known tier + xp mid-range returns a `percentToNext` in `[0, 99]` and the correct `nextTierName`; xp at or past a tier's nominal end still clamps to `99`, never `100`, for a non-max tier; `quantum` (max tier) returns `{ percentToNext: 100, nextTierName: null }`; an unrecognized tier name (case variations too, e.g. `"ALLOY"`/`"alloy"`) returns `null` for the recognized-name case and is handled without throwing for the unrecognized case

## 9. Verification

- [ ] 9.1 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean
- [ ] 9.2 Manually verify, with no feeder UUID saved: selecting an aircraft with a known type shows the configuration prompt in `PlaneCard`'s stat region (not the plain "Not tracked yet" state)
- [ ] 9.3 Manually verify, with a real adsb.win feeder UUID saved and an aircraft type that account has captured: the stat grid, XP count, tier name, and progress bar render with real/derived values, and no console output or rendered text contains the feeder UUID
- [ ] 9.4 Manually verify an aircraft type the account hasn't captured (or an aircraft with no known type at all) renders the same "Not tracked yet" empty state as before this change
- [ ] 9.5 Manually verify an intentionally invalid/garbage feeder UUID renders the "not recognized" message, and that re-entering a valid one via the same input recovers real stats on the next poll without reselecting the aircraft
- [ ] 9.6 Manually verify `PlaneCard`'s `rarityTier` frame/border/bottom badge is visually unchanged by any of this change's states, including the "ok" state's own (differently-named) tier value and its progress bar
- [ ] 9.7 Manually verify reselecting the same aircraft type repeatedly (or leaving it selected across several ~1s polls) issues only one network request to `app-api.adsb.win` (browser devtools Network tab), confirming the cache is effective

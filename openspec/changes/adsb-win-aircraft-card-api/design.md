## Context

`PlaneCard` (`components/map/overlay/PlaneCard.tsx`) is one of four independent components composed by `AircraftOverlay.tsx` (`aircraft-info-overlay` capability, design.md Decision 9). Its identity/rarity header (registration, type badge, model name, the 9-tier `rarityTier` frame/badge) is fully real today, sourced from the feeder's own ADS-B data plus a vendored per-type "rareness" dataset (`aircraft-rarity` capability, Decision 5) — **that machinery is unrelated to this change and stays untouched**. Its stat region (unique registrations/flights captured/observed time/highest altitude/XP/progress-to-next-tier), however, was forward-plumbed in `aircraft-info-overlay`'s original design (Decision 14) as six always-`undefined` optional props, explicitly because "no data source for these exists in this codebase or the feeder stack." adsb.win's real Aircraft Card API is that data source.

Three existing pieces of this codebase anchor this change's shape:
- `components/map/flightRoute.ts` — the existing precedent for "fetch a small piece of per-selected-aircraft enrichment data from a public third-party API, directly from the browser, cache it, never throw." `getCachedFlightRoute()`/`clearFlightRouteCache()` is copied near-verbatim in structure for `aircraftModelCard.ts`.
- `components/map/MapView.tsx`'s `refreshAircraft()` — the existing precedent for *where* that fetch happens: awaited inline, once per ~1s aircraft poll, right before `buildSelectedAircraftInfo()` is called (see the existing `route` resolution at line ~437). Not a new `useEffect`/hook in `AircraftOverlay.tsx` — this app already has a working, established pattern for exactly this shape of problem.
- `components/map/theme.ts` — the existing precedent for user-entered, browser-persisted config (`localStorage`, `typeof window === "undefined"` SSR guard, try/catch around storage access for private-browsing/unavailable-storage). The feeder UUID setting follows this exactly, rather than a `NEXT_PUBLIC_*` build-time env var (see Decision 2).

This app builds as a static export (`next.config.js`: `output: "export"`, "no Node/Next server process required to serve it") and deploys as a plain nginx-served bundle on the feeder box (`deploy-to-feeder`). `app/api/health/route.ts`, the only existing API route, is `dynamic = "force-static"` — frozen at build time, not a live per-request handler. There is no runtime server component anywhere in this app's deployed topology that could proxy a per-user credential.

## Goals / Non-Goals

**Goals:**
- Hydrate `PlaneCard`'s stat region with the selected aircraft type's real adsb.win card data (unique registrations, flights captured, observed time, highest altitude, XP, tier name) when a feeder UUID is configured and the account has captured that type.
- Handle every documented outcome (success, `401`, `404`, network/other failure) with distinct, generic (non-account-leaking) UI, plus the two states that exist before any request is even made: no `typeDesignator` known, and no feeder UUID configured.
- Keep the feeder UUID out of logs, analytics, and the compiled JS bundle; store it only in the user's own browser.
- Avoid re-fetching on every ~1s aircraft poll tick for an aircraft that's still selected.

**Non-Goals:**
- A dedicated global "Settings" UI surface. The feeder UUID is entered inline in `PlaneCard` itself, contextually, the first time there's something to configure — see Decision 3.
- Wiring `unique_aircraft`, `name`, `manufacturer`, `first_seen_at`, `last_seen_at`, or `historical_through` into any UI. `PlaneCard` has no existing slot for these (only `unique_registrations` has a matching prop today); the fetch/parse layer captures the full response shape anyway (Decision 6) so a later change can surface them without touching the API layer again, but this change renders only the fields `PlaneCard` already had a slot for, per the acceptance criteria's "fill in the currently-missing values."
- ~~Confirmed, accurate per-tier XP thresholds~~ — no longer a non-goal. See Decision 4/4a: the tester has since confirmed the real per-tier XP thresholds directly, and the default threshold table now reflects those confirmed values rather than a provisional placeholder.
- A retry button for the generic-error state. The aircraft poll loop already re-attempts the fetch on the very next ~1s tick (uncached, since error results aren't cached — Decision 5) for as long as the aircraft stays selected, which is an adequate implicit retry for a transient failure.
- A server-side proxy for this request. See Decision 1's tradeoff.

## Decisions

### 1. Direct browser → `app-api.adsb.win` fetch, no proxy — accepted tradeoff on where the credential lives
adsb.win's own API docs state it is "CORS-enabled for browser fetch from local-network apps" specifically so a local app like this one can call it straight from client JS with only a `Bearer` header — this is the intended integration path, not a workaround. Given this app's static-export deploy topology has no live server process to proxy through (Context), a server-side fetch that hides the UUID from the browser entirely is not feasible here without adding a new always-on server process to this app's deploy story — a materially bigger, differently-scoped change than this one.

**Accepted tradeoff**: the feeder UUID lives in the browser's `localStorage` (Decision 2) rather than a server-side secret store, and every request carries it in a header sent to a third-party origin. This is explicitly the acceptance criteria's own fallback guidance ("otherwise note the tradeoff in design.md if a server-side fetch path isn't feasible here") and mirrors how this app already handles its one other credential-shaped value, `NEXT_PUBLIC_MAPTILER_KEY`/`NEXT_PUBLIC_OPENAIP_API_KEY` — except those are baked into the public build at compile time (fine for low-sensitivity, rate-limited API keys), whereas the feeder UUID is read-only-but-still-a-bearer-credential for a real account, so it deliberately does *not* follow that env-var pattern (Decision 2) despite the superficial similarity.

**Alternative considered (rejected)**: add a Next.js server route (`app/api/adsb-win/aircraft-models/[type]/route.ts`) that reads the UUID from a server-side env var and proxies the request, keeping it fully off the client. Rejected: this app has no runtime server in its deployed form (`force-static` is the *only* mode a route can build in under `output: "export"` — a per-request dynamic proxy is architecturally impossible here, not just undesirable), and even in `next dev` alone (no deploy topology) it would require introducing a second, deploy-incompatible code path just for local development, which is worse than one consistent client-side path.

### 2. Feeder UUID storage: a new `localStorage` key via `feederUuid.ts`, not `NEXT_PUBLIC_FEEDER_UUID`
`components/map/overlay/feederUuid.ts` (new) mirrors `theme.ts` exactly: `FEEDER_UUID_STORAGE_KEY = "squawkmap3d:adsbWinFeederUuid"`, `getStoredFeederUuid(): string | null`, `storeFeederUuid(uuid: string): void` (trims whitespace; an empty string after trim clears the key instead of storing `""`), `clearStoredFeederUuid(): void`. Same `typeof window === "undefined"` SSR guard and try/catch-around-storage-access (private browsing) as `theme.ts`.

Rejected: a `NEXT_PUBLIC_ADSB_WIN_FEEDER_UUID` env var, matching `NEXT_PUBLIC_MAPTILER_KEY`'s existing pattern. Rejected per the acceptance criteria's explicit guidance ("prefer storing it in local app config rather than hardcoding into distributed JS") — a `NEXT_PUBLIC_*` value is compiled directly into the static bundle shipped to (and world-readable from) the feeder box's `out/` directory (`deploy-to-feeder`'s own docs: "`NEXT_PUBLIC_*` values are baked in at build time"). A `localStorage`-only value never appears in that bundle, in `.env.local`, or in anything committed to git — strictly better for a real bearer credential than for the two existing low-sensitivity map-tile API keys that do use this env-var pattern today.

### 3. Configuration UI: inline in `PlaneCard`'s own not-configured state, not a new Settings tab
`PlaneCard` already owns its own empty-state rendering (`.statsEmpty`, "Not tracked yet"). When `cardStats.status === "not_configured"` (Decision 6), the same region instead renders a short prompt plus a masked (`type="password"`) text input and a Save button. Submitting calls `storeFeederUuid()` directly (no callback prop threaded through `AircraftOverlay`) — the next ~1s aircraft poll (`MapView.tsx`'s `refreshAircraft()`) reads the freshly-stored UUID and resolves real `cardStats` automatically; no manual "refetch" trigger is needed. `invalid_token` reuses the same input (pre-labeled "Update" instead of "Save") so a mistyped or revoked UUID can be corrected from the same spot it was entered.

**Alternative considered (rejected)**: a new top-level "Settings" tab in `DrawerTabs.tsx` (currently `layers` | `aircraft`), or a new `layer-control-drawer` section. Rejected for this change: it's a materially bigger UI footprint (new tab, new persistent panel, new empty states of its own) for a single setting that's only ever relevant while `PlaneCard` is on screen, and this app has no other precedent for a dedicated settings surface (every other optional integration — `NEXT_PUBLIC_FEEDER_URL`, `NEXT_PUBLIC_OPENAIP_API_KEY` — degrades silently with no in-app configuration UI at all, so an inline prompt is already a step up in discoverability, not a step down from an existing pattern). **Accepted residual UX gap**: a user can only discover/edit this setting while an aircraft is selected and the overlay is open; there's no way to pre-configure it or view/clear it without selecting something first. Flagged as a reasonable follow-up if it proves too undiscoverable in practice, not a blocker here.

### 4. `xpProgressToNextTier` returns, driven by a provisional, clearly-marked-approximate default threshold table — `rarityTier` stays untouched
The pre-existing `xpProgressToNextTier` prop and its "N% to {next tier}" label were originally computed off *this app's own* `rarityTier` ladder (`unidentified`→...→`apex`, `aircraft-rarity` capability Decision 5 — sourced from a vendored `taildragger` rareness snapshot, entirely unrelated to adsb.win's real account data) via `nextRarityTier()`. The real API's `tier` field (e.g. `"Alloy"`) is adsb.win's own *different*, real, per-account *material*-tier ladder — `PlaneCard.tsx`'s own existing doc comment already anticipated this exact distinction ("mirroring adsb.win's own '0% to Carbon' label — that's their *material* tier ladder; this is the equivalent for the *rarity* ladder"). The API response itself carries only the account's current `xp` and current `tier` name — **no per-tier XP threshold or next-tier name is documented anywhere in adsb.win's API**.

To fill that gap, the tester (product owner) supplied several real adsb.win card screenshots as reference. Reconstructing thresholds from them:
- **Alloy → Carbon, Standard rarity**: two consistent data points (8,400 XP / 34%, and 23,833 XP / 95%) both independently back out a Carbon-start threshold of ≈25,000 XP — a genuinely solid figure.
- **Carbon → Titanium, Standard rarity**: only one data point (88,507 XP / 85%), extrapolated from the 25,000 Carbon-start figure to a Titanium-start of ≈99,700 XP (rounded to 100,000) — a single-point estimate, materially weaker than the Alloy figure.
- **Titanium and beyond**: irrecoverable. Two Titanium+Remarkable-rarity cards (76,000 XP / 52% vs. 106,743 XP / 3%) show *higher* XP paired with *lower* progress-to-next-tier — impossible under any monotonic formula, even holding tier and rarity badge constant. The screenshots are illustrative marketing/mockup material, not live-system output, and don't encode one real formula past the first boundary.

**Decision**: rather than leave the progress bar permanently blank (the original conclusion, before these screenshots existed) or ship on unverifiable extrapolation as if it were confirmed, this change restores the progress bar driven by a small, explicitly-provisional default threshold table (`components/map/overlay/tierProgress.ts`, Decision 4a below) — seeded with the one solid figure (Carbon starts at 25,000) and straightforward round-number guesses for the rest, following the loosely-observed "each tier is a few times wider than the last" shape from the reference screenshots. This is a deliberate, temporary exception to this codebase's usual discipline against fabricating unverified data (`aircraft-rarity`'s design.md Decision 5): it's accepted here only because (a) the tester explicitly asked for sensible defaults now and will supply real numbers in a follow-up change, (b) the table is isolated in its own module with every value commented as provisional/unsourced, and (c) an unrecognized `tier` name degrades to "no bar" (Decision 4a) rather than a wrong guess, so a future real tier being added upstream can't silently render a bogus percentage.

`rarityTier`'s own frame/border styling and bottom-edge tier badge (driven by `computeRarityTier()`) remain completely unaffected — the two tier concepts render in visually distinct places on the card and are never conflated.

**Alternative considered (rejected)**: replace `rarityTier`'s frame styling with the API's `tier` value, since it's "more real" than the vendored rareness dataset. Rejected — out of scope (the acceptance criteria asks to fill in the *currently-missing* values; `rarityTier` is not currently missing, it already renders real per-type data today) and would require an entirely new CSS taxonomy this change has no basis to build.

### 4a. Provisional tier-threshold table: shape, source, and update path
`components/map/overlay/tierProgress.ts` (new):
```ts
// PROVISIONAL — not sourced from adsb.win. Derived from a handful of
// screenshots the tester supplied; only the Alloy->Carbon boundary
// (~25,000 XP) is well-supported by two independent, consistent data
// points. Everything else here is a round-number placeholder pending a
// follow-up change with real, confirmed thresholds. Do not treat these
// as authoritative.
const PROVISIONAL_TIER_START_XP: Record<string, number> = {
  alloy: 0,
  carbon: 25_000,
  titanium: 100_000,
  iridium: 300_000,
  plasma: 750_000,
  quantum: 1_500_000, // max tier observed in reference screenshots
};

const TIER_ORDER = ["alloy", "carbon", "titanium", "iridium", "plasma", "quantum"] as const;

export interface TierProgress {
  percentToNext: number; // 0-99, clamped — never shown as 100 (see below)
  nextTierName: string | null; // null only for the max tier
}

export function computeTierProgress(tierName: string, xp: number): TierProgress | null {
  const key = tierName.trim().toLowerCase();
  const idx = TIER_ORDER.indexOf(key as (typeof TIER_ORDER)[number]);
  if (idx === -1) return null; // unrecognized tier name — render no bar, not a guess
  const start = PROVISIONAL_TIER_START_XP[key];
  const nextKey = TIER_ORDER[idx + 1];
  if (!nextKey) return { percentToNext: 100, nextTierName: null }; // max tier reached
  const end = PROVISIONAL_TIER_START_XP[nextKey];
  const raw = ((xp - start) / (end - start)) * 100;
  return { percentToNext: Math.min(99, Math.max(0, Math.round(raw))), nextTierName: capitalizeTierName(nextKey) };
}
```
- **Clamped to 99%, never 100%, for a non-max tier**: the API's own `tier` field, not this table, is the source of truth for when a tier-up actually happened. If the provisional table's guess runs ahead of reality, showing "99% to Titanium" is a harmless minor understatement; showing "100% to Titanium" while the API still reports `"Carbon"` would read as a bug. Only the true max tier (`quantum`, no `nextKey`) renders the full/complete bar, matching the reference screenshot's "MAXIMUM TIER" card, which showed a full-width bar with no percentage label.
- **Unrecognized tier name → `null` → no bar rendered**, same fallback `PlaneCard` already has for the "no threshold data" case this table replaces (Decision 5's `"ok"` branch: XP count and tier name still render as plain values). This is the safety valve for adsb.win adding a new tier above `quantum`, or the tester's real numbers later revealing this list is incomplete — the UI degrades to "no bar," never a wrong percentage.
- **Isolated on purpose**: this table lives in its own module, separate from `aircraftModelCard.ts` (Decision 5's pure API-response mirror), so replacing it with real numbers in a follow-up change is a one-file diff that touches no fetch/cache/type logic.
- **Follow-up change** (tracked, not part of this change's `tasks.md`): once the tester has real per-tier thresholds (and ideally confirms whether the curve varies by the rarity badge visible in the reference screenshots, which the JSON API doesn't currently expose), replace `PROVISIONAL_TIER_START_XP`'s values and delete this note.

### 5. `cardStats` replaces the six stat props + `viewRegistrationsHref` with one discriminated union
```ts
// components/map/overlay/aircraftModelCard.ts
export interface AircraftModelCardAttributes {
  name: string;
  manufacturer: string;
  tier: string;
  xp: number;
  uniqueAircraft: number;
  uniqueRegistrations: number;
  flightsCaptured: number;
  observedSeconds: number;
  maximumAltitudeFt: number | null; // API: "may be null"
  firstSeenAt: string;
  lastSeenAt: string;
  historicalThrough: string;
}

export type AircraftModelCardResult =
  | { status: "ok"; attributes: AircraftModelCardAttributes }
  | { status: "not_configured" }   // caller-synthesized: no feeder UUID stored, request never sent
  | { status: "invalid_token" }    // API 401
  | { status: "not_found" }        // API 404
  | { status: "error" };           // network failure, non-2xx/non-404/401, unparseable body
```
`fetchAircraftModelCard(typeDesignator, feederUuid)` only ever returns `"ok" | "invalid_token" | "not_found" | "error"` (it requires a non-empty `feederUuid`); `"not_configured"` is added by the caller *before* calling fetch at all, when `getStoredFeederUuid()` returns `null` — this avoids ever sending a request with an empty/missing `Authorization` header. `SelectedAircraftInfo.cardStats?: AircraftModelCardResult` is `undefined` only when `typeDesignator` itself is unknown (feeder has no tar1090-db loaded) — mirrored 1:1 on the existing `route`/`callsign` guard shape in `MapView.tsx`'s `refreshAircraft()`. `PlaneCard` treats `cardStats === undefined` and `cardStats.status === "not_found"` as the same rendered "Not tracked yet" empty state (Decision 6) — both mean "nothing to show, not an error."

This replaces `PlaneCardProps`' seven separate optional fields (`uniqueRegistrationsCount`, `flightsCapturedCount`, `observedFlightTimeSeconds`, `highestAltitudeObserved`, `xp`, `xpProgressToNextTier`, `viewRegistrationsHref`) and their fragile "all six must be defined" `statsPresent` gate with one prop and a `switch` over five known states. `viewRegistrationsHref` is dropped outright rather than kept forward-plumbed: the API response has no matching link field, and an unpopulatable prop kept "for forward compatibility" in the very change that was supposed to populate its neighbors is dead weight — trivial to re-add from git history if a real per-type registrations view ever exists.

### 6. Fetch/cache location and shape: extend `MapView.tsx`'s existing `refreshAircraft()`, mirror `flightRoute.ts` exactly
`aircraftModelCard.ts` copies `flightRoute.ts`'s structure field-for-field:
- `fetchAircraftModelCard()` never throws (try/catch internally), same as `getFlightRoute()`.
- `getCachedAircraftModelCard(typeDesignator, feederUuid)` — module-level `Map<string, AircraftModelCardResult>` keyed `${feederUuid}::${typeDesignator.toUpperCase()}` (uppercased for a stable key regardless of any casing quirk in `Aircraft.typeDesignator`; also uppercased in the request path segment). Keying on `feederUuid` too means changing the configured UUID naturally busts the effective cache (new key) with no explicit invalidation needed — the API's own privacy design (404 doesn't reveal another account's card) means stale cross-account data must never leak, and this key shape makes that impossible by construction rather than by remembering to call a clear function.
- **Deliberate divergence from `flightRoute.ts`**: `"error"` results are *not* cached (every other status is). `getFlightRoute()`'s `null` "no match" result is a legitimate, stable business outcome worth caching; a `"error"` here is a transient network/parse failure that deserves a retry on the next poll tick rather than sticking for the rest of the session. `clearAircraftModelCardCache()` is exported for parity/tests and called defensively whenever `feederUuid.ts`'s `storeFeederUuid()`/`clearStoredFeederUuid()` run (belt-and-suspenders on top of the key already changing).
- **Deliberate divergence #2**: unlike `clearFlightRouteCache()` (called on every deselect/drop-out in `MapView.tsx`), this cache is *not* cleared on deselect. It's keyed by aircraft type, not by hex+callsign — bounded by the number of distinct types seen in a session (tens, not thousands), so there's no memory-growth pressure to justify eagerly discarding a still-useful cached card the next time that same type is reselected.
- `MapView.tsx`'s `refreshAircraft()` resolves `cardStats` the same place and the same way it already resolves `route` (right before `buildSelectedAircraftInfo(...)` is called):
  ```ts
  let cardStats: AircraftModelCardResult | undefined;
  if (selected.typeDesignator) {
    const feederUuid = getStoredFeederUuid();
    cardStats = feederUuid
      ? await getCachedAircraftModelCard(selected.typeDesignator, feederUuid)
      : { status: "not_configured" };
  }
  ```
  Because this reuses the poll loop's existing single await-chain-then-`setSelectedAircraftInfo()` shape, there's no new "loading" UI state to design (Non-Goals) — the overlay simply doesn't update until the whole poll (route + card, both cache-cheap after the first) resolves, exactly the existing (and spec'd, `aircraft-info-overlay`'s "no visible close/reopen flash" scenario) behavior for route lookups today.

**Alternative considered (rejected)**: a new `useAircraftModelCard()` React hook + `useEffect` inside `AircraftOverlay.tsx`, keyed on `info?.typeDesignator`. This was the first approach drafted here, but `MapView.tsx` already has a working, spec'd, tested-pattern solution for "resolve one piece of async per-selection enrichment data, cached, without re-fetching every ~1s poll tick" (`route`) — introducing a second, differently-shaped mechanism for a near-identical problem in the same overlay would be inconsistent with no offsetting benefit.

### 7. Live-QA follow-up fixes (post-validation, real feeder + stubbed `"ok"` response)
`phobetor`'s validation pass (Decisions 1–6, all `tasks.md` 1–8 items) was clean, but manual browser QA against the real feeder box (`adsb-feeder.local`, with a stubbed adsb.win `"ok"` response since a real feeder UUID wasn't available yet — see the still-open 9.2–9.7 gap below) surfaced four issues invisible to lint/tsc/unit tests, all fixed directly in `PlaneCard.tsx`/`.module.css`:

- **Content clipped inside the card**: `.aircraftTierCard`'s `overflow: hidden` (load-bearing for the two-layer rarity-frame border technique, Decision 5/the file's top doc comment) silently clipped the stat grid + XP/progress row whenever the header + stats didn't fit the card's actual allotted height — `AircraftOverlay.tsx`'s own grid-level `ResizeObserver`/`transform: scale()` mechanism can't reach in here to compensate, since the clip happens before that outer measurement ever sees the overflow. Fixed with a second, card-local copy of the same mechanism: a `.scaledContent` wrapper (`contentRef`) around everything below `.glowOrb`, with a `ResizeObserver`-driven `transform: scale()`, capped at 1. Two root-causes worth recording since they weren't obvious from the first pass: (a) the scale factor was first computed as `.scaledContent`'s `scrollHeight` vs. `.aircraftTierCard`'s `clientHeight` — but `.aircraftTierCard` has 20px of padding on every side that isn't part of `.scaledContent`'s own box, so "available height" was overstated by 40px and the content under-scaled by exactly that much; fixed to a self-referential comparison (`.scaledContent`'s own `scrollHeight`/`scrollWidth` vs. its own `clientHeight`/`clientWidth`, which `flex: 1; min-height: 0` pins to the real remaining space) — neither pair is affected by an already-applied `transform`, so it's stable and can't feed back on itself. (b) `transform-origin: top left` pinned shrunk content to the card's top-left corner, reading as squished into one corner rather than shrunk in place; changed to `top center`.
- **Manufacturer/model swapped in the identity header**: readsb's `desc` field (this app's `manufacturerModel`) is one combined free-text string (e.g. `"AIRBUS A-320"`), not separate manufacturer/model fields — the header was rendering the tail number where the manufacturer belongs and repeating the manufacturer name inside the model line. Added `splitManufacturerModel()` (`PlaneCard.tsx`), splitting on the first space — correct for every single-word manufacturer observed in practice, explicitly documented as unreliable for multi-word manufacturers (e.g. "MCDONNELL DOUGLAS ...") since there's no structured field to do better. The now-unused `registration` prop was dropped from `PlaneCardProps` and its `AircraftOverlay.tsx` call site entirely rather than left dead.
- **Missing material-tier badge**: reference adsb.win markup shows two pill badges at the card's bottom edge (material tier + rarity); only `.rarityBadge` was rendered. Added `.tierBadge`, shown only when `cardStats.status === "ok"`, displaying the real `tier` name — plain/neutral styling, no per-tier accent color, since only one real tier name (`"Alloy"`) has ever been observed against a live account, not enough to build a verified color mapping (same discipline as Decision 4's provisional-data caveat).
- **XP formatting**: the XP value now uses `.toLocaleString()` for comma-separated formatting (`153,600 XP`), matching the card's other large numbers (`uniqueRegistrations`/`flightsCaptured`/`maximumAltitudeFt` already did).

All four were verified in a live browser session (Chrome DevTools automation) against the real feeder plus the stubbed `"ok"` response; `npm run lint`, `npx tsc --noEmit`, and `npm test` (164/164) were re-run clean after each edit.

## Risks / Trade-offs

- **[Risk]** The feeder UUID is a real bearer credential living in browser `localStorage`, readable by any script running on this app's origin (XSS) or by anyone with physical/device access to the browser. → **Mitigation**: same trust boundary as `theme.ts`'s stored theme preference and `PlaneListingPanel.tsx`'s stored filters — this app has no other script-injection surface today (no user-generated HTML rendered, no third-party embedded scripts). Scoped read-only per the API's own design (feeder UUID grants read access to this account's own stats only). Never sent anywhere but `app-api.adsb.win`'s `Authorization` header.
- **[Risk]** Only one confirmed real `tier` name (`"Alloy"`) is known; `PlaneCard.module.css`'s tier-badge styling for this field is unstyled/generic (plain text badge) rather than tier-colored, since the full material-tier→color mapping is undocumented. → **Mitigation**: render it as a plain, neutrally-styled label (not attempting a tier-specific accent color) — matches this repo's discipline of not fabricating unverified visual data (Decision 4's broader rationale). A future change can add real per-tier colors once more tier names/values are observed on a live authenticated account, the same way `aircraft-rarity`'s Decision 5 originally sourced its real tier CSS.
- **[Risk]** `app-api.adsb.win` being unreachable/rate-limiting/slow adds latency to the aircraft-poll loop's existing await chain (already true of `adsb.im`'s routeset call) → **Mitigation**: per-type caching (Decision 6) means this only actually blocks the poll on the first selection of a given type per session; `"error"` results aren't cached so a persistent outage degrades to "Unable to load stats right now" on every poll for that type rather than blocking indefinitely, and the rest of the overlay (`RecordPanelHero`/`TelemetryMarquee`/`FlightInfoPane`) is unaffected either way since they don't depend on `cardStats`.
- **[Risk]** The progress-bar percentage shown for any tier past Alloy→Carbon is a provisional guess, not a confirmed adsb.win value — a real user could see a bar that's meaningfully wrong relative to their actual distance to the next tier. → **Mitigation**: clamped to 99% max on a non-max tier (never falsely claims "done"), isolated in one clearly-commented module (`tierProgress.ts`, Decision 4a) for a cheap follow-up swap, and degrades to "no bar" rather than a wrong number for any tier name it doesn't recognize. Accepted per explicit tester direction to ship sensible defaults now and supply real numbers in a later change.
- **[Risk]** No integration test can exercise the real adsb.win API (would require a real feeder UUID and a real captured aircraft type — a live account dependency this repo's test suite can't carry). → **Mitigation**: `aircraftModelCard.test.ts` unit-tests `fetchAircraftModelCard`/`getCachedAircraftModelCard`/`clearAircraftModelCardCache` against a stubbed `global.fetch`, mirroring `flightRoute.test.ts`'s existing approach exactly (per-status-code response fixtures for `200`/`401`/`404`/network-throw); manual verification against a real account is a task in `tasks.md`.

## Migration Plan

Additive + one internal (non-public) breaking prop-shape change confined to `PlaneCard`/`SelectedAircraftInfo`/`AircraftOverlay` — all three are edited together in this same change, so there's no intermediate broken state. No persisted-state migration: a first-ever load has no stored feeder UUID (`not_configured`, same visual weight as today's permanent empty state until the user opts in). Rollback is a straight revert; the only new persisted browser state is the `localStorage` key from Decision 2, which a revert simply stops reading (harmless orphaned key, same as any other removed `localStorage` setting in this codebase's existing pattern).

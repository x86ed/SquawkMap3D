## 1. Data model extensions

- [ ] 1.1 In `components/map/aircraft.ts`, extend `RawAircraftJson`'s aircraft entry with `r?: string`, `desc?: string`, `ownOp?: string`, `year?: string`, `seen?: number`, and extend `Aircraft` with `registration?: string`, `manufacturerModel?: string`, `operator?: string`, `year?: string`, `secondsSinceLastMessage?: number` — same optional/`undefined`-when-omitted contract as the existing `t`/`typeDesignator` field (doc comment should say so explicitly).
- [ ] 1.2 Update `normalize()` to map `r` → `registration`, `desc` → `manufacturerModel`, `ownOp` → `operator`, `year` → `year`, `seen` → `secondsSinceLastMessage` (trim registration/operator/manufacturerModel like `callsign` already does, `undefined` if empty after trim).
- [ ] 1.3 Extend `TrackPoint` with `groundSpeed?: number`; update `updateTracks()` to record it whenever the source aircraft's `groundSpeed` is defined (does not gate whether a point is recorded at all — unchanged gating on lat/lon/altitude).

## 2. Rarity tier module (data-derived, see design.md Decision 5)

- [ ] 2.1 Write a one-time generation script (e.g. `scripts/generate-aircraft-rareness.mjs`, run manually by a developer with the sibling `taildragger` repo checked out locally — **not** part of `npm run build`/CI, since CI has no access to that repo's local path) that reads `taildragger`'s `aircraft-data.json`, filters `rows` to entries with a defined `rareness` field, maps each to `{ id, rareness }` (dropping all other game-specific fields), sorts by `id`, and writes the result to `components/map/data/aircraftRareness.json`. Document in the script's header comment that it must be re-run and its output re-committed manually whenever `taildragger`'s dataset meaningfully changes (no fixed cadence).
- [ ] 2.2 Run the script once now and commit the resulting `components/map/data/aircraftRareness.json` (expected ≈1679 entries as of the `taildragger` snapshot dated 2026-08-01, ≈56KB).
- [ ] 2.3 Add `components/map/aircraftRarity.ts` exporting:
  - `RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary"`
  - `RARITY_TIER_COLORS: Record<RarityTier, string>` (`common` `#64748b`, `uncommon` `#22c55e`, `rare` `#06b6d4`, `epic` `#8b5cf6`, `legendary` `#eab308`)
  - `RARITY_TIER_THRESHOLDS` — the four pinned quantile cutpoints from design.md Decision 5's table (`6.91`, `9.19`, `11.18`, `13.15`)
  - `computeRarityValue(aircraft: Aircraft): number` — imports `components/map/data/aircraftRareness.json` and builds a `Map<string, number>` (`id → rareness`) once at module load; looks up `aircraft.typeDesignator`, returns `row.rareness / 100` on a match, else the fixed default `15`
  - `computeRarityTier(aircraft: Aircraft): RarityTier` — buckets `computeRarityValue(aircraft)` against `RARITY_TIER_THRESHOLDS` per design.md Decision 5's table (`< 6.91` → `common`, `6.91–<9.19` → `uncommon`, `9.19–<11.18` → `rare`, `11.18–<13.15` → `epic`, `≥13.15` → `legendary`)
- [ ] 2.4 Add `test/aircraftRarity.test.ts` (mirroring `test/terminator.test.ts`'s `node:test`/`assert` style) covering the scenarios in `specs/aircraft-rarity/spec.md`: a known matching type designator resolves `rarityValue = rareness / 100`; an unmatched/unset type designator resolves the fixed default `15`; each of the five tier boundaries (values just below/at/above each cutpoint) buckets to the correct tier; and that `RARITY_TIER_COLORS` has a defined, non-empty value for every `RarityTier`.

## 3. Flight route data proxy — endpoint discovery (blocks section 11's route tasks only, see design.md Decision 12)

- [ ] 3.1 **Blocking discovery task, must be done before any `FlightInfoPane` route/timeline task (section 11) is implemented — does not block any other section of this change.** Inspect the feeder's running tar1090 install (browser devtools network tab against the feeder's own tar1090 UI, and/or `scripts/squawkmap3d.nginx.conf` / the ultrafeeder container's served files) to find the exact route-lookup endpoint path and response shape tar1090 itself uses for a given callsign. Do not guess or hardcode an unverified path.
- [ ] 3.2 Add the corresponding proxy rule to `scripts/squawkmap3d.nginx.conf` — a `location = /data/<confirmed-path>` block proxying to `http://host.docker.internal:8080/<same-path>`, matching the existing `receiver.json`/`outline.json` blocks exactly in style.
- [ ] 3.3 Add `components/map/flightRoute.ts` exporting `getFlightRoute(callsign: string): Promise<FlightRoute | null>`, mirroring `feederLocation.ts`'s `getFeederLocation()` contract exactly: always resolves, never rejects — no endpoint configured, network failure, malformed response, or "no route found for this callsign" all resolve to `null`. Shape `FlightRoute` (origin/destination airport identifiers, and whatever else the discovered response actually contains per 3.1) once the real shape is known.

## 4. Selection, picking, and glow highlight

- [ ] 4.1 In `components/map/aircraftLayer.ts`, add `selectedHex: string | null` and `onAircraftClick: (hex: string | null) => void` params to `buildAircraftLayers()`; set `pickable: true` and `onClick: (info) => onAircraftClick(info.object ? (info.object as Aircraft).hex : null)` on the `IconLayer`.
- [ ] 4.2 In `buildAircraftLayers()`, when `selectedHex` matches a currently-positioned aircraft, build a one-element `ScatterplotLayer` (glow highlight) at that aircraft's position, radius in pixels, `getFillColor` from `RARITY_TIER_COLORS[computeRarityTier(aircraft)]` at reduced alpha (e.g. alpha ~120/255), and prepend it to the returned layers array so it renders beneath `trackLayer`/`iconLayer`.
- [ ] 4.3 In `MapView.tsx`, add `selectedAircraftHex`/`selectedAircraftHexRef` state, a `lastAircraftClickAtRef` timestamp guard (design.md Decision 3), and a `handleAircraftClick(hex: string | null, picked?: Aircraft)` that toggles selection off when clicking the already-selected hex, else selects the clicked hex, and records `lastAircraftClickAtRef.current = Date.now()`. When resulting in a new selection (not a toggle-off) and `followSelectedAircraftRef.current` is true, immediately `easeTo` the map to the picked aircraft's current position (design.md Decision 13 — camera moves as part of the selection action, not on a delay to the next poll).
- [ ] 4.4 Wire `handleAircraftClick` into `refreshAircraft()`'s call to `buildAircraftLayers()` (pass `selectedHex: selectedAircraftHexRef.current`, `onAircraftClick: handleAircraftClick`).
- [ ] 4.5 Add a `map.on("click", ...)` (unscoped, not layer-id-scoped) handler that deselects when `selectedAircraftHexRef.current` is set and `Date.now() - lastAircraftClickAtRef.current` exceeds a small guard window (e.g. 50ms), i.e. this click wasn't the same pointer event the `IconLayer.onClick` already handled.
- [ ] 4.6 Add a `keydown` listener (mount effect, cleaned up on unmount) that clears selection when `event.key === "Escape"`.
- [ ] 4.7 In `refreshAircraft()`, after fetching, if `selectedAircraftHexRef.current` is set but no longer present in the fetched `aircraft` array, clear selection (deselect-on-drop-out per spec).

## 5. Follow-selected-aircraft toggle (aircraft pinned on screen, map recenters underneath it — design.md Decision 13)

- [ ] 5.1 Add `followSelectedAircraft`/`followSelectedAircraftRef` state to `MapView.tsx`, default `true`.
- [ ] 5.2 Add a "Follow selected aircraft" toggle button to the controls panel, matching the existing toggle-button markup/pattern (`data-active`, `onClick` handler mirroring `handleMilitaryToggle`'s shape). This toggle and the click-to-select camera lock (task 4.3) are the same mechanism, not two separate controls — toggling it off does not deselect; it only stops the camera from moving on future selections/polls.
- [ ] 5.3 In `refreshAircraft()`, after updating tracks, if `followSelectedAircraftRef.current` is true and `selectedAircraftHexRef.current` matches a positioned aircraft in the latest fetch, call `mapRef.current.easeTo({ center: [lon, lat], duration: <short, e.g. 800ms> })` (not `jumpTo`, per design.md's "not jarring" note); skip entirely when follow is off or nothing is selected. This is the "map pans underneath the pinned aircraft" recenter, run every poll while locked (in addition to task 4.3's immediate recenter on selection itself).

## 6. Selected-aircraft view-model

- [ ] 6.1 Add `components/map/overlay/selectedAircraftInfo.ts` exporting a `SelectedAircraftInfo` interface (registration, manufacturerModel, operator, rarityTier, rarityColor, callsign, hex, altitude, groundSpeed, track, verticalRate, squawk, secondsSinceLastMessage, distance nm from site, sparkline-ready altitude/groundSpeed series from the track buffer, and `route: FlightRoute | null` per design.md Decision 12) and `buildSelectedAircraftInfo(aircraft, track, site, route): SelectedAircraftInfo`, computing `distance` via `turf.distance(site, [aircraft.lon, aircraft.lat], { units: "nauticalmiles" })` when `site` is resolved, else `undefined`.
- [ ] 6.2 In `MapView.tsx`, compute `buildSelectedAircraftInfo(...)` once per `refreshAircraft()` poll when an aircraft is selected (reusing whichever of `userLocationRef`/feeder-site resolution is already in scope — see design.md Decision 8), calling `getFlightRoute(aircraft.callsign)` (task 3.3) when a callsign is available and caching/reusing the result across polls for the same aircraft rather than re-fetching every ~1s poll (e.g. keyed by hex+callsign, invalidated on deselect), store in state for the overlay to consume.

## 7. AircraftOverlay shell (drawer open/close/keyboard/responsive)

- [ ] 7.1 Add `components/map/overlay/AircraftOverlay.tsx` + `AircraftOverlay.module.css`: renders `null` when no `SelectedAircraftInfo` is passed, else a full-width bottom drawer (`translateY` slide-up transition, scrim behind it, close button, drag-handle affordance) containing the four child components in a CSS grid (`RecordPanelHero` mid-top, `PlaneCard` left, `FlightInfoPane` right, `TelemetryMarquee` mid-bottom on wide viewports) that collapses to a single column (`RecordPanelHero` → `PlaneCard` → `FlightInfoPane` → `TelemetryMarquee`) via a CSS media/container query on narrow viewports.
- [ ] 7.2 Wire `AircraftOverlay`'s close button to call the same deselect path `handleAircraftClick(null)`/selection-clear uses (task 4.3).
- [ ] 7.3 Mount `<AircraftOverlay info={selectedAircraftInfo} onClose={...} />` in `MapView.tsx`'s render output, alongside the existing controls panel.

## 8. PlaneCard component

- [ ] 8.1 Add `components/map/overlay/PlaneCard.tsx` + `.module.css`: adsb.win-style sticker card (hard offset shadow, solid corner tag showing the tier name in `var(--tier-color)`, plane icon rotated 45°, registration heading, manufacturer/model + operator footer), reading its accent color from a `--tier-color` custom property set inline from `info.rarityColor`.
- [ ] 8.2 Render explicit "Unknown" placeholders for missing registration/manufacturerModel/operator (never blank, never literal "undefined"/"null") per spec.

## 9. RecordPanelHero component

- [ ] 9.1 Add `components/map/overlay/RecordPanelHero.tsx` + `.module.css`: square-corner panel, top-right "AIRFRAME / {hex}" tab, left icon/placeholder block, right identity block (kicker, registration heading, callsign, hex, 2-col spec grid: manufacturer/model/operator+age).
- [ ] 9.2 Implement aspect-driven reflow via `ResizeObserver` on the panel's own container ref (not a viewport media query): landscape arrangement when measured width ≥ height, portrait otherwise.
- [ ] 9.3 Render explicit placeholders for unknown spec-grid fields, same discipline as 8.2.

## 10. TelemetryMarquee component

- [ ] 10.1 Add `components/map/overlay/TelemetryMarquee.tsx` + `.module.css`: monospace (`var(--font-geist-mono)`) scrolling ticker of ALT/GS/HDG/V-S(with trend glyph)/SQK/DIST/SEEN pairs, built as a duplicated-content CSS `@keyframes` infinite-scroll (design.md Decision 11 — no new font dependency), fade-masked left/right edges.
- [ ] 10.2 Pause the scroll animation on `:hover`/`:focus-within` (CSS, no JS needed) per spec.
- [ ] 10.3 Format vertical rate's trend indicator (up/down/level glyph or arrow) from its sign, with a small dead-zone near zero for "level" (tune threshold during implementation, e.g. ±100 ft/min).
- [ ] 10.4 Omit/placeholder any missing telemetry value (no squawk, no distance when site unresolved, etc.) rather than rendering a fabricated number, per spec.

## 11. FlightInfoPane component

- [ ] 11.1 Add `components/map/overlay/FlightInfoPane.tsx` + `.module.css`: dual sparkline (altitude + ground speed, each independently normalized to its own series' min/max) rendered as inline SVG polylines from `info`'s altitude/groundSpeed series.
- [ ] 11.2 Render an explicit "not enough data yet" state when fewer than 2 track points are available for the sparkline.
- [ ] 11.3 **Blocked on section 3's discovery task.** Render the route-progress-bar/Timeline band's layout per the mockup's visual structure, populated from `info.route` (task 6.1) when non-null (origin/destination, and "first seen this session" from the track buffer's oldest point worded honestly as session-local unless the discovered response includes a real departure timestamp — design.md Decision 12); render the existing explicit "no route data available" empty state when `info.route` is `null` (now a legitimate per-aircraft fallback — e.g. tar1090 has no route for this callsign — not the default-for-everything behavior).

## 12. Verification

- [ ] 12.1 Manually verify: clicking an aircraft selects it (glow highlight appears in the correct rarity color, overlay opens with all four components populated, camera immediately centers on it); clicking the same aircraft again deselects (highlight clears, overlay closes); clicking a different aircraft switches selection cleanly.
- [ ] 12.2 Manually verify: clicking empty map area while an aircraft is selected deselects it, and does **not** also immediately re-select anything (guards against the click-bubbling double-fire risk in design.md Risks).
- [ ] 12.3 Manually verify: pressing Escape while an aircraft is selected deselects it and closes the overlay.
- [ ] 12.4 Manually verify: with "Follow selected aircraft" on (default) and an aircraft selected, the map recenters on it (aircraft stays visually pinned; map pans underneath it) across several poll cycles, including immediately on the initial selection click; toggling follow off stops the recentering without deselecting; dragging the map manually while locked does not break the lock (map snaps back on the next poll).
- [ ] 12.5 Manually verify: an aircraft with no tar1090-db-sourced fields (registration/manufacturerModel/operator all undefined) shows "Unknown" placeholders in `PlaneCard`/`RecordPanelHero`, never blank or literal "undefined"/"null".
- [ ] 12.6 Manually verify: `RecordPanelHero` reflows between portrait/landscape by resizing the overlay's own container (e.g. narrowing the browser window) independent of overall page aspect, confirming it's driven by `ResizeObserver` on its own element, not a viewport media query alone.
- [ ] 12.7 Manually verify: `TelemetryMarquee` scrolls continuously, pauses on hover and on keyboard focus, and resumes when the interaction ends.
- [ ] 12.8 Manually verify: on a narrow viewport, the overlay's four components stack in the specified order (`RecordPanelHero`, `PlaneCard`, `FlightInfoPane`, `TelemetryMarquee`).
- [ ] 12.9 Manually verify: a known common type (e.g. `B738`) computes a low rarity value/`common` or `uncommon` tier; an aircraft with an unset/unrecognized type designator computes the fixed default value (`15`) and `legendary` tier.
- [ ] 12.10 Manually verify (once section 3's endpoint is confirmed): an aircraft with a callsign tar1090 has a route for shows real origin/destination in `FlightInfoPane`; an aircraft with no matching route (or before the endpoint is confirmed) shows the "no route data available" empty state, not an error or blank section.
- [ ] 12.11 Run `npm run test:coverage` and confirm the new `aircraftRarity.test.ts` passes alongside the existing suite.

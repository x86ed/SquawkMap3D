## 1. Data model extensions

- [ ] 1.1 In `components/map/aircraft.ts`, extend `RawAircraftJson`'s aircraft entry with `r?: string`, `desc?: string`, `ownOp?: string`, `year?: string`, `seen?: number`, and extend `Aircraft` with `registration?: string`, `manufacturerModel?: string`, `operator?: string`, `year?: string`, `secondsSinceLastMessage?: number` — same optional/`undefined`-when-omitted contract as the existing `t`/`typeDesignator` field (doc comment should say so explicitly).
- [ ] 1.2 Update `normalize()` to map `r` → `registration`, `desc` → `manufacturerModel`, `ownOp` → `operator`, `year` → `year`, `seen` → `secondsSinceLastMessage` (trim registration/operator/manufacturerModel like `callsign` already does, `undefined` if empty after trim).
- [ ] 1.3 Extend `TrackPoint` with `groundSpeed?: number`; update `updateTracks()` to record it whenever the source aircraft's `groundSpeed` is defined (does not gate whether a point is recorded at all — unchanged gating on lat/lon/altitude).

## 2. Rarity tier module

- [ ] 2.1 Add `components/map/aircraftRarity.ts` exporting `RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary"`, `RARITY_TIER_COLORS: Record<RarityTier, string>` (`common` `#64748b`, `uncommon` `#22c55e`, `rare` `#06b6d4`, `epic` `#8b5cf6`, `legendary` `#eab308`), and `computeRarityTier(aircraft: Aircraft): RarityTier` implementing design.md Decision 5's ordered-signal table exactly (emergency squawk → uncommon-category set → known-unshaped type → known-shaped type → common), reusing `resolveIconKey` from `aircraftIcons.ts` for the type-shape check.
- [ ] 2.2 Add `test/aircraftRarity.test.ts` (mirroring `test/terminator.test.ts`'s `node:test`/`assert` style) covering each of the five spec scenarios in `specs/aircraft-rarity/spec.md`: emergency squawk → legendary; each uncommon-category code → epic; known-unshaped type → rare; known-shaped type → uncommon; no signal → common; and that `RARITY_TIER_COLORS` has a defined value for every `RarityTier`.

## 3. Selection, picking, and glow highlight

- [ ] 3.1 In `components/map/aircraftLayer.ts`, add `selectedHex: string | null` and `onAircraftClick: (hex: string | null) => void` params to `buildAircraftLayers()`; set `pickable: true` and `onClick: (info) => onAircraftClick(info.object ? (info.object as Aircraft).hex : null)` on the `IconLayer`.
- [ ] 3.2 In `buildAircraftLayers()`, when `selectedHex` matches a currently-positioned aircraft, build a one-element `ScatterplotLayer` (glow highlight) at that aircraft's position, radius in pixels, `getFillColor` from `RARITY_TIER_COLORS[computeRarityTier(aircraft)]` at reduced alpha (e.g. alpha ~120/255), and prepend it to the returned layers array so it renders beneath `trackLayer`/`iconLayer`.
- [ ] 3.3 In `MapView.tsx`, add `selectedAircraftHex`/`selectedAircraftHexRef` state, a `lastAircraftClickAtRef` timestamp guard (design.md Decision 3), and an `handleAircraftClick(hex: string | null)` that toggles selection off when clicking the already-selected hex, else selects the clicked hex, and records `lastAircraftClickAtRef.current = Date.now()`.
- [ ] 3.4 Wire `handleAircraftClick` into `refreshAircraft()`'s call to `buildAircraftLayers()` (pass `selectedHex: selectedAircraftHexRef.current`, `onAircraftClick: handleAircraftClick`).
- [ ] 3.5 Add a `map.on("click", ...)` (unscoped, not layer-id-scoped) handler that deselects when `selectedAircraftHexRef.current` is set and `Date.now() - lastAircraftClickAtRef.current` exceeds a small guard window (e.g. 50ms), i.e. this click wasn't the same pointer event the `IconLayer.onClick` already handled.
- [ ] 3.6 Add a `keydown` listener (mount effect, cleaned up on unmount) that clears selection when `event.key === "Escape"`.
- [ ] 3.7 In `refreshAircraft()`, after fetching, if `selectedAircraftHexRef.current` is set but no longer present in the fetched `aircraft` array, clear selection (deselect-on-drop-out per spec).

## 4. Follow-selected-aircraft toggle

- [ ] 4.1 Add `followSelectedAircraft`/`followSelectedAircraftRef` state to `MapView.tsx`, default `true`.
- [ ] 4.2 Add a "Follow selected aircraft" toggle button to the controls panel, matching the existing toggle-button markup/pattern (`data-active`, `onClick` handler mirroring `handleMilitaryToggle`'s shape).
- [ ] 4.3 In `refreshAircraft()`, after updating tracks, if `followSelectedAircraftRef.current` is true and `selectedAircraftHexRef.current` matches a positioned aircraft in the latest fetch, call `mapRef.current.easeTo({ center: [lon, lat], duration: <short, e.g. 800ms> })` (not `jumpTo`, per design.md's "not jarring" note); skip entirely when follow is off or nothing is selected.

## 5. Selected-aircraft view-model

- [ ] 5.1 Add `components/map/overlay/selectedAircraftInfo.ts` exporting a `SelectedAircraftInfo` interface (registration, manufacturerModel, operator, rarityTier, rarityColor, callsign, hex, altitude, groundSpeed, track, verticalRate, squawk, secondsSinceLastMessage, distance nm from site, sparkline-ready altitude/groundSpeed series from the track buffer) and `buildSelectedAircraftInfo(aircraft, track, site): SelectedAircraftInfo`, computing `distance` via `turf.distance(site, [aircraft.lon, aircraft.lat], { units: "nauticalmiles" })` when `site` is resolved, else `undefined`.
- [ ] 5.2 In `MapView.tsx`, compute `buildSelectedAircraftInfo(...)` once per `refreshAircraft()` poll when an aircraft is selected (reusing whichever of `userLocationRef`/feeder-site resolution is already in scope — see design.md Decision 8), store in state for the overlay to consume.

## 6. AircraftOverlay shell (drawer open/close/keyboard/responsive)

- [ ] 6.1 Add `components/map/overlay/AircraftOverlay.tsx` + `AircraftOverlay.module.css`: renders `null` when no `SelectedAircraftInfo` is passed, else a full-width bottom drawer (`translateY` slide-up transition, scrim behind it, close button, drag-handle affordance) containing the four child components in a CSS grid (`RecordPanelHero` mid-top, `PlaneCard` left, `FlightInfoPane` right, `TelemetryMarquee` mid-bottom on wide viewports) that collapses to a single column (`RecordPanelHero` → `PlaneCard` → `FlightInfoPane` → `TelemetryMarquee`) via a CSS media/container query on narrow viewports.
- [ ] 6.2 Wire `AircraftOverlay`'s close button to call the same deselect path `handleAircraftClick(null)`/selection-clear uses (task 3.3).
- [ ] 6.3 Mount `<AircraftOverlay info={selectedAircraftInfo} onClose={...} />` in `MapView.tsx`'s render output, alongside the existing controls panel.

## 7. PlaneCard component

- [ ] 7.1 Add `components/map/overlay/PlaneCard.tsx` + `.module.css`: adsb.win-style sticker card (hard offset shadow, solid corner tag showing the tier name in `var(--tier-color)`, plane icon rotated 45°, registration heading, manufacturer/model + operator footer), reading its accent color from a `--tier-color` custom property set inline from `info.rarityColor`.
- [ ] 7.2 Render explicit "Unknown" placeholders for missing registration/manufacturerModel/operator (never blank, never literal "undefined"/"null") per spec.

## 8. RecordPanelHero component

- [ ] 8.1 Add `components/map/overlay/RecordPanelHero.tsx` + `.module.css`: square-corner panel, top-right "AIRFRAME / {hex}" tab, left icon/placeholder block, right identity block (kicker, registration heading, callsign, hex, 2-col spec grid: manufacturer/model/operator+age).
- [ ] 8.2 Implement aspect-driven reflow via `ResizeObserver` on the panel's own container ref (not a viewport media query): landscape arrangement when measured width ≥ height, portrait otherwise.
- [ ] 8.3 Render explicit placeholders for unknown spec-grid fields, same discipline as 7.2.

## 9. TelemetryMarquee component

- [ ] 9.1 Add `components/map/overlay/TelemetryMarquee.tsx` + `.module.css`: monospace (`var(--font-geist-mono)`) scrolling ticker of ALT/GS/HDG/V-S(with trend glyph)/SQK/DIST/SEEN pairs, built as a duplicated-content CSS `@keyframes` infinite-scroll (design.md Decision 11 — no new font dependency), fade-masked left/right edges.
- [ ] 9.2 Pause the scroll animation on `:hover`/`:focus-within` (CSS, no JS needed) per spec.
- [ ] 9.3 Format vertical rate's trend indicator (up/down/level glyph or arrow) from its sign, with a small dead-zone near zero for "level" (tune threshold during implementation, e.g. ±100 ft/min).
- [ ] 9.4 Omit/placeholder any missing telemetry value (no squawk, no distance when site unresolved, etc.) rather than rendering a fabricated number, per spec.

## 10. FlightInfoPane component

- [ ] 10.1 Add `components/map/overlay/FlightInfoPane.tsx` + `.module.css`: dual sparkline (altitude + ground speed, each independently normalized to its own series' min/max) rendered as inline SVG polylines from `info`'s altitude/groundSpeed series.
- [ ] 10.2 Render an explicit "not enough data yet" state when fewer than 2 track points are available for the sparkline.
- [ ] 10.3 Render the route-progress-bar/Timeline band's layout per the mockup's visual structure, but populated with an explicit "no route data available" empty state (no origin/destination/ETA fields wired to real or fabricated data) per design.md's Open Question 1 default — leave a clearly-labeled `// TODO(follow-up): wire real route data pending product decision, see design.md Open Questions #1` comment at the relevant render branch.

## 11. Verification

- [ ] 11.1 Manually verify: clicking an aircraft selects it (glow highlight appears in the correct rarity color, overlay opens with all four components populated); clicking the same aircraft again deselects (highlight clears, overlay closes); clicking a different aircraft switches selection cleanly.
- [ ] 11.2 Manually verify: clicking empty map area while an aircraft is selected deselects it, and does **not** also immediately re-select anything (guards against the click-bubbling double-fire risk in design.md Risks).
- [ ] 11.3 Manually verify: pressing Escape while an aircraft is selected deselects it and closes the overlay.
- [ ] 11.4 Manually verify: with "Follow selected aircraft" on (default) and an aircraft selected, the map recenters on it across several poll cycles; toggling follow off stops the recentering without deselecting.
- [ ] 11.5 Manually verify: an aircraft with no tar1090-db-sourced fields (registration/manufacturerModel/operator all undefined) shows "Unknown" placeholders in `PlaneCard`/`RecordPanelHero`, never blank or literal "undefined"/"null".
- [ ] 11.6 Manually verify: `RecordPanelHero` reflows between portrait/landscape by resizing the overlay's own container (e.g. narrowing the browser window) independent of overall page aspect, confirming it's driven by `ResizeObserver` on its own element, not a viewport media query alone.
- [ ] 11.7 Manually verify: `TelemetryMarquee` scrolls continuously, pauses on hover and on keyboard focus, and resumes when the interaction ends.
- [ ] 11.8 Manually verify: on a narrow viewport, the overlay's four components stack in the specified order (`RecordPanelHero`, `PlaneCard`, `FlightInfoPane`, `TelemetryMarquee`).
- [ ] 11.9 Run `npm run test:coverage` and confirm the new `aircraftRarity.test.ts` passes alongside the existing suite.

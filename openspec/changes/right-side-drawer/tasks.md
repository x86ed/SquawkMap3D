## 1. Aircraft data model extensions

- [ ] 1.1 In `components/map/aircraft.ts`'s `RawAircraftJson`, add `messages?: number`, `rssi?: number`, `type?: string`, `dbFlags?: number`, `wd?: number`, `ws?: number` to the raw shape (readsb's own field names).
- [ ] 1.2 In `Aircraft`, add `messages?: number`, `rssi?: number`, `sourceType?: string` (avoids clashing with the `type` keyword, same convention as `typeDesignator`), `isMilitary?: boolean`, `windDirection?: number`, `windSpeed?: number`, each with a doc comment citing the raw readsb field name.
- [ ] 1.3 In `normalize()`, map `raw.messages` → `messages`, `raw.rssi` → `rssi`, `raw.type` → `sourceType`, `(raw.dbFlags ?? 0) & 1` → `isMilitary` (boolean), `raw.wd` → `windDirection`, `raw.ws` → `windSpeed`.
- [ ] 1.4 Add/update unit tests for `normalize()` covering the new fields present, absent, and `dbFlags` bit-flag edge cases (0, 1, other bits set without bit 0).

## 2. Shared flight-route cache (no additional throttling — design.md Decision 9)

- [ ] 2.1 In `components/map/flightRoute.ts`, add a module-level `Map<string, FlightRoute | null>` and export `getCachedFlightRoute(hex: string, callsign: string, lat: number, lon: number): Promise<FlightRoute | null>` — keyed `${hex}:${callsign}` (matching `MapView.tsx`'s existing key format exactly), returns the cached entry if present, otherwise calls `getFlightRoute()` and caches the result. No debounce, queue, rate limit, or staggering — fetch immediately on first ask for a given key, exactly as `MapView.tsx` does today.
- [ ] 2.2 Export `clearFlightRouteCache()` (clears the whole module-level map).
- [ ] 2.3 In `MapView.tsx`: remove the local `routeCacheRef` `Map` and its manual `.get`/`.has`/`.set` calls; call `getCachedFlightRoute(selected.hex, selected.callsign, selected.lat, selected.lon)` directly, and replace the two `routeCacheRef.current.clear()` call sites (deselect, drop-out) with `clearFlightRouteCache()`.
- [ ] 2.4 Add unit tests for `getCachedFlightRoute()`: first call for a key fetches and caches; a second call for the same key does not re-fetch (mock/spy `getFlightRoute()` call count); different keys fetch independently; `clearFlightRouteCache()` forces a re-fetch afterward.

## 3. Registration-country and airline-designator lookups

- [ ] 3.1 Add `components/map/registrationCountry.ts` exporting `countryCodeForRegistration(registration: string | undefined): string | null`, using a vendored tail-number-prefix → ISO country code table (`components/map/data/registrationPrefixes.json`), returning `null` for no match or no registration.
- [ ] 3.2 Add `components/map/data/airlineDesignators.json`, a vendored ICAO 3-letter callsign-prefix → airline-name table (source a suitable public dataset; document the source in a comment/README note near the file, same convention as `aircraftRareness.json`'s sourcing comment in `aircraftRarity.ts`).
- [ ] 3.3 Add `components/map/airlineLookup.ts` exporting `airlineNameForCallsign(callsign: string | undefined): string | null` — extracts the leading alphabetic prefix and looks it up in 3.2's table, returning `null` for no match.
- [ ] 3.4 Add unit tests for both lookups: known prefix, unknown prefix, missing/empty input.

## 4. Drawer shell and top-right cluster

- [ ] 4.1 Add `components/map/drawer/ThemeSlider.tsx` + `.module.css`: a slider control with day/night (sun/moon) symbols, receiving `theme`/`onToggle` props, replacing the current theme `<button>`'s markup (same `handleThemeToggle` call site in `MapView.tsx`).
- [ ] 4.2 Add `components/map/drawer/LayerDrawer.tsx` + `.module.css`: drawer shell (header with title + close button, scrollable body), `open`/`onClose` props, `transform: translateX` slide animation matching the reference file's `.drawer`/`.drawer.open` behavior.
- [ ] 4.3 In `MapView.tsx`: add `drawerOpenRef`/`[drawerOpen, setDrawerOpen]` state and a `handleDrawerToggle` handler.
- [ ] 4.4 In `MapView.tsx`'s render: replace the `.controls` button stack with a 3-item top-right cluster — `<ThemeSlider>`, the existing pilot-mode button (re-skinned to match, same `handlePilotModeToggle`), and a drawer-toggle button (`handleDrawerToggle`) — plus mount `<LayerDrawer open={drawerOpen} onClose={...}>` containing everything from tasks 5-9 below.
- [ ] 4.5 Update `MapView.module.css`: shrink `.controls` to the 3-item cluster's layout; remove now-unused per-button styles that move to the drawer's own CSS modules.
- [ ] 4.6 Confirm `ColorModeLegendDock`'s `right: 210px` offset (sized to clear the old button column) is revisited — it should clear the new, much narrower 3-item cluster instead; adjust the constant/comment in `ColorModeLegendDock.module.css` accordingly.

## 5. Accordion primitive

- [ ] 5.1 Add `components/map/drawer/Accordion.tsx` + `.module.css`: a generic `AccordionGroup` (header with icon/title/description/count + chevron, collapsible body) and `LayerToggleRow`/`Switch` primitives, matching the reference file's `.accordion-group`/`.acc-btn`/`.layer-row`/`.switch` structure, reusable for nested groups (Decision 4 in design.md).
- [ ] 5.2 `AccordionGroup` supports a `disabled` row variant (no-op switch, dimmed styling) for the Wildfires placeholder.
- [ ] 5.3 `AccordionGroup` supports recursive nesting (a row that is itself another `AccordionGroup`) for the Weather sub-disclosure.

## 6. Location toggle split (range rings)

- [ ] 6.1 In `components/map/userLocation.ts`: replace `setUserLocationVisibility` with `setUserLocationMarkerVisibility(map, visible)` (sets only `USER_LOCATION_ICON_LAYER_ID`) and `setRangeRingsVisibility(map, visible)` (sets only `USER_RINGS_LINE_LAYER_ID` and `USER_RINGS_LABEL_LAYER_ID`), updating both functions' doc comments to describe independent visibility rather than the old combined behavior.
- [ ] 6.2 In `MapView.tsx`: add `rangeRingsVisibleRef`/`[rangeRingsVisible, setRangeRingsVisible]` (default `true`, matching the existing default) and a `handleRangeRingsToggle` handler calling `setRangeRingsVisibility`.
- [ ] 6.3 In `MapView.tsx`: update every call site that used `setUserLocationVisibility(map, userLocationVisibleRef.current)` to call both `setUserLocationMarkerVisibility(map, userLocationVisibleRef.current)` and `setRangeRingsVisibility(map, rangeRingsVisibleRef.current)` (style-load re-add, jump-to-location resolution, etc.).
- [ ] 6.4 Update/add unit or integration coverage confirming the two toggles are independent (toggling one doesn't change the other's layer visibility).

## 7. Location for Distance column

- [ ] 7.1 In `MapView.tsx`: add `const [siteLocation, setSiteLocation] = useState<GeoCoords | null>(null)`, set alongside the existing `userLocationRef.current = coords` assignment, so it mirrors the resolved transponder/feeder location (with its existing browser-geolocation fallback).
- [ ] 7.2 Pass `siteLocation` down as a prop into `LayerDrawer` → `PlaneListingPanel`.

## 8. Layer-control accordion wiring

- [ ] 8.1 Aviation group: `AccordionGroup` rows for Airports, OpenAIP TMS, TFRs, Special Use Airspace, Airspace Boundaries, Military Bases, Aircraft — each row's switch wired to that layer's existing `*Visible`/`handle*Toggle` pair already in `MapView.tsx` (no new toggle logic).
- [ ] 8.2 Location group: rows for Transponder Location (`userLocationVisible`/`handleUserLocationToggle`, now marker-only per task 6), Actual Range Outline (`rangeOutlineVisible`/`handleRangeOutlineToggle`), Terrain-Based Range Outline (`terrainOutlineVisible`/`handleTerrainOutlineToggle`), Range Rings (`rangeRingsVisible`/`handleRangeRingsToggle`, new from task 6).
- [ ] 8.3 Environmental group: nested "Weather" `AccordionGroup` containing RainViewer (`rainViewerVisible`/`handleRainViewerToggle`), NEXRAD (`nexradVisible`/`handleNexradToggle`), NOAA Radar (`noaaRadarVisible`/`handleNoaaRadarToggle`), DWD RADOLAN (`dwdRadolanVisible`/`handleDwdRadolanToggle`), NOAA Infrared (`noaaInfraredVisible`/`handleNoaaInfraredToggle`); plus a Day/Night Terminator row (`terminatorVisible`/`handleTerminatorToggle`); plus a disabled Wildfires placeholder row.
- [ ] 8.4 View-controls row (non-accordion, top of drawer body): Follow Selected Aircraft (`followSelectedAircraft`/`handleFollowSelectedAircraftToggle`) and My Location (`handleJumpToLocation`).
- [ ] 8.5 Manually verify every relocated toggle still controls the exact same map layer it did before this change (no regressions from the JSX move).

## 9. Plane listing panel: data and columns

- [ ] 9.1 Add `components/map/drawer/columns.ts`: `COLUMNS` array (key, label, `def` default-visible flag, `align`, `sortable`) for all 26 columns per the acceptance criteria, with XP/Registrations/Flight Time marked `def: false` and a comment noting they're stubbed for now pending a follow-up change (design.md Decision 6).
- [ ] 9.2 Add `components/map/drawer/aircraftDisplay.ts`: given an `Aircraft` and `siteLocation`, produce a fully-derived display row (adds `distanceNm` via `@turf/turf`'s `distance()`, `countryCode` via `registrationCountry.ts`, `rarityTier`/`rarityValue` via `aircraftRarity.ts`, `airlineName` via `airlineLookup.ts`); `route` is resolved separately via `getCachedFlightRoute()` from task 2, not baked into this pure builder.
- [ ] 9.3 Add `formatCell(row, columnKey)` in `columns.ts` (or a sibling module) covering every column's display formatting (units, empty-state dashes, flag image tag, rarity badge styling reusing `RARITY_TIER_STYLES`).

## 10. Plane listing panel: search, filters, columns tabs

- [ ] 10.1 Add `components/map/drawer/PlaneListingPanel.tsx` + `.module.css`: owns its own `fetchAircraft()` poll (`setInterval`, `AIRCRAFT_FEED_REFRESH_INTERVAL_MS`), started on mount / cleared on unmount (only mounted while the drawer is open, per design.md Decision 8).
- [ ] 10.2 Implement the tab nav (Search / Filters / Columns), each tab's panel visible/hidden via a `hidden` attribute, matching the reference file's `.tabnav`/`.tabpanel` structure.
- [ ] 10.3 Search tab: text input filtering the row set by callsign, registration, and hex ID (case-insensitive substring match).
- [ ] 10.4 Filters tab: at minimum altitude range and distance range numeric filters, plus a military-only filter (using the new `isMilitary` field from task 1).
- [ ] 10.5 Columns tab: checkboxes for every `COLUMNS` entry, toggling visibility; "reset to defaults" and "show all" actions; persist the current visible-column set to `localStorage` under a new key (mirroring `theme.ts`'s `THEME_STORAGE_KEY` pattern), restored on mount.
- [ ] 10.6 Route/Airline resolution: for each row needing a route, call `getCachedFlightRoute()` (task 2) — no per-row-per-poll re-fetch of an already-cached key, and no additional throttling beyond that shared cache (design.md Decision 9); derive Airline synchronously via `airlineLookup.ts` (no network call).

## 11. Plane listing panel: sortable table

- [ ] 11.1 Add `components/map/drawer/PlaneTable.tsx` + `.module.css`: renders `<thead>`/`<tbody>` from the currently-visible columns and currently-filtered/sorted rows, matching the reference file's sort-indicator/sticky-header styling.
- [ ] 11.2 Implement click-to-sort on column headers: first click on a new column sorts ascending, clicking the active sort column again reverses to descending, per `plane-listing-panel`'s spec.
- [ ] 11.3 Empty state: render a single "no aircraft match" (or "no aircraft tracked") row spanning all visible columns when the filtered row set is empty.
- [ ] 11.4 Row count / status line ("Showing N of M aircraft") above or below the table, matching the reference file's `.table-status`.

## 12. Verification

- [ ] 12.1 Manually verify the top-right cluster now shows exactly the day/night slider, pilot-mode control, and drawer-toggle button — no other buttons remain outside the drawer.
- [ ] 12.2 Manually verify opening/closing the drawer does not change the map's view or any layer's visibility state.
- [ ] 12.3 Manually verify every accordion row (Aviation, Location, Environmental incl. nested Weather, disabled Wildfires) toggles the correct, same-as-before map layer.
- [ ] 12.4 Manually verify Transponder Location and Range Rings toggle independently of each other, including across a theme switch.
- [ ] 12.5 Manually verify the plane listing table populates from a real or simulated feeder, search/filters narrow the row set, columns tab shows/hides columns and persists across a reload, and every sortable column header sorts ascending then descending on repeated clicks.
- [ ] 12.6 Manually verify XP/Registrations/Flight Time render as a placeholder dash and are excluded from the default column set.
- [ ] 12.7 Manually verify Route/Airline lookups: Airline resolves instantly with no network call; selecting an aircraft on the map (`AircraftOverlay`) and seeing its route listed in the table for the same callsign do not trigger two separate `adsb.im` requests — confirm the cache is shared (verify via browser network tab), and that no artificial delay/staggering was introduced versus today's behavior.
- [ ] 12.8 Manually verify the drawer/table on a narrow/mobile viewport per the reference file's mobile breakpoint behavior.
- [ ] 12.9 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean.

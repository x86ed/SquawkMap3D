## 1. Aircraft data model extensions

- [ ] 1.1 In `components/map/aircraft.ts`'s `RawAircraftJson`, add `messages?: number`, `rssi?: number`, `type?: string`, `dbFlags?: number`, `wd?: number`, `ws?: number` to the raw shape (readsb's own field names).
- [ ] 1.2 In `Aircraft`, add `messages?: number`, `rssi?: number`, `sourceType?: string` (avoids clashing with the `type` keyword, same convention as `typeDesignator`), `isMilitary?: boolean`, `windDirection?: number`, `windSpeed?: number`, each with a doc comment citing the raw readsb field name.
- [ ] 1.3 In `normalize()`, map `raw.messages` → `messages`, `raw.rssi` → `rssi`, `raw.type` → `sourceType`, `(raw.dbFlags ?? 0) & 1` → `isMilitary` (boolean), `raw.wd` → `windDirection`, `raw.ws` → `windSpeed`.
- [ ] 1.4 Add/update unit tests for `normalize()` covering the new fields present, absent, and `dbFlags` bit-flag edge cases (0, 1, other bits set without bit 0).

## 2. Registration-country and airline-designator lookups

- [ ] 2.1 Add `components/map/registrationCountry.ts` exporting `countryCodeForRegistration(registration: string | undefined): string | null`, using a vendored tail-number-prefix → ISO country code table (`components/map/data/registrationPrefixes.json`), returning `null` for no match or no registration.
- [ ] 2.2 Add `components/map/data/airlineDesignators.json`, a vendored ICAO 3-letter callsign-prefix → airline-name table (source a suitable public dataset; document the source in a comment/README note near the file, same convention as `aircraftRareness.json`'s sourcing comment in `aircraftRarity.ts`).
- [ ] 2.3 Add `components/map/airlineLookup.ts` exporting `airlineNameForCallsign(callsign: string | undefined): string | null` — extracts the leading alphabetic prefix and looks it up in 2.2's table, returning `null` for no match.
- [ ] 2.4 Add unit tests for both lookups: known prefix, unknown prefix, missing/empty input.

## 3. Drawer shell and top-right cluster

- [ ] 3.1 Add `components/map/drawer/ThemeSlider.tsx` + `.module.css`: a slider control with day/night (sun/moon) symbols, receiving `theme`/`onToggle` props, replacing the current theme `<button>`'s markup (same `handleThemeToggle` call site in `MapView.tsx`).
- [ ] 3.2 Add `components/map/drawer/LayerDrawer.tsx` + `.module.css`: drawer shell (header with title + close button, scrollable body), `open`/`onClose` props, `transform: translateX` slide animation matching the reference file's `.drawer`/`.drawer.open` behavior.
- [ ] 3.3 In `MapView.tsx`: add `drawerOpenRef`/`[drawerOpen, setDrawerOpen]` state and a `handleDrawerToggle` handler.
- [ ] 3.4 In `MapView.tsx`'s render: replace the `.controls` button stack with a 3-item top-right cluster — `<ThemeSlider>`, the existing pilot-mode button (re-skinned to match, same `handlePilotModeToggle`), and a drawer-toggle button (`handleDrawerToggle`) — plus mount `<LayerDrawer open={drawerOpen} onClose={...}>` containing everything from tasks 4-8 below.
- [ ] 3.5 Update `MapView.module.css`: shrink `.controls` to the 3-item cluster's layout; remove now-unused per-button styles that move to the drawer's own CSS modules.
- [ ] 3.6 Confirm `ColorModeLegendDock`'s `right: 210px` offset (sized to clear the old button column) is revisited — it should clear the new, much narrower 3-item cluster instead; adjust the constant/comment in `ColorModeLegendDock.module.css` accordingly.

## 4. Accordion primitive

- [ ] 4.1 Add `components/map/drawer/Accordion.tsx` + `.module.css`: a generic `AccordionGroup` (header with icon/title/description/count + chevron, collapsible body) and `LayerToggleRow`/`Switch` primitives, matching the reference file's `.accordion-group`/`.acc-btn`/`.layer-row`/`.switch` structure, reusable for nested groups (Decision 4 in design.md).
- [ ] 4.2 `AccordionGroup` supports a `disabled` row variant (no-op switch, dimmed styling) for the Wildfires placeholder.
- [ ] 4.3 `AccordionGroup` supports recursive nesting (a row that is itself another `AccordionGroup`) for the Weather sub-disclosure.

## 5. Location toggle split (range rings)

- [ ] 5.1 In `components/map/userLocation.ts`: replace `setUserLocationVisibility` with `setUserLocationMarkerVisibility(map, visible)` (sets only `USER_LOCATION_ICON_LAYER_ID`) and `setRangeRingsVisibility(map, visible)` (sets only `USER_RINGS_LINE_LAYER_ID` and `USER_RINGS_LABEL_LAYER_ID`), updating both functions' doc comments to describe independent visibility rather than the old combined behavior.
- [ ] 5.2 In `MapView.tsx`: add `rangeRingsVisibleRef`/`[rangeRingsVisible, setRangeRingsVisible]` (default `true`, matching the existing default) and a `handleRangeRingsToggle` handler calling `setRangeRingsVisibility`.
- [ ] 5.3 In `MapView.tsx`: update every call site that used `setUserLocationVisibility(map, userLocationVisibleRef.current)` to call both `setUserLocationMarkerVisibility(map, userLocationVisibleRef.current)` and `setRangeRingsVisibility(map, rangeRingsVisibleRef.current)` (style-load re-add, jump-to-location resolution, etc.).
- [ ] 5.4 Update/add unit or integration coverage confirming the two toggles are independent (toggling one doesn't change the other's layer visibility).

## 6. Location for Distance column

- [ ] 6.1 In `MapView.tsx`: add `const [siteLocation, setSiteLocation] = useState<GeoCoords | null>(null)`, set alongside the existing `userLocationRef.current = coords` assignment, so it mirrors the resolved transponder/feeder location (with its existing browser-geolocation fallback).
- [ ] 6.2 Pass `siteLocation` down as a prop into `LayerDrawer` → `PlaneListingPanel`.

## 7. Layer-control accordion wiring

- [ ] 7.1 Aviation group: `AccordionGroup` rows for Airports, OpenAIP TMS, TFRs, Special Use Airspace, Airspace Boundaries, Military Bases, Aircraft — each row's switch wired to that layer's existing `*Visible`/`handle*Toggle` pair already in `MapView.tsx` (no new toggle logic).
- [ ] 7.2 Location group: rows for Transponder Location (`userLocationVisible`/`handleUserLocationToggle`, now marker-only per task 5), Actual Range Outline (`rangeOutlineVisible`/`handleRangeOutlineToggle`), Terrain-Based Range Outline (`terrainOutlineVisible`/`handleTerrainOutlineToggle`), Range Rings (`rangeRingsVisible`/`handleRangeRingsToggle`, new from task 5).
- [ ] 7.3 Environmental group: nested "Weather" `AccordionGroup` containing RainViewer (`rainViewerVisible`/`handleRainViewerToggle`), NEXRAD (`nexradVisible`/`handleNexradToggle`), NOAA Radar (`noaaRadarVisible`/`handleNoaaRadarToggle`), DWD RADOLAN (`dwdRadolanVisible`/`handleDwdRadolanToggle`), NOAA Infrared (`noaaInfraredVisible`/`handleNoaaInfraredToggle`); plus a Day/Night Terminator row (`terminatorVisible`/`handleTerminatorToggle`); plus a disabled Wildfires placeholder row.
- [ ] 7.4 View-controls row (non-accordion, top of drawer body): Follow Selected Aircraft (`followSelectedAircraft`/`handleFollowSelectedAircraftToggle`) and My Location (`handleJumpToLocation`).
- [ ] 7.5 Manually verify every relocated toggle still controls the exact same map layer it did before this change (no regressions from the JSX move).

## 8. Plane listing panel: data and columns

- [ ] 8.1 Add `components/map/drawer/columns.ts`: `COLUMNS` array (key, label, `def` default-visible flag, `align`, `sortable`) for all 26 columns per the acceptance criteria, with XP/Registrations/Flight Time marked `def: false` (Decision 6/9 in design.md).
- [ ] 8.2 Add `components/map/drawer/aircraftDisplay.ts`: given an `Aircraft`, `siteLocation`, a route cache, and the rarity/flag/airline lookups, produce a fully-derived display row (adds `distanceNm` via `@turf/turf`'s `distance()`, `countryCode` via `registrationCountry.ts`, `rarityTier`/`rarityValue` via `aircraftRarity.ts`, `airlineName` via `airlineLookup.ts`, `route` via the cache from task 9).
- [ ] 8.3 Add `formatCell(row, columnKey)` in `columns.ts` (or a sibling module) covering every column's display formatting (units, empty-state dashes, flag image tag, rarity badge styling reusing `RARITY_TIER_STYLES`).

## 9. Plane listing panel: search, filters, columns tabs

- [ ] 9.1 Add `components/map/drawer/PlaneListingPanel.tsx` + `.module.css`: owns its own `fetchAircraft()` poll (`setInterval`, `AIRCRAFT_FEED_REFRESH_INTERVAL_MS`), started on mount / cleared on unmount (only mounted while the drawer is open, per design.md Decision 8).
- [ ] 9.2 Implement the tab nav (Search / Filters / Columns), each tab's panel visible/hidden via a `hidden` attribute, matching the reference file's `.tabnav`/`.tabpanel` structure.
- [ ] 9.3 Search tab: text input filtering the row set by callsign, registration, and hex ID (case-insensitive substring match).
- [ ] 9.4 Filters tab: at minimum altitude range and distance range numeric filters, plus a military-only filter (using the new `isMilitary` field from task 1).
- [ ] 9.5 Columns tab: checkboxes for every `COLUMNS` entry, toggling visibility; "reset to defaults" and "show all" actions; persist the current visible-column set to `localStorage` under a new key (mirroring `theme.ts`'s `THEME_STORAGE_KEY` pattern), restored on mount.
- [ ] 9.6 Route/Airline resolution: maintain a component-local `Map<callsign, FlightRoute | null>` cache; call `getFlightRoute()` at most once per distinct callsign (design.md Decision 9); derive Airline synchronously via `airlineLookup.ts` (no network call).

## 10. Plane listing panel: sortable table

- [ ] 10.1 Add `components/map/drawer/PlaneTable.tsx` + `.module.css`: renders `<thead>`/`<tbody>` from the currently-visible columns and currently-filtered/sorted rows, matching the reference file's sort-indicator/sticky-header styling.
- [ ] 10.2 Implement click-to-sort on column headers: first click on a new column sorts ascending, clicking the active sort column again reverses to descending, per `plane-listing-panel`'s spec.
- [ ] 10.3 Empty state: render a single "no aircraft match" (or "no aircraft tracked") row spanning all visible columns when the filtered row set is empty.
- [ ] 10.4 Row count / status line ("Showing N of M aircraft") above or below the table, matching the reference file's `.table-status`.

## 11. Verification

- [ ] 11.1 Manually verify the top-right cluster now shows exactly the day/night slider, pilot-mode control, and drawer-toggle button — no other buttons remain outside the drawer.
- [ ] 11.2 Manually verify opening/closing the drawer does not change the map's view or any layer's visibility state.
- [ ] 11.3 Manually verify every accordion row (Aviation, Location, Environmental incl. nested Weather, disabled Wildfires) toggles the correct, same-as-before map layer.
- [ ] 11.4 Manually verify Transponder Location and Range Rings toggle independently of each other, including across a theme switch.
- [ ] 11.5 Manually verify the plane listing table populates from a real or simulated feeder, search/filters narrow the row set, columns tab shows/hides columns and persists across a reload, and every sortable column header sorts ascending then descending on repeated clicks.
- [ ] 11.6 Manually verify XP/Registrations/Flight Time render as a placeholder dash and are excluded from the default column set.
- [ ] 11.7 Manually verify Route/Airline lookups: Airline resolves instantly with no network call; Route makes at most one `adsb.im` request per distinct callsign across repeated poll refreshes (verify via browser network tab).
- [ ] 11.8 Manually verify the drawer/table on a narrow/mobile viewport per the reference file's mobile breakpoint behavior.
- [ ] 11.9 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean.

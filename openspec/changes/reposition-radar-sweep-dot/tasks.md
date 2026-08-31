## 1. Radar-sweep dot/label ground-plane position

- [ ] 1.1 In `components/map/radarSweep.ts`, change the `dotLayer` (`ScatterplotLayer`, `RANGE_OUTLINE_AIRCRAFT_DOT_LAYER_ID`) `getPosition` from `(d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)]` to `(d) => [d.lon, d.lat, 0]`
- [ ] 1.2 In `components/map/radarSweep.ts`, change the `labelLayer` (`TextLayer`, `RANGE_OUTLINE_AIRCRAFT_LABEL_LAYER_ID`) `getPosition` the same way, to `(d) => [d.lon, d.lat, 0]`
- [ ] 1.3 Remove the now-unused `altitudeToRenderMeters` import from `radarSweep.ts` if nothing else in the file still calls it (confirm via a search of the file before removing)
- [ ] 1.4 Update the doc comment above `buildRangeOutlineSweepLayers()` (currently says dots/labels are "positioned at real `[lon, lat, altitude]` like `aircraftLayer.ts`'s icons") to reflect the new ground-plane positioning and note this is a deliberate divergence from the aircraft-icons layer's own altitude-based positioning (see design.md Decision 1 / Risk on this)

## 2. Shared radius-to-bounds helper

- [ ] 2.1 In `components/map/userLocation.ts`, extract `getUserLocationBounds()`'s bbox math into a new exported `getBoundsForRadiusNM(center: [number, number], radiusNM: number): [[number, number], [number, number]]`
- [ ] 2.2 Reimplement `getUserLocationBounds(coords)` as a thin wrapper calling `getBoundsForRadiusNM([coords.longitude, coords.latitude], Math.max(...RANGE_RING_RADII_NM))`, preserving its existing exported signature and behavior exactly (verify its 3 existing call sites in `MapView.tsx` — the satellite-icon click handler, the initial `resolveUserLocation().then(...)` block, and `handleJumpToLocation` — are unaffected before task 3 changes one of them)
- [ ] 2.3 Add `INITIAL_ZOOM_RADIUS_NM = 60` to `components/map/constants.ts`, near `RANGE_RING_RADII_NM`, with a comment noting it's the first-load-only zoom radius (see design.md Decision 2)

## 3. First-load zoom

- [ ] 3.1 In `components/map/MapView.tsx`'s map-init effect, replace the `MapLibreMap` constructor's `center: DEFAULT_VIEW.center` / `zoom: DEFAULT_VIEW.zoom` options with a `bounds: getBoundsForRadiusNM(DEFAULT_VIEW.center, INITIAL_ZOOM_RADIUS_NM)` option (MapLibre's `MapOptions.bounds`, a constructor-time alternative to `center`/`zoom`), keeping `pitch`/`maxPitch`/`bearing` unchanged
- [ ] 3.2 In the same effect's `resolveUserLocation().then((coords) => { ... })` block (the initial-load geolocation resolution, not `handleJumpToLocation`), change `mapRef.current.fitBounds(getUserLocationBounds(coords), { padding: 40 })` to `mapRef.current.fitBounds(getBoundsForRadiusNM([coords.longitude, coords.latitude], INITIAL_ZOOM_RADIUS_NM), { padding: 40 })`
- [ ] 3.3 Confirm `handleJumpToLocation` (~line 1112) and the satellite-icon click handler (~line 771) are left unchanged, still calling `getUserLocationBounds(coords)` / `getUserLocationBounds(userLocationRef.current)` respectively
- [ ] 3.4 Remove or repurpose the now-fully-unused `DEFAULT_VIEW.zoom` field and the already-unused `GEOLOCATION_ZOOM` constant in `constants.ts` only if confirmed unused elsewhere in the codebase (search before removing); otherwise leave them and note in a comment that they're superseded by `INITIAL_ZOOM_RADIUS_NM` for the initial-load path

## 4. Verification

- [ ] 4.1 Manually verify the actual range outline layer's aircraft dots and hex labels render at ground level (visually flush with the sweep wedge/terrain, not floating above it) for aircraft at cruise altitude, at both the default pitch (60°) and a steeper pitch (up to 85°)
- [ ] 4.2 Manually verify the separate aircraft-icons layer (`aircraft-tracks-layer`) still renders its icons/tracks at real altitude, unaffected by this change
- [ ] 4.3 Manually verify a fresh page load (geolocation denied/unavailable, e.g. via browser permission block) shows an initial view spanning approximately 60 NM around the continental-US default center, not the previous zoom-4 whole-country view
- [ ] 4.4 Manually verify a fresh page load with geolocation permission granted shows an initial view spanning approximately 60 NM around the resolved user location, not the previous ~200 NM range-ring-fit view
- [ ] 4.5 Manually verify the "jump to my location" control and clicking the satellite-icon marker still recenter to the wider ~200 NM (outermost range ring) view, unchanged from current behavior
- [ ] 4.6 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

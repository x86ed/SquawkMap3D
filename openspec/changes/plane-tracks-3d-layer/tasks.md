## 1. Setup

- [ ] 1.1 Add `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox` to `package.json` dependencies
- [ ] 1.2 Add `NEXT_PUBLIC_FEEDER_URL` to `.env.example` with a comment explaining it points at a tar1090/readsb-compatible `aircraft.json` endpoint, optional, layer no-ops when unset
- [ ] 1.3 Confirm the feeder `aircraft.json` field names against a real or sample feeder response (hex, `flight`, `lat`, `lon`, `alt_baro`, `alt_geom`, `gs`, `track`, `baro_rate`, `squawk`, `category`, `t`) and note the confirmed shape in code comments where the aircraft type is defined

## 2. Vendored icon assets

- [ ] 2.1 Vendor `AircraftShapesSVG`'s `Shapes SVG/*.svg` files into `public/aircraft-shapes/`, including its `LICENSE` (GPL-3.0)
- [ ] 2.2 Vendor `pw-silhouettes`' `generics/*.svg` files into `public/aircraft-silhouettes/generics/`, including its `LICENSE` (CC BY-NC-SA 4.0)
- [ ] 2.3 Add attribution for both asset sets (source repo, license) to the project README
- [ ] 2.4 In `components/map/constants.ts`: add a static ADS-B emitter category (`A0`-`D7`) → pw-silhouettes generic-group name lookup table

## 3. Aircraft data module

- [ ] 3.1 Add `components/map/aircraft.ts` defining the normalized `Aircraft` type (hex, callsign, lat, lon, altitude, groundSpeed, track/heading, verticalRate, squawk, category, typeDesignator) and `fetchAircraft(): Promise<Aircraft[]>` — fetches `NEXT_PUBLIC_FEEDER_URL`'s `aircraft.json`, wraps in try/catch, returns `[]` on any failure, missing config, or non-OK response (mirrors `tfr.ts`/`specialUseAirspace.ts`)
- [ ] 3.2 In `aircraft.ts`, add an in-memory per-hex track buffer (`Map<string, TrackPoint[]>`) with an `updateTracks(aircraft: Aircraft[]): void` that appends each aircraft's current position and prunes points beyond `AIRCRAFT_TRACK_MAX_POINTS`/retention window, and drops tracks for hexes no longer present in the latest fetch
- [ ] 3.3 Add `AIRCRAFT_FEED_REFRESH_INTERVAL_MS` (1000) and `AIRCRAFT_TRACK_MAX_POINTS` (or equivalent time-window constant) to `components/map/constants.ts`

## 4. Icon resolution

- [ ] 4.1 Add `components/map/aircraftIcons.ts` with `resolveIconKey(aircraft: Aircraft): { source: "type" | "category" | "generic"; key: string }` implementing the type-designator → category-generic → plain-marker fallback chain from the design
- [ ] 4.2 In `aircraftIcons.ts`, build a deck.gl `IconLayer` icon-atlas (atlas image + mapping) once from the vendored SVGs (type shapes + category generics + one plain-marker fallback), not per-frame/per-aircraft
- [ ] 4.3 Add an altitude-to-color interpolation helper (cyan-low to gold-high, matching aeris) usable for both the icon tint and the track trail color

## 5. Deck.gl overlay integration

- [ ] 5.1 In `components/map/layers.ts` (or a new `components/map/aircraftLayer.ts`), add a function that builds/updates the deck.gl `IconLayer` (aircraft positions, oriented by `track`, elevation = altitude, colored by altitude) and `PathLayer` (per-aircraft track trail, elevation per vertex, colored by altitude) from the current aircraft + track-buffer state
- [ ] 5.2 In `MapView.tsx`, mount a `MapboxOverlay` (from `@deck.gl/mapbox`, `interleaved: true`) via `map.addControl()` once on map init — dynamically imported client-side only, consistent with the existing MapLibre client-only pattern — and note in a comment that, unlike the style-owned custom layers, this overlay is NOT re-added on `style.load`
- [ ] 5.3 Add `aircraftVisibleRef` / `aircraftVisible` state in `MapView.tsx`, following the existing visibility ref/state pair pattern
- [ ] 5.4 Add a polling effect using `AIRCRAFT_FEED_REFRESH_INTERVAL_MS` that calls `fetchAircraft()` + `updateTracks()` and pushes updated `IconLayer`/`PathLayer` props into the overlay via `setProps()` — only runs while the aircraft layer is enabled, cleared on toggle-off/unmount
- [ ] 5.5 Add the toggle handler and a toggle button in the existing toggle row, labeled e.g. "Hide aircraft" / "Show aircraft", defaulting to visible/on when `NEXT_PUBLIC_FEEDER_URL` is set

## 6. Verification

- [ ] 6.1 Manually verify aircraft render at 3D-elevated positions over terrain, oriented to their reported track, against a real or simulated feeder
- [ ] 6.2 Manually verify icon fallback chain: an aircraft with a known type designator shows its specific shape; spoof/force an unknown type designator with a valid category and confirm the generic silhouette renders; spoof both missing and confirm the plain marker renders
- [ ] 6.3 Manually verify a track trail builds and grows over several poll intervals for a given aircraft, colored by altitude along its length
- [ ] 6.4 Manually verify the aircraft layer toggles independently on/off, and that toggling off stops the polling/refresh loop
- [ ] 6.5 Manually verify the aircraft layer survives a theme switch (light/dark) and pilot-mode toggle without needing to be manually re-enabled
- [ ] 6.6 Manually verify graceful behavior when `NEXT_PUBLIC_FEEDER_URL` is unset (layer no-ops, no console errors) and when it's set but unreachable (simulate via devtools network blocking)
- [ ] 6.7 Confirm the vendored icon assets under `public/aircraft-shapes/` and `public/aircraft-silhouettes/` retain their original LICENSE files, and no feed-derived aircraft data is vendored/committed anywhere
- [ ] 6.8 Run `npm run lint`, `npm test`, and `npx tsc --noEmit`

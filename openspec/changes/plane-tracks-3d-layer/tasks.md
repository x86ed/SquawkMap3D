## 1. Setup

- [x] 1.1 Add `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` to `package.json` dependencies — **`@deck.gl/geo-layers` dropped**: `IconLayer`/`PathLayer` (from `@deck.gl/layers`) turned out sufficient; the per-vertex altitude-colored trail is built as per-segment `PathLayer` data (see `aircraftLayer.ts`) rather than needing `@deck.gl/geo-layers`'s `TripsLayer`
- [x] 1.2 Add `NEXT_PUBLIC_FEEDER_URL` to `.env.example` with a comment explaining it points at a tar1090/readsb-compatible `aircraft.json` endpoint, optional, layer no-ops when unset
- [x] 1.3 Confirm the feeder `aircraft.json` field names — confirmed against readsb's own field reference (hex, flight, lat/lon, alt_baro [number or "ground"], alt_geom, gs, track, baro_rate, squawk, category A0-D7, `t` type designator [only populated when the feeder loads a tar1090-db aircraft.csv.gz]); all fields optional/omittable. User's real feeder deferred to e2e testing session. Noted in `aircraft.ts`

## 2. Vendored icon assets

- [x] 2.1 Vendor `AircraftShapesSVG`'s `Shapes SVG/*.svg` files into `public/aircraft-shapes/`, including its `LICENSE` (GPL-3.0) — done via `scripts/vendor-aircraft-icons.mjs`, all 182 files, pinned to commit `0743718`
- [x] 2.2 Vendor pw-silhouettes fallback icons into `public/aircraft-silhouettes/`, including its `LICENSE` (CC BY-NC-SA 4.0) — **correction from the original task wording**: pw-silhouettes has no `generics/*.svg` directory; `generics/*.json` are category→`aliasOf` mapping metadata pointing into the repo's `silhouettes/` dir of per-airframe SVGs. Resolved all 15 category mappings by hand (see script comments) and vendored just those 15 SVGs, renamed to their ADS-B category code (`A1.svg`..`C2.svg`), pinned to commit `c3818c2`
- [x] 2.3 Add attribution for both asset sets (source repo, license) to the project README
- [x] 2.4 In `components/map/constants.ts`: add a static ADS-B emitter category (`A0`-`D7`) → pw-silhouettes generic-group name lookup table

## 3. Aircraft data module

- [x] 3.1 Add `components/map/aircraft.ts` defining the normalized `Aircraft` type (hex, callsign, lat, lon, altitude, groundSpeed, track/heading, verticalRate, squawk, category, typeDesignator) and `fetchAircraft(): Promise<Aircraft[]>` — fetches `NEXT_PUBLIC_FEEDER_URL`'s `aircraft.json`, wraps in try/catch, returns `[]` on any failure, missing config, or non-OK response (mirrors `tfr.ts`/`specialUseAirspace.ts`)
- [x] 3.2 In `aircraft.ts`, add an in-memory per-hex track buffer (`Map<string, TrackPoint[]>`) with `updateTracks(aircraft: Aircraft[]): void` that appends each aircraft's current position and prunes points beyond the retention window, and drops tracks for hexes no longer present in the latest fetch; also added `getTrack`/`getAllTracks`/`clearTracks` accessors for the render layer
- [x] 3.3 Add `AIRCRAFT_FEED_REFRESH_INTERVAL_MS` (1000) and `AIRCRAFT_TRACK_RETENTION_MS` (time-window, 10 min) to `components/map/constants.ts`

## 4. Icon resolution

- [x] 4.1 Add `components/map/aircraftIcons.ts` with `resolveIconKey(aircraft: Aircraft): { source: "type" | "category" | "generic"; key: string }` implementing the type-designator → category-generic → plain-marker fallback chain from the design
- [x] 4.2 In `aircraftIcons.ts`, build a deck.gl `IconLayer` icon-atlas (atlas image + mapping) once from the vendored SVGs (type shapes + category generics + one plain-marker fallback), not per-frame/per-aircraft — `buildAircraftIconAtlas()`, grid-packed canvas, driven by the `manifest.json` the vendor script writes
- [x] 4.3 Add an altitude-to-color interpolation helper (cyan-low to gold-high, matching aeris) usable for both the icon tint and the track trail color — `altitudeToColor()`

## 5. Deck.gl overlay integration

- [x] 5.1 Add `components/map/aircraftLayer.ts` with `buildAircraftLayers()` building the deck.gl `IconLayer` (aircraft positions, oriented by `track`, elevation = altitude, colored by altitude) and `PathLayer` (per-segment track trail, colored by altitude) from the current aircraft + track-buffer state
- [x] 5.2 In `MapView.tsx`, mount a `MapboxOverlay` (from `@deck.gl/mapbox`) via `map.addControl()` once on map init — statically imported at module top (matching how `maplibre-gl` itself is imported in this file; the whole component is client-only via `"use client"` + effect-gated instantiation, not a `dynamic(..., {ssr:false})` wrapper), instantiated inside the mount effect — with a comment noting it's NOT re-added on `style.load`, unlike the style-owned custom layers. **`interleaved: false`, not `true` as originally planned**: live testing showed `interleaved: true` crashes the render loop (blank map) against this deck.gl/MapLibre version pairing — see design.md Decision 1's correction and its new Risk entry
- [x] 5.3 Add `aircraftVisibleRef` / `aircraftVisible` state in `MapView.tsx`, following the existing visibility ref/state pair pattern
- [x] 5.4 Add a polling effect using `AIRCRAFT_FEED_REFRESH_INTERVAL_MS` that calls `fetchAircraft()` + `updateTracks()` and pushes updated `IconLayer`/`PathLayer` props into the overlay via `setProps()` — only runs while the aircraft layer is enabled, cleared on toggle-off/unmount
- [x] 5.5 Add the toggle handler and a toggle button in the existing toggle row, labeled "Hide aircraft" / "Show aircraft" — **default**: always visible/on like every other layer's toggle (matches the codebase convention, e.g. OpenAIP defaults on even without an API key); absence of `NEXT_PUBLIC_FEEDER_URL` makes `fetchAircraft()` a no-op ([] aircraft) rather than gating the toggle itself

## 6. Verification

- [ ] 6.1 Manually verify aircraft render at 3D-elevated positions over terrain, oriented to their reported track, against a real or simulated feeder — **deferred**: user's feeder is set up but real-data e2e testing is a separate session (per user)
- [ ] 6.2 Manually verify icon fallback chain: an aircraft with a known type designator shows its specific shape; spoof/force an unknown type designator with a valid category and confirm the generic silhouette renders; spoof both missing and confirm the plain marker renders — **deferred to e2e session**
- [ ] 6.3 Manually verify a track trail builds and grows over several poll intervals for a given aircraft, colored by altitude along its length — **deferred to e2e session**
- [x] 6.4 Manually verify the aircraft layer toggles independently on/off — confirmed live (Chrome, `npm run dev`): clicking "Hide aircraft"/"Show aircraft" toggles the label and doesn't affect any other layer or the base map
- [x] 6.5 Manually verify the aircraft layer survives a theme switch (light/dark) and pilot-mode toggle without needing to be manually re-enabled — confirmed live: toggled dark mode then pilot mode with the aircraft layer on; "Hide aircraft" stayed showing (still enabled) through both `setStyle` swaps, exactly as design.md Decision 2 intends
- [x] 6.6 Manually verify graceful behavior when `NEXT_PUBLIC_FEEDER_URL` is unset — confirmed live: `.env.local` has no feeder URL, app loads and runs with no errors from `fetchAircraft`/the aircraft layer itself. Note: the console does log a repeating caught exception from the unrelated deck.gl/MapLibre terrain incompatibility (see design.md's new Risk entry) — not from the no-feeder path, and not fatal, but it means "no console errors at all" isn't literally true; flagging rather than silently checking past it. Feeder-unreachable case (network-blocked) deferred to e2e session
- [x] 6.7 Confirm the vendored icon assets under `public/aircraft-shapes/` and `public/aircraft-silhouettes/` retain their original LICENSE files, and no feed-derived aircraft data is vendored/committed anywhere — both `LICENSE` files present; `git status` shows only the vendored asset directories and code, no aircraft.json or similar
- [x] 6.8 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — all clean (lint: no errors; test: 7/7 pass; tsc: no errors)

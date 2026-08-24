## Why

SquawkMap3D has no live aircraft data at all — every existing layer is static or slow-refresh airspace/weather context (boundaries, TFRs, radar). The app's whole premise is an ADS-B map, so it needs the actual planes: live positions pulled from the user's own ADS-B feeder, drawn as 3D-positioned aircraft with recent flight tracks, using recognizable per-type aircraft shapes instead of generic dots.

## What Changes

- Add an **Aircraft Tracks** layer: live aircraft positions polled from a user-configured feeder endpoint serving a tar1090/readsb-compatible `aircraft.json` (hex, flight, lat/lon, `alt_baro`/`alt_geom`, `gs`, `track`, `baro_rate`, `squawk`, `category`, `t` type designator) — the same schema tar1090 itself consumes from readsb/dump1090-fa, giving parity with that project's data model without requiring readsb's optional `--write-globe-history` trace files.
- Aircraft are rendered as a **deck.gl overlay** (`@deck.gl/mapbox` interleaved with the existing MapLibre map) rather than plain MapLibre symbol layers, because MapLibre's stock layer types drape features onto the ground/terrain surface and can't place a marker at an arbitrary barometric altitude in 3D space. Deck.gl's `IconLayer`/`PathLayer` support per-feature elevation, which is what makes an aeris-style "planes floating over the terrain at their real altitude, colored by altitude, trailing a flight path" view possible.
- Each aircraft icon is resolved by ICAO type designator (`t` field, e.g. `A320`, `B738`) against a vendored copy of `AircraftShapesSVG`'s top-down shapes. When no shape matches the type designator, fall back to `pw-silhouettes`' generic silhouettes, keyed by mapping the ADS-B emitter `category` code (e.g. `A5` → heavy, `A7` → rotorcraft, `B2` → lighter-than-air) to that repo's `generics/` group. If neither resolves, fall back to a plain rotated dot/triangle so an aircraft is never invisible for lack of an icon.
- Flight tracks are accumulated client-side from successive polls for the current session (no server-side trace-file dependency) and rendered as altitude-colored, elevation-extruded path trails, matching aeris's "low altitude cyan, high altitude gold" treatment.
- The layer follows the existing toggle pattern used by other layers (visibility ref/state pair, toggle button in `MapView.tsx`), and is registered in `CUSTOM_LAYER_IDS`-equivalent bookkeeping so it survives theme and pilot-mode style swaps.
- New env var `NEXT_PUBLIC_FEEDER_URL` (feeder base URL) — like `NEXT_PUBLIC_OPENAIP_API_KEY`, the layer is a no-op (empty feed) when unset instead of erroring, since not every user runs a feeder.

## Capabilities

### New Capabilities
- `aircraft-tracks-layer`: live aircraft positions and recent flight tracks pulled from a user's ADS-B feeder (tar1090/readsb `aircraft.json` parity), rendered as a toggleable 3D deck.gl overlay with per-type aircraft icons (AircraftShapesSVG), category-based fallback silhouettes (pw-silhouettes), and altitude-colored track trails.

### Modified Capabilities
(none — additive layer; existing map-view/layer capabilities are unchanged)

## Impact

- New dependencies: `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` (interleaved overlay controller for MapLibre).
- `components/map/aircraft.ts` (new): feeder polling module — fetch/parse `aircraft.json`, normalize into the app's aircraft/track model, returns empty on failure/unset config (mirrors `tfr.ts`/`specialUseAirspace.ts` failure handling).
- `components/map/aircraftIcons.ts` (new): type-designator → icon resolution, category → generic-silhouette fallback mapping, SVG-to-deck.gl-icon-atlas conversion.
- `public/aircraft-shapes/` and `public/aircraft-silhouettes/` (new, vendored): static SVG assets from AircraftShapesSVG (GPL-3.0) and pw-silhouettes (CC BY-NC-SA 4.0) with their LICENSE files included; attribution added to README. The pw-silhouettes non-commercial clause is compatible with SquawkMap3D's non-commercial personal/OSS use but should be called out explicitly since it constrains downstream reuse.
- `components/map/layers.ts` / `MapView.tsx`: new deck.gl `MapboxOverlay` mounted alongside the MapLibre map, visibility state/ref pair, polling effect (interval configurable, default fast enough for live tracking — much faster than the existing 5-60 minute weather/airspace refresh intervals), toggle button.
- `components/map/constants.ts`: `AIRCRAFT_FEED_REFRESH_INTERVAL_MS`, `AIRCRAFT_TRACK_MAX_POINTS`/retention window, category→generic-silhouette map.
- `.env.example`: new `NEXT_PUBLIC_FEEDER_URL`.
- No breaking changes to existing layers, sources, or map behavior.
- New external runtime dependency: the user's own ADS-B feeder (LAN or otherwise reachable `aircraft.json` endpoint) — not a third-party aggregator API (unlike aeris's adsb.lol/adsb.fi/airplanes.live/OpenSky fallback chain), since the acceptance criteria specifically calls for pulling from "the feeder."

## Why

The actual-range-outline radar sweep's aircraft dots and ICAO hex labels (`components/map/radarSweep.ts`) are currently positioned at each aircraft's real altitude, floating high above the ground/terrain in this app's pitched 3D view — unlike a real radar scope, where contacts read as ground-plane blips regardless of altitude. Separately, the map's initial view is either a wide continental-US default (`DEFAULT_VIEW.zoom = 4`) or, once geolocation resolves, an even wider ~200 NM fit-to-range-rings view (`getUserLocationBounds()`, sized to the outermost 200 NM ring) — both far more zoomed-out than useful for a first look at local traffic. Tightening the first-load view to a consistent, sensible 60 NM around the map's center makes the initial experience immediately useful without requiring the user to zoom in manually.

## What Changes

- Reposition the radar-sweep aircraft dots (`RANGE_OUTLINE_AIRCRAFT_DOT_LAYER_ID`) and hex labels (`RANGE_OUTLINE_AIRCRAFT_LABEL_LAYER_ID`) in `components/map/radarSweep.ts` from the aircraft's real altitude (`altitudeToRenderMeters(d.altitude)`) to ground level (elevation `0`), so they read as ground-plane radar blips rather than floating markers at cruise altitude. The sweep wedge geometry and every other aircraft-altitude-positioned layer (the separate `aircraft-tracks-layer` icons/tracks in `aircraftLayer.ts`) are unaffected.
- Change the map's initial-load zoom behavior so the first view presented to the user — both the transient pre-geolocation view and the view after geolocation resolves — shows approximately 60 nautical miles around the map's center, replacing the current `DEFAULT_VIEW.zoom = 4` continental-US default and the current post-geolocation ~200 NM (outermost range ring) `fitBounds`. The separate "jump to my location" control (`handleJumpToLocation`) and the satellite-icon click-to-recenter handler keep their existing ~200 NM (outermost range ring) `fitBounds` behavior unchanged — this change is scoped to first load only.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `actual-range-outline-layer`: the "Tracked aircraft shown as hex-labeled dots on the sweep" requirement's dot/label position changes from the aircraft's real altitude to ground level (elevation 0).
- `map-view`: the "Center on user location" requirement's initial view (both the fallback default and the geolocation-resolved view) is now scoped to approximately 60 NM around the map's center, rather than the current wide continental-US default zoom or ~200 NM range-ring fit.

## Impact

- `components/map/radarSweep.ts`: `buildRangeOutlineSweepLayers()`'s `dotLayer`/`labelLayer` `getPosition` callbacks change from `[d.lon, d.lat, altitudeToRenderMeters(d.altitude)]` to `[d.lon, d.lat, 0]`.
- `components/map/constants.ts`: `DEFAULT_VIEW.zoom` (currently `4`) replaced by a computed/derived zoom (or the constructor's `bounds` option used instead) that shows ~60 NM around `DEFAULT_VIEW.center`; new constant for the 60 NM radius, reusing the existing `RANGE_RING_RADII_NM`/`getUserLocationBounds()` pattern in `components/map/userLocation.ts` generalized to an arbitrary radius.
- `components/map/MapView.tsx`: the map constructor call (currently `center`/`zoom` from `DEFAULT_VIEW`) and the initial `resolveUserLocation().then(...)` block's `fitBounds(getUserLocationBounds(coords), ...)` (around line 835) both change to use the new ~60 NM bounds. `handleJumpToLocation` (~line 1112) and the satellite-icon click handler (~line 771) are unchanged.
- No changes to `components/map/aircraftLayer.ts` (the separate, altitude-positioned aircraft-icons layer) or to the `user-location-marker` capability's range rings (still 50/100/150/200 NM).

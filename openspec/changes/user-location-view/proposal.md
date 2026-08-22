## Why

The map centers on the user's location once at load (see `map-view` spec), but there's no way to jump back there later, no on-screen pan/tilt/zoom controls, and no visual anchor at the user's position. Pilots and other users need a persistent, glanceable reference point on the map — where am I, and how far is that landmark on the horizon — without eyeballing distances.

## What Changes

- Add a "jump to my location" button that re-centers/flies the map to the user's current geolocation on demand (not just on initial load).
- Add on-screen pan/tilt/zoom controls, built on MapLibre's built-in `NavigationControl` (zoom in/out, compass/bearing-reset with pitch visualization) rather than custom-built controls.
- Render a simple 3D satellite-dish shape (MapLibre `fill-extrusion` geometry, no external 3D model/asset pipeline) anchored at the user's location once known.
- Add 3 concentric, labeled range rings around the user's location at 50 NM, 100 NM, and 200 NM (great-circle radius), each labeled with its distance.
- All of the above (dish + rings) only appear once the user's location is known (via existing `getCurrentLocation`, or the new locate-me control); they do nothing when location is denied/unavailable, matching the existing fallback behavior in `map-view`.

## Capabilities

### New Capabilities
- `user-location-marker`: on-demand jump-to-location control, MapLibre-built-in pan/tilt/zoom controls, a 3D dish marker at the user's location, and labeled 50/100/200 NM range rings centered on that location.

### Modified Capabilities
(none — `map-view`'s existing initial-centering requirement is unchanged; this change only adds new, additive capability)

## Impact

- `components/map/MapView.tsx`: mount `NavigationControl` and `GeolocateControl` (or equivalent custom button wired to `getCurrentLocation`), track last-known user location in state/ref.
- `components/map/layers.ts` (or a new `components/map/userLocation.ts`): add source/layers for the dish extrusion and the 3 ring circles + labels.
- `components/map/constants.ts`: add NM-to-meters conversion and ring radii constants.
- No new dependencies (stays within `maplibre-gl`'s built-in controls and geometry types).

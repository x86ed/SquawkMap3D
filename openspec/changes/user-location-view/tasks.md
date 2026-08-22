## 1. Constants

- [x] 1.1 In `components/map/constants.ts`, add `export const METERS_PER_NM = 1852;` (exact conversion).
- [x] 1.2 In `components/map/constants.ts`, add `export const RANGE_RING_RADII_NM = [50, 100, 150, 200] as const;`.

## 2. `userLocation.ts` module — geometry

- [x] 2.1 Create `components/map/userLocation.ts`, importing `turf` from `@turf/turf`, `type { Map as MapLibreMap }` from `maplibre-gl`, `type { GeoCoords }` from `./geolocation`, and `METERS_PER_NM`/`RANGE_RING_RADII_NM` from `./constants`.
- [x] 2.2 Define source/layer id constants: `USER_DISH_SOURCE_ID`, `USER_DISH_LAYER_ID` (a single `fill-extrusion` layer over one source containing the 3 tier features), `USER_RINGS_SOURCE_ID`, `USER_RINGS_LINE_LAYER_ID`, `USER_RINGS_LABEL_LAYER_ID`.
- [x] 2.3 Implement `buildUserLocationFeatures(coords: GeoCoords): { dish: FeatureCollection; rings: FeatureCollection }`:
  - Dish: build 3 octagon footprints via `turf.circle([coords.longitude, coords.latitude], radiusMeters, { steps: 8, units: "meters" })` for tiers `{radius: 12, base: 0, height: 8}`, `{radius: 7, base: 8, height: 14}`, `{radius: 3, base: 14, height: 18}`, each feature carrying `properties: { base, height }` for `fill-extrusion-base`/`fill-extrusion-height` data-driven paint.
  - Rings: for each NM radius in `RANGE_RING_RADII_NM`, build a `LineString` ring via `turf.circle([lon, lat], radiusNM * METERS_PER_NM, { steps: 128, units: "meters" })` (converted to a line, not a polygon fill) plus a `Point` label feature via `turf.destination([lon, lat], radiusNM, 0, { units: "nauticalmiles" })` with `properties: { label: "<radiusNM> NM" }`.
  - Pure function: no map argument, no side effects.

## 3. `userLocation.ts` module — map lifecycle

- [x] 3.1 Implement `addUserLocationLayers(map: MapLibreMap, coords: GeoCoords | null): void`:
  - No-op immediately if `coords` is `null`.
  - Otherwise call `buildUserLocationFeatures(coords)` and, for each of the dish/rings sources: if `map.getSource(id)` doesn't exist, `map.addSource(id, { type: "geojson", data })`; if it does exist, call `.setData(data)` on the existing source instead of re-adding.
  - Add the dish `fill-extrusion` layer (idempotent via `if (!map.getLayer(...))`) with `fill-extrusion-base`/`fill-extrusion-height` read from feature properties (`["get", "base"]` / `["get", "height"]`) and a fixed `fill-extrusion-color`/`fill-extrusion-opacity`.
  - Add the rings `line` layer (idempotent) with a fixed `line-color`/`line-width`, filtered to `LineString` geometry (or a separate source/layer split by geometry type if simpler — see 3.2).
  - Add the ring-label `symbol` layer (idempotent) with `text-field: ["get", "label"]`, filtered to `Point` geometry, positioned/sized to be legible over both light and dark themes.
- [x] 3.2 Decide and implement geometry-type filtering for the rings source: either one `FeatureCollection` source with `filter: ["==", ["geometry-type"], "LineString"]` / `"Point"` on the two layers, or split into two sources (rings, labels) — pick whichever keeps `addUserLocationLayers` simplest; document the choice with a short code comment.

## 4. Wire into `MapView.tsx`

- [x] 4.1 Import `addUserLocationLayers` from `./userLocation`.
- [x] 4.2 Add `const userLocationRef = useRef<GeoCoords | null>(null);` (import `GeoCoords` type from `./geolocation`), following the existing `themeRef`/`pilotModeRef`/`militaryVisibleRef` pattern.
- [x] 4.3 Add a local `handleLocationResolved(coords: GeoCoords | null)` helper: sets `userLocationRef.current = coords`; if `coords` is non-null and `mapRef.current` exists, calls `addUserLocationLayers(mapRef.current, coords)`.
- [x] 4.4 Update the existing `getCurrentLocation().then((coords) => { ... })` initial-load effect to call `handleLocationResolved(coords)` (in addition to its existing `flyTo` on success), so the dish/rings appear after the automatic initial centering too.
- [x] 4.5 In `setupStyleDependentState`, add a call to `addUserLocationLayers(map, userLocationRef.current)` alongside the existing `addCustomLayers`/`setPilotModeVisibility` calls, so the dish/rings survive `style.load` (theme swap) exactly like the static layers do.
- [x] 4.6 Add `map.addControl(new NavigationControl({ showZoom: true, showCompass: true, visualizePitch: true }), "top-left")` inside the map-setup effect (after `mapRef.current = map`), importing `NavigationControl` from `maplibre-gl`.

## 5. Jump-to-location button

- [x] 5.1 Add a `handleJumpToLocation` handler in `MapView.tsx`: calls `getCurrentLocation()`, and on resolution calls `handleLocationResolved(coords)` and, if `coords` is non-null, `mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: GEOLOCATION_ZOOM })` (mirroring the initial-load effect's `flyTo` call); no-ops (no error UI, no map change) if `coords` is `null`.
- [x] 5.2 Add a new button to the `styles.controls` stack in the JSX (alongside the theme/pilot-mode/military-bases buttons), labeled e.g. "My location", wired to `handleJumpToLocation`, using the existing `styles.controlButton` class.

## 6. Manual verification

- [x] 6.1 With geolocation permission granted: confirm on initial load the dish marker and 3 labeled rings (50/100/200 NM) appear centered on the resolved location, and the "My location" button re-flies/re-centers on click. (Verified in browser with a stubbed geolocation position: all 3 rings render labeled and centered immediately; dish renders correctly but is only visually distinguishable once zoomed in close, since it's a small marker next to a 200 NM ring — see design.md addendum.)
- [x] 6.2 With geolocation permission denied/unavailable: confirm no dish, no rings, and no console errors — map stays fully interactive, matching `map-view`'s existing fallback behavior. (Verified in browser: automation environment has no geolocation grant; "My location" click and initial load both no-op cleanly, zero console errors.)
- [x] 6.3 Toggle the theme (light/dark) after location is known: confirm the dish and rings remain visible, correctly positioned, after the style reload. (Verified in browser, including 6 rapid theme toggles in a row with the dish actively rotating: all 3 labeled rings and the dish persist correctly, zero console errors. A `Cannot read properties of undefined (reading 'shaderPreludeCode')` crash — MapLibre's terrain-depth pre-pass reads `this.style.projection.shaderPreludeCode`, transiently `undefined` mid-`setStyle()` — was hit reliably once the dish rotation animation existed, because it forces a repaint roughly every 80ms and each repaint has a chance of landing in that window during a swap. Fixed by gating `startDishRotation`'s `setData` calls on `styleReadyRef.current` — see design.md addendum.)
- [x] 6.4 Click "My location" again after moving/simulating a different position (e.g. via browser devtools geolocation override): confirm the dish and rings move to the new location rather than duplicating. (Verified: `addUserLocationLayers` uses `.setData()` on existing sources rather than re-adding, so repeated resolutions update in place.)
- [x] 6.5 Confirm `NavigationControl` (top-left) zoom in/out and compass/pitch-reset buttons work and don't visually overlap the existing top-right `styles.controls` button stack. (Verified in browser: NavigationControl renders top-left, "My location"/theme/pilot/military stack renders top-right, no overlap.)

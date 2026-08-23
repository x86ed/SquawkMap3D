## 1. Setup

- [ ] 1.1 Confirm the VATSIM `Boundaries.geojson` feed shape (verified live: `FeatureCollection` of `MultiPolygon` features with `properties.id`/`oceanic`/`region`/`division`/`label_lon`/`label_lat`) and note it in code comments where the URL constant is defined

## 2. Airspace Boundaries layer

- [ ] 2.1 Add `AIRSPACE_BOUNDARIES_GEOJSON_URL` (hardcoded to `https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/refs/heads/master/Boundaries.geojson`) and `AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS` (`60 * 60_000`) constants to `components/map/constants.ts`
- [ ] 2.2 Add `components/map/airspaceBoundaries.ts` with `fetchAirspaceBoundaries(): Promise<FeatureCollection>`, mirroring `components/map/specialUseAirspace.ts` — wraps the fetch in try/catch and returns an empty `FeatureCollection` (never throws) on any failure or non-OK response
- [ ] 2.3 In `components/map/layers.ts`: add `AIRSPACE_BOUNDARIES_SOURCE_ID` and `AIRSPACE_BOUNDARIES_LINE_LAYER_ID` constants, add `airspaceBoundaries?: boolean` to the `MapLayerVisibility` type, add both IDs' entry to `CUSTOM_LAYER_IDS`
- [ ] 2.4 In `components/map/layers.ts`: register the geojson source (seeded with an empty `FeatureCollection`, guarded with `if (!map.getSource(...))`) and a single `line` style layer (guarded with `if (!map.getLayer(...))`) using a cool blue/cyan paint color (e.g. `#2fd0ff`) distinct from military bases (magenta), TFR (red), and SUA (orange)
- [ ] 2.5 Add `setAirspaceBoundariesVisibility(map, visibility)` setter in `layers.ts`, following `setSpecialUseAirspaceVisibility()`'s shape
- [ ] 2.6 Add `refreshAirspaceBoundaries(map): Promise<void>` in `layers.ts`, following `refreshSpecialUseAirspace()`'s shape — calls `fetchAirspaceBoundaries()` and pushes the result into the source via `setData()`
- [ ] 2.7 In `components/map/MapView.tsx`: add `airspaceBoundariesVisibleRef` / `airspaceBoundariesVisible` state, wire it into the initial `MapLayerVisibility` object passed on map init, call `refreshAirspaceBoundaries()` once on map init (if default-visible)
- [ ] 2.8 In `MapView.tsx`: add a periodic refresh effect using `AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS`, mirroring the existing SUA refresh interval effect — only runs while the layer is enabled, cleared on toggle-off/unmount
- [ ] 2.9 In `MapView.tsx`: add the toggle handler (calls `setAirspaceBoundariesVisibility()` and, on toggle-on, `refreshAirspaceBoundaries()`) and a toggle button in the existing toggle row, labeled e.g. "Hide airspace boundaries" / "Show airspace boundaries", defaulting to visible/on

## 3. Verification

- [ ] 3.1 Manually verify the layer loads live boundary polygons from the VATSIM feed on map init and toggles independently on/off without affecting other layers
- [ ] 3.2 Manually verify the toggle persists across theme switch (light/dark) and pilot-mode toggle, consistent with the other custom layers' `CUSTOM_LAYER_IDS` exemption
- [ ] 3.3 Manually verify graceful behavior when the feed is unreachable (simulate via devtools network blocking of `raw.githubusercontent.com`) — map and other layers keep working, no thrown errors
- [ ] 3.4 Confirm no static/vendored copy of `Boundaries.geojson` was added under `public/data/` or anywhere else in the repo — the feed must only ever be fetched live from the VATSIM URL
- [ ] 3.5 Run `npm run lint`, `npm test`, and `npx tsc --noEmit`

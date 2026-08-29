## 1. Nginx proxy for the feeder's own upintheair.json

- [ ] 1.1 In `scripts/squawkmap3d.nginx.conf`: add a `location = /upintheair.json { proxy_pass http://host.docker.internal:8080/upintheair.json; proxy_set_header Host $host; }` block, same shape/comment style as the existing `/data/receiver.json`/`/data/outline.json` blocks, noting the path is the `ultrafeeder` container's webroot **root** (not under `/data/` — `docker-tar1090`'s `06-range-outline` writes to `${TAR1090_INSTALL_DIR}/html-webroot/upintheair.json`, design.md Decision 1)

## 2. Shared ring-closing helper

- [ ] 2.1 In `components/map/rangeOutline.ts`, export the existing (currently private) `toClosedLngLatRing()` function, adding a doc-comment note that it's now shared with `terrainOutline.ts` (design.md Decision 5) — no behavior change to `rangeOutline.ts` itself

## 3. Terrain outline data module

- [ ] 3.1 Add `components/map/terrainOutline.ts` with `fetchTerrainOutline(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString, { altitudeFt: number }>>`
- [ ] 3.2 In `fetchTerrainOutline()`: return an empty `FeatureCollection` immediately (no network request) if `getFeederUrl()` (imported from `constants.ts`) returns `undefined` — same gate `rangeOutline.ts`'s `getRangeOutlineUrl()` uses (design.md Decision 6)
- [ ] 3.3 Otherwise, `fetch("/upintheair.json")` (the same-origin proxy path from task 1.1), wrapped in try/catch. Treat a non-OK response (including 404 — the file doesn't exist server-side when the feeder has no HeyWhatsThat panorama configured), an empty response body, or a `response.json()`/`JSON.parse` failure as failure, returning an empty `FeatureCollection` in every failure case — never throw
- [ ] 3.4 On success, for each entry in the parsed response's `rings` array: convert `alt` (meters) to `altitudeFt` (`Math.round(alt * 3.28084)`), convert `points` (`[lat, lon]` pairs) to a closed `[lon, lat]` ring via the shared `toClosedLngLatRing()` (task 2.1), and build one `Feature<LineString>` with `properties: { altitudeFt }`. Skip any ring with fewer than 2 source points. Return all resulting features as one `FeatureCollection`; return an empty `FeatureCollection` if `rings` is missing, not an array, or empty

## 4. Line layer

- [ ] 4.1 In `components/map/layers.ts`: add `TERRAIN_OUTLINE_SOURCE_ID` / `TERRAIN_OUTLINE_LINE_LAYER_ID` constants, add `TERRAIN_OUTLINE_LINE_LAYER_ID` to `CUSTOM_LAYER_IDS`
- [ ] 4.2 Add `terrainOutline?: boolean` to the `CustomLayerVisibility` interface
- [ ] 4.3 Add a small helper (e.g. `buildAltitudeColorLineExpression()`) that builds a MapLibre `["interpolate", ["linear"], ["get", "altitudeFt"], ft1, "rgb(r,g,b)", ft2, "rgb(r,g,b)", ...]` expression from `aircraftIcons.ts`'s exported `ALTITUDE_COLOR_STOPS` (design.md Decision 4) — import `ALTITUDE_COLOR_STOPS` from `aircraftIcons.ts` rather than duplicating the color table. Built purely from `ALTITUDE_COLOR_STOPS`' own stops, independent of which altitudes the feeder's response actually contains (there is no SquawkMap3D-side fixed altitude list — design.md Non-Goals)
- [ ] 4.4 In `addCustomLayers()`: add the `TERRAIN_OUTLINE_SOURCE_ID` geojson source (empty `FeatureCollection` initially, same pattern as `TFR_SOURCE_ID`) and the `TERRAIN_OUTLINE_LINE_LAYER_ID` line layer (`type: "line"`, no corresponding fill layer — design.md Decision 3), `line-color` from 4.3, a fixed `line-width` (e.g. `2`, matching `TFR_LINE_LAYER_ID`'s width), gated on `visibility.terrainOutline ?? true`
- [ ] 4.5 Add `setTerrainOutlineVisibility(map, visible)` and `refreshTerrainOutline(map)` (calls `fetchTerrainOutline()` and `source.setData()`), following the exact pattern of `setTfrVisibility`/`refreshTfrs`

## 5. MapView wiring

- [ ] 5.1 In `MapView.tsx`: add `terrainOutlineVisibleRef` / `terrainOutlineVisible` ref+state pair, following the exact pattern used for every other layer
- [ ] 5.2 Pass `terrainOutline: terrainOutlineVisibleRef.current` into the `addCustomLayers()` call in `setupStyleDependentState`
- [ ] 5.3 Add a `handleTerrainOutlineToggle` handler (calls `setTerrainOutlineVisibility`) and a toggle button in the `.controls` row labeled "Hide/Show terrain-based outline", following the existing button pattern (`data-active`, "Hide X"/"Show X" label)
- [ ] 5.4 On initial map load and on every style reload (same place `refreshRangeOutlineData()`/`refreshTfrs()` are already called in `setupStyleDependentState`), call `refreshTerrainOutline(map)` to (re)populate the source — no `setInterval` polling loop (design.md Non-Goals: the feeder's own `upintheair.json` only changes when the `ultrafeeder` container restarts with a different HeyWhatsThat configuration)

## 6. Tests

- [ ] 6.1 Add `test/terrainOutline.test.ts`: unit tests for `fetchTerrainOutline()`'s parsing (well-formed `rings` response → expected `FeatureCollection` shape with closed rings and correct `altitudeFt` values; no feeder configured → empty `FeatureCollection` with no fetch call; non-OK/404 response → empty `FeatureCollection`, no throw; empty/unparseable response body → empty `FeatureCollection`, no throw), mocking `fetch`/`getFeederUrl()` the same way `test/rangeOutline.test.ts` (if present) or other existing tests in `test/` mock network calls and feeder configuration

## 7. Verification

- [ ] 7.1 Manually verify, against a real adsb.im instance with HeyWhatsThat already configured in its own setup UI, that `/upintheair.json` proxies correctly and the resulting rings load and render as unfilled, altitude-colored strokes (not solid fills)
- [ ] 7.2 Manually verify the layer toggles independently on/off without affecting other layers
- [ ] 7.3 Manually verify the layer survives a theme switch (light/dark) and pilot-mode toggle, re-populating its rings without requiring the user to manually re-enable it
- [ ] 7.4 Manually verify graceful behavior with no feeder configured, and with a feeder configured but no HeyWhatsThat panorama set up on it (proxy 404) — no console errors, layer renders empty rather than breaking
- [ ] 7.5 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

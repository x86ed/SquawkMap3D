## 1. Config plumbing

- [ ] 1.1 In `components/map/constants.ts`: add `getHeywhatsthatPanoramaId(): string | undefined`, reading `process.env.NEXT_PUBLIC_HEYWHATSTHAT_PANORAMA_ID`, returning `undefined` when unset, and running its value through a new `extractHeywhatsthatPanoramaId(raw: string): string` helper otherwise — same location/comment style as `getFeederUrl()`/`getOpenAipApiKey()`
- [ ] 1.2 Implement `extractHeywhatsthatPanoramaId()`: if the input contains `view=`, return the substring after it up to the next `&` (or end of string); otherwise return the input trimmed as-is (bare-ID case). Export it (unit-testable independent of the env read)
- [ ] 1.3 Add `HEYWHATSTHAT_UPINTHEAIR_API_URL = "https://www.heywhatsthat.com/api/upintheair.json"` and `HEYWHATSTHAT_REFRACTION = "0.25"` to `constants.ts`, with a comment citing tar1090's own `getupintheair.sh`/`drawUpintheair()` doc comment as the source of the refraction default
- [ ] 1.4 Add `TERRAIN_OUTLINE_ALTITUDES_FT = [1_000, 2_000, 4_000, 6_000, 8_000, 10_000, 20_000, 30_000, 40_000] as const` to `constants.ts`, with a comment noting these were chosen to land on `aircraftIcons.ts`'s `ALTITUDE_COLOR_STOPS`' own more distinctive stops (design.md Decision 4)

## 2. Shared ring-closing helper

- [ ] 2.1 In `components/map/rangeOutline.ts`, export the existing (currently private) `toClosedLngLatRing()` function, adding a doc-comment note that it's now shared with `terrainOutline.ts` (design.md Decision 5) — no behavior change to `rangeOutline.ts` itself

## 3. Terrain outline data module

- [ ] 3.1 Add `components/map/terrainOutline.ts` with `fetchTerrainOutline(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString, { altitudeFt: number }>>`
- [ ] 3.2 In `fetchTerrainOutline()`: return an empty `FeatureCollection` immediately (no network request) if `getHeywhatsthatPanoramaId()` returns `undefined`
- [ ] 3.3 Otherwise, build the request URL from `HEYWHATSTHAT_UPINTHEAIR_API_URL`, the resolved panorama ID, `HEYWHATSTHAT_REFRACTION`, and `TERRAIN_OUTLINE_ALTITUDES_FT` converted to meters (`altFt / 3.28084`, comma-joined) as the `alts` query param
- [ ] 3.4 Fetch that URL, wrapped in try/catch. Treat a non-OK response, an empty response body, or a `response.json()`/`JSON.parse` failure (HeyWhatsThat returns HTTP 200 with an empty body for an invalid panorama ID — confirmed live) as failure, returning an empty `FeatureCollection` in every failure case — never throw
- [ ] 3.5 On success, for each entry in the parsed response's `rings` array: convert `alt` (meters) to `altitudeFt` (`Math.round(alt * 3.28084)`), convert `points` (`[lat, lon]` pairs) to a closed `[lon, lat]` ring via the shared `toClosedLngLatRing()` (task 2.1), and build one `Feature<LineString>` with `properties: { altitudeFt }`. Skip any ring with fewer than 2 source points. Return all resulting features as one `FeatureCollection`; return an empty `FeatureCollection` if `rings` is missing, not an array, or empty

## 4. Line layer

- [ ] 4.1 In `components/map/layers.ts`: add `TERRAIN_OUTLINE_SOURCE_ID` / `TERRAIN_OUTLINE_LINE_LAYER_ID` constants, add `TERRAIN_OUTLINE_LINE_LAYER_ID` to `CUSTOM_LAYER_IDS`
- [ ] 4.2 Add `terrainOutline?: boolean` to the `CustomLayerVisibility` interface
- [ ] 4.3 Add a small helper (e.g. `buildAltitudeColorLineExpression()`) that builds a MapLibre `["interpolate", ["linear"], ["get", "altitudeFt"], ft1, "rgb(r,g,b)", ft2, "rgb(r,g,b)", ...]` expression from `aircraftIcons.ts`'s exported `ALTITUDE_COLOR_STOPS` (design.md Decision 4) — import `ALTITUDE_COLOR_STOPS` from `aircraftIcons.ts` rather than duplicating the color table
- [ ] 4.4 In `addCustomLayers()`: add the `TERRAIN_OUTLINE_SOURCE_ID` geojson source (empty `FeatureCollection` initially, same pattern as `TFR_SOURCE_ID`) and the `TERRAIN_OUTLINE_LINE_LAYER_ID` line layer (`type: "line"`, no corresponding fill layer — design.md Decision 3), `line-color` from 4.3, a fixed `line-width` (e.g. `2`, matching `TFR_LINE_LAYER_ID`'s width), gated on `visibility.terrainOutline ?? true`
- [ ] 4.5 Add `setTerrainOutlineVisibility(map, visible)` and `refreshTerrainOutline(map)` (calls `fetchTerrainOutline()` and `source.setData()`), following the exact pattern of `setTfrVisibility`/`refreshTfrs`

## 5. MapView wiring

- [ ] 5.1 In `MapView.tsx`: add `terrainOutlineVisibleRef` / `terrainOutlineVisible` ref+state pair, following the exact pattern used for every other layer
- [ ] 5.2 Pass `terrainOutline: terrainOutlineVisibleRef.current` into the `addCustomLayers()` call in `setupStyleDependentState`
- [ ] 5.3 Add a `handleTerrainOutlineToggle` handler (calls `setTerrainOutlineVisibility`) and a toggle button in the `.controls` row labeled "Hide/Show terrain-based outline", following the existing button pattern (`data-active`, "Hide X"/"Show X" label)
- [ ] 5.4 On initial map load and on every style reload (same place `refreshRangeOutlineData()`/`refreshTfrs()` are already called in `setupStyleDependentState`), call `refreshTerrainOutline(map)` to (re)populate the source — no `setInterval` polling loop (design.md Non-Goals: HeyWhatsThat panorama data is static)

## 6. Tests

- [ ] 6.1 Add `test/terrainOutline.test.ts`: unit tests for `extractHeywhatsthatPanoramaId()` (bare ID passthrough, `view=`-URL extraction, extraction when other query params follow `view=`) and for `fetchTerrainOutline()`'s parsing (well-formed `rings` response → expected `FeatureCollection` shape with closed rings and correct `altitudeFt` values; missing panorama ID → empty `FeatureCollection` with no fetch call; empty/unparseable response body → empty `FeatureCollection`, no throw), mocking `fetch` the same way existing tests in `test/` mock network calls

## 7. Verification

- [ ] 7.1 Manually verify, against a real HeyWhatsThat panorama ID, that the configured rings load and render as unfilled, altitude-colored strokes (not solid fills)
- [ ] 7.2 Manually verify the layer toggles independently on/off without affecting other layers
- [ ] 7.3 Manually verify the layer survives a theme switch (light/dark) and pilot-mode toggle, re-populating its rings without requiring the user to manually re-enable it
- [ ] 7.4 Manually verify graceful behavior with no panorama ID configured, and with an invalid/unknown panorama ID (empty-body 200 response) — no console errors, layer renders empty rather than breaking
- [ ] 7.5 Manually verify pasting a full panorama URL (e.g. `https://www.heywhatsthat.com/?view=CG4B3P7M`) into `NEXT_PUBLIC_HEYWHATSTHAT_PANORAMA_ID` works identically to pasting the bare ID
- [ ] 7.6 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

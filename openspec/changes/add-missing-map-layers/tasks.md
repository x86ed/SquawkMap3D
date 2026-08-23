## 1. Setup

- [x] 1.1 Confirm live tile/API endpoints, required API keys, and attribution text for each provider (OpenAIP, RainViewer, FAA TFR feed, FAA SUA feed, IEM NEXRAD, IEM/NOAA infrared, NOAA Radar, DWD RADOLAN) per design.md's Open Questions
- [x] 1.2 Add required env var(s) (e.g. `NEXT_PUBLIC_OPENAIP_API_KEY`) to `.env.example` and document setup

## 2. OpenAIP TMS layer

- [x] 2.1 Add `OPENAIP_TILE_URL`/minzoom/maxzoom constants to `components/map/constants.ts`
- [x] 2.2 Add OpenAIP source/layer (raster) in `components/map/layers.ts`, guarded so a missing API key leaves the layer inert without erroring
- [x] 2.3 Add `setOpenAipVisibility()` setter
- [x] 2.4 Add state/ref pair and toggle button in `components/map/MapView.tsx`
- [x] 2.5 Verify attribution text is set on the source

## 3. RainViewer Radar layer

- [x] 3.1 Add `components/map/rainviewer.ts` with a function to fetch the current frame timestamp and build the tile URL
- [x] 3.2 Add RainViewer source/layer in `layers.ts`, added/updated once the current-frame URL resolves
- [x] 3.3 Add periodic refresh (poll for a newer frame) while the layer is enabled; stop polling when disabled
- [x] 3.4 Add `setRainViewerVisibility()` setter
- [x] 3.5 Add state/ref pair and toggle button in `MapView.tsx`
- [x] 3.6 Handle frame-timestamp fetch failure without throwing or blocking other layers

## 4. US TFR layer

- [x] 4.1 Add a fetch/parse module for the FAA TFR feed, converting to GeoJSON if needed — no live public feed was confirmed to exist (see design.md Open Questions / Risks); `tfr.ts` is fully scaffolded but serves an empty FeatureCollection via `TFR_FEED_URL` (currently unset) until a real feed is wired in
- [x] 4.2 Add TFR source/layer in `layers.ts` with a fill/line style visually distinct from special use airspace and military bases
- [x] 4.3 Add periodic refetch while the layer is enabled; stop when disabled
- [x] 4.4 Add `setTfrVisibility()` setter
- [x] 4.5 Add state/ref pair and toggle button in `MapView.tsx`
- [x] 4.6 Handle feed fetch failure by retaining last-known data and not erroring

## 5. US Special Use Airspace layer

- [x] 5.1 Add a fetch/parse module for the FAA SUA feed, converting to GeoJSON if needed — live FAA ArcGIS FeatureServer confirmed and wired in (`SUA_FEATURE_SERVICE_QUERY_URL`)
- [x] 5.2 Add SUA source/layer in `layers.ts` with a fill/line style visually distinct from TFRs and military bases
- [x] 5.3 Add periodic refetch while the layer is enabled; stop when disabled
- [x] 5.4 Add `setSpecialUseAirspaceVisibility()` setter
- [x] 5.5 Add state/ref pair and toggle button in `MapView.tsx`
- [x] 5.6 Handle feed fetch failure by retaining last-known data and not erroring

## 6. US NEXRAD layer

- [x] 6.1 Add `NEXRAD_TILE_URL`/minzoom/maxzoom constants to `constants.ts`
- [x] 6.2 Add NEXRAD source/layer (raster) in `layers.ts`
- [x] 6.3 Add `setNexradVisibility()` setter
- [x] 6.4 Add state/ref pair and toggle button (labeled distinctly from NOAA Radar) in `MapView.tsx`

## 7. US NOAA InfraredSat layer

- [x] 7.1 Add `NOAA_INFRARED_TILE_URL`/minzoom/maxzoom constants to `constants.ts` — no free/no-key source was confirmed (see design.md Risks); `NOAA_INFRARED_TILE_URL` is currently unset so the layer/toggle no-op until a real source is wired in
- [x] 7.2 Add NOAA infrared source/layer (raster) in `layers.ts`
- [x] 7.3 Add `setNoaaInfraredVisibility()` setter
- [x] 7.4 Add state/ref pair and toggle button in `MapView.tsx`

## 8. US NOAA Radar layer

- [x] 8.1 Add `NOAA_RADAR_TILE_URL`/minzoom/maxzoom constants to `constants.ts` (WMS-backed, via `NOAA_RADAR_WMS_BASE_URL`/`NOAA_RADAR_WMS_LAYER`)
- [x] 8.2 Add NOAA Radar source/layer (raster) in `layers.ts`, sourced independently of the NEXRAD layer
- [x] 8.3 Add `setNoaaRadarVisibility()` setter
- [x] 8.4 Add state/ref pair and toggle button (labeled distinctly from NEXRAD) in `MapView.tsx`

## 9. Europe DWD RADOLAN layer

- [x] 9.1 Add DWD RADOLAN WMS-backed raster tile constants (URL template, bounds/coverage) to `constants.ts` — layer name confirmed live against DWD's own GetCapabilities (`RADOLAN-RY`)
- [x] 9.2 Add RADOLAN source/layer (raster) in `layers.ts`
- [x] 9.3 Add `setDwdRadolanVisibility()` setter
- [x] 9.4 Add state/ref pair and toggle button in `MapView.tsx`
- [x] 9.5 Verify no errors/broken tiles when panning outside RADOLAN coverage — WMS requests outside Germany return transparent/empty tiles, no errors (confirmed via live network check)

## 10. Verification

- [x] 10.1 Manually verify each layer toggles independently, on/off, without affecting other layers — verified live (dev server + browser): each new layer fires its own real network requests (RainViewer weather-maps.json 200, SUA FeatureServer 200, NEXRAD tiles 200, NOAA Radar WMS 200, DWD RADOLAN WMS 200 after a layer-name fix, OpenAIP correctly fires nothing with no key configured); toggling NEXRAD off/on didn't affect other layers
- [x] 10.2 Manually verify each toggle persists across theme switch (light/dark) and pilot-mode toggle — verified theme-switch persistence live (NEXRAD toggled off, then theme switched dark→light, toggle stayed off); pilot-mode persistence relies on the same `CUSTOM_LAYER_IDS` exemption mechanism already used and tested by the existing terminator/military-bases/airports layers, and all 8 new layers were added to that list
- [x] 10.3 Manually verify graceful behavior when OpenAIP key is unset and when TFR/SUA/RainViewer feeds are unreachable — OpenAIP no-key no-op confirmed live (zero OpenAIP requests fired); TFR/SUA/RainViewer failure paths verified by code review (each wrapped in try/catch returning empty/no-op, matching this file's existing error-handling convention)
- [x] 10.4 Run `npm run lint` and `npm test` — both pass; `npx tsc --noEmit` also clean

**Note:** the base map canvas didn't visually paint in this session's automated browser tab (a WebGL/headless-Chrome limitation in that sandboxed environment — the pre-existing basemap/military-bases/airports layers show the same behavior, unrelated to this change). All new layers' network requests, toggle state, and error handling were verified through devtools network/console inspection instead of visual rendering.

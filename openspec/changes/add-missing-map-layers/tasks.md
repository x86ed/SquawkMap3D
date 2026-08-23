## 1. Setup

- [ ] 1.1 Confirm live tile/API endpoints, required API keys, and attribution text for each provider (OpenAIP, RainViewer, FAA TFR feed, FAA SUA feed, IEM NEXRAD, IEM/NOAA infrared, NOAA Radar, DWD RADOLAN) per design.md's Open Questions
- [ ] 1.2 Add required env var(s) (e.g. `NEXT_PUBLIC_OPENAIP_API_KEY`) to `.env.example` and document setup

## 2. OpenAIP TMS layer

- [ ] 2.1 Add `OPENAIP_TILE_URL`/minzoom/maxzoom constants to `components/map/constants.ts`
- [ ] 2.2 Add OpenAIP source/layer (raster) in `components/map/layers.ts`, guarded so a missing API key leaves the layer inert without erroring
- [ ] 2.3 Add `setOpenAipVisibility()` setter
- [ ] 2.4 Add state/ref pair and toggle button in `components/map/MapView.tsx`
- [ ] 2.5 Verify attribution text is set on the source

## 3. RainViewer Radar layer

- [ ] 3.1 Add `components/map/rainviewer.ts` with a function to fetch the current frame timestamp and build the tile URL
- [ ] 3.2 Add RainViewer source/layer in `layers.ts`, added/updated once the current-frame URL resolves
- [ ] 3.3 Add periodic refresh (poll for a newer frame) while the layer is enabled; stop polling when disabled
- [ ] 3.4 Add `setRainViewerVisibility()` setter
- [ ] 3.5 Add state/ref pair and toggle button in `MapView.tsx`
- [ ] 3.6 Handle frame-timestamp fetch failure without throwing or blocking other layers

## 4. US TFR layer

- [ ] 4.1 Add a fetch/parse module for the FAA TFR feed, converting to GeoJSON if needed
- [ ] 4.2 Add TFR source/layer in `layers.ts` with a fill/line style visually distinct from special use airspace and military bases
- [ ] 4.3 Add periodic refetch while the layer is enabled; stop when disabled
- [ ] 4.4 Add `setTfrVisibility()` setter
- [ ] 4.5 Add state/ref pair and toggle button in `MapView.tsx`
- [ ] 4.6 Handle feed fetch failure by retaining last-known data and not erroring

## 5. US Special Use Airspace layer

- [ ] 5.1 Add a fetch/parse module for the FAA SUA feed, converting to GeoJSON if needed
- [ ] 5.2 Add SUA source/layer in `layers.ts` with a fill/line style visually distinct from TFRs and military bases
- [ ] 5.3 Add periodic refetch while the layer is enabled; stop when disabled
- [ ] 5.4 Add `setSpecialUseAirspaceVisibility()` setter
- [ ] 5.5 Add state/ref pair and toggle button in `MapView.tsx`
- [ ] 5.6 Handle feed fetch failure by retaining last-known data and not erroring

## 6. US NEXRAD layer

- [ ] 6.1 Add `NEXRAD_TILE_URL`/minzoom/maxzoom constants to `constants.ts`
- [ ] 6.2 Add NEXRAD source/layer (raster) in `layers.ts`
- [ ] 6.3 Add `setNexradVisibility()` setter
- [ ] 6.4 Add state/ref pair and toggle button (labeled distinctly from NOAA Radar) in `MapView.tsx`

## 7. US NOAA InfraredSat layer

- [ ] 7.1 Add `NOAA_INFRARED_TILE_URL`/minzoom/maxzoom constants to `constants.ts`
- [ ] 7.2 Add NOAA infrared source/layer (raster) in `layers.ts`
- [ ] 7.3 Add `setNoaaInfraredVisibility()` setter
- [ ] 7.4 Add state/ref pair and toggle button in `MapView.tsx`

## 8. US NOAA Radar layer

- [ ] 8.1 Add `NOAA_RADAR_TILE_URL`/minzoom/maxzoom constants to `constants.ts`
- [ ] 8.2 Add NOAA Radar source/layer (raster) in `layers.ts`, sourced independently of the NEXRAD layer
- [ ] 8.3 Add `setNoaaRadarVisibility()` setter
- [ ] 8.4 Add state/ref pair and toggle button (labeled distinctly from NEXRAD) in `MapView.tsx`

## 9. Europe DWD RADOLAN layer

- [ ] 9.1 Add DWD RADOLAN WMS-backed raster tile constants (URL template, bounds/coverage) to `constants.ts`
- [ ] 9.2 Add RADOLAN source/layer (raster) in `layers.ts`
- [ ] 9.3 Add `setDwdRadolanVisibility()` setter
- [ ] 9.4 Add state/ref pair and toggle button in `MapView.tsx`
- [ ] 9.5 Verify no errors/broken tiles when panning outside RADOLAN coverage

## 10. Verification

- [ ] 10.1 Manually verify each layer toggles independently, on/off, without affecting other layers
- [ ] 10.2 Manually verify each toggle persists across theme switch (light/dark) and pilot-mode toggle
- [ ] 10.3 Manually verify graceful behavior when OpenAIP key is unset and when TFR/SUA/RainViewer feeds are unreachable (e.g. via devtools network throttling/blocking)
- [ ] 10.4 Run `npm run lint` and `npm test`

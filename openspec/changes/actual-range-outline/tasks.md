## 1. Feeder proxy

- [ ] 1.1 Add a `location = /data/outline.json` block to `scripts/squawkmap3d.nginx.conf`, copied from the existing `location = /data/receiver.json` block with `proxy_pass http://host.docker.internal:8080/data/outline.json;` and a comment explaining why (same CORS gap as `receiver.json` — ultrafeeder's nginx only patches `aircraft.json`'s location block)
- [ ] 1.2 Confirm no other deploy-related config (docker run flags, `deploy-to-feeder.sh`) needs changes — `host.docker.internal` reachability is already established for `receiver.json`, this reuses the same mechanism

## 2. Range outline data module

- [ ] 2.1 Add `components/map/rangeOutline.ts` with a module-private `getRangeOutlineUrl()` (returns `/data/outline.json` when `getFeederUrl()` from `constants.ts` is set, else `undefined` — mirrors `feederLocation.ts`'s `getReceiverUrl()`)
- [ ] 2.2 In `rangeOutline.ts`, add `fetchRangeOutline(): Promise<GeoJSON.FeatureCollection>` — fetches the URL from 2.1, wraps in try/catch, returns an empty `FeatureCollection` on any failure, missing config, non-OK response, or a response with no usable ring data (mirrors `tfr.ts`/`specialUseAirspace.ts`)
- [ ] 2.3 In `fetchRangeOutline()`, parse the response body using tar1090's own three-shape fallback chain (reverse-engineered from `html/script.js`'s `drawOutlineJson()`): `data.multiRange` (already an array of rings) → else `data.actualRange.last24h.points` wrapped as a single-ring array → else `data.points` wrapped as a single-ring array. Each ring is an array of `[lat, lon]` pairs; convert to GeoJSON `[lon, lat]` and close the ring (repeat the first coordinate at the end) if not already closed. Build a `Polygon` feature per ring (or `MultiPolygon` if there's more than one ring) in the returned `FeatureCollection`
- [ ] 2.4 Add `RANGE_OUTLINE_REFRESH_INTERVAL_MS = 15_000` to `components/map/constants.ts`, with a comment noting it matches tar1090's own `actualOutline.refresh` polling interval

## 3. Fill layer

- [ ] 3.1 In `components/map/layers.ts`: add `RANGE_OUTLINE_SOURCE_ID` / `RANGE_OUTLINE_FILL_LAYER_ID` constants, add `RANGE_OUTLINE_FILL_LAYER_ID` to `CUSTOM_LAYER_IDS`
- [ ] 3.2 Add `RANGE_OUTLINE_FILL_COLOR = "#00596b"` (tar1090's own `actual_range_outline_color` default) near the other layer-color constants, with a comment noting the source and that this app deliberately fills solid rather than stroking (per the acceptance criteria), unlike tar1090's own default treatment
- [ ] 3.3 Add `rangeOutline?: boolean` to the `CustomLayerVisibility` interface
- [ ] 3.4 In `addCustomLayers()`: add the `RANGE_OUTLINE_SOURCE_ID` geojson source (empty `FeatureCollection` initially, same pattern as `TFR_SOURCE_ID`/`SUA_SOURCE_ID`) and the `RANGE_OUTLINE_FILL_LAYER_ID` fill layer (`fill-color: RANGE_OUTLINE_FILL_COLOR`, a moderate `fill-opacity` consistent with the other fill layers e.g. `0.3`), gated on `visibility.rangeOutline ?? true`
- [ ] 3.5 Add `setRangeOutlineVisibility(map, visible)` and `refreshRangeOutline(map)` (calls `fetchRangeOutline()` and `source.setData()`), following the exact pattern of `setTfrVisibility`/`refreshTfrs`

## 4. Radar sweep overlay

- [ ] 4.1 Add `components/map/radarSweep.ts`. Export a `RadarSweepController` (or equivalent) with `start(map, container, siteLocationRef)` / `stop()` — owns a `<canvas>` element created and absolutely positioned (`position: absolute; inset: 0; pointer-events: none`) over the same container the MapLibre `Map` renders into, sized via `devicePixelRatio`-aware resize (matching `resizeCanvas()` in the reference `radar-sweep_4.html`), and a `requestAnimationFrame` loop
- [ ] 4.2 Add `RANGE_OUTLINE_SWEEP_PERIOD_MS = 8_000` to `constants.ts` (one revolution per 8s — tune visually during implementation)
- [ ] 4.3 In the per-frame draw function: reproject the current outline polygon ring(s) via `map.project([lon, lat])`; fade the previous frame via `globalCompositeOperation = "destination-out"` then restore `"source-over"` (phosphor-persistence, matching the reference); trace the reprojected polygon and `ctx.clip()` before drawing the beam/trail so nothing paints outside the actual polygon shape; compute `sweepAngle` from elapsed wall-clock time and `RANGE_OUTLINE_SWEEP_PERIOD_MS`; draw a fading trailing wedge plus a bright leading edge from the site position outward, matching `radar-sweep_4.html`'s `draw()` structure
- [ ] 4.4 No-op the draw loop (skip frame, or don't schedule the next `requestAnimationFrame`) whenever the outline polygon is empty (no data yet / feed unavailable) or the site location is unknown — don't error
- [ ] 4.5 Resolve the site position via the existing `getFeederLocation()` (`feederLocation.ts`), not a new location source

## 5. Aircraft dots on the sweep

- [ ] 5.1 In `radarSweep.ts`, add a way to feed it the current `Aircraft[]` (reuse `fetchAircraft()` from `aircraft.ts` on its own poll — same interval as `AIRCRAFT_FEED_REFRESH_INTERVAL_MS`, but a separate call from the deck.gl aircraft layer's own poll, since this layer must work independent of that layer's toggle per the spec)
- [ ] 5.2 In the per-frame draw function, for each aircraft with a known `lat`/`lon`: reproject via `map.project()`, draw a small dot, and label it with `hex` (not `callsign`) using `ctx.fillText`, matching the reference's contact-label styling approach
- [ ] 5.3 Track each aircraft's bearing-from-site; when the current sweep angle passes over an aircraft's bearing, brighten/flash that aircraft's dot for a short duration, porting the reference's `paintEvents`/`flashContactRow` mechanic (adapted: no separate contacts-list panel, just the on-canvas flash)
- [ ] 5.4 Confirm dots are drawn regardless of whether they fall inside or outside the outline polygon (only the sweep beam itself is clipped, per design.md Decision 4 step 3 — dots are drawn outside the `ctx.clip()` region so they aren't affected by it)

## 6. MapView wiring

- [ ] 6.1 In `MapView.tsx`: add `rangeOutlineVisibleRef` / `rangeOutlineVisible` ref+state pair, following the exact pattern used for every other layer
- [ ] 6.2 Pass `rangeOutline: rangeOutlineVisibleRef.current` into the `addCustomLayers()` call in `setupStyleDependentState`
- [ ] 6.3 Add a `handleRangeOutlineToggle` handler (calls `setRangeOutlineVisibility`, and starts/stops the `radarSweep.ts` controller's `requestAnimationFrame` loop to match) and a toggle button in the `.controls` row labeled "Hide/Show actual range outline", following the existing button pattern (`data-active`, "Hide X"/"Show X" label)
- [ ] 6.4 Add a `setInterval` refresh loop using `RANGE_OUTLINE_REFRESH_INTERVAL_MS` that calls `refreshRangeOutline(map)` only while the layer is visible, cleared on unmount — same pattern as the TFR/SUA/airspace-boundaries refresh intervals
- [ ] 6.5 Mount the `radarSweep.ts` canvas once (alongside the deck.gl overlay's mount, in the map-init effect) — not re-added on `style.load` (it's a plain DOM overlay, not part of the MapLibre style) — start its animation loop only when the layer is visible, stop it when hidden or the component unmounts

## 7. Verification

- [ ] 7.1 Manually verify the outline polygon loads and renders filled (solid color, not just a stroke) against a real or simulated `outline.json`
- [ ] 7.2 Manually verify the layer toggles independently on/off, and that hiding it stops the fill, the sweep animation, and the aircraft dots together
- [ ] 7.3 Manually verify the layer survives a theme switch (light/dark) and pilot-mode toggle without needing to be manually re-enabled while visible
- [ ] 7.4 Manually verify the sweep beam rotates continuously, stays visually confined to the polygon shape while panning/zooming the map, and shows a fading trail + bright leading edge
- [ ] 7.5 Manually verify aircraft dots render at correct lat/lon positions labeled with hex (not callsign), update as aircraft move, disappear when an aircraft is no longer reported, and still render when the separate aircraft-icons layer is toggled off
- [ ] 7.6 Manually verify graceful behavior when `outline.json` is unavailable (unset feeder, or a feeder that 404s on that path) — no console errors, layer renders empty rather than breaking
- [ ] 7.7 Confirm the new nginx proxy block doesn't affect the existing `receiver.json` proxy or any other route (`nginx -t` config check at minimum; live verification against a real deploy if feasible in this session)
- [ ] 7.8 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

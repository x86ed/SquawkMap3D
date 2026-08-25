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

## 4. Radar sweep overlay (deck.gl, not a flat canvas — see design.md Decision 4)

- [ ] 4.1 Add `components/map/radarSweep.ts`. Export something analogous to `aircraftLayer.ts`'s `buildAircraftLayers()` — a `buildRangeOutlineSweepLayers(params): Layer[]` pure builder (inputs: current outline `FeatureCollection`, site location, current sweep angle, current `Aircraft[]`, per-aircraft last-flash timestamps) — plus whatever small bit of mutable state (current angle, flash timers) the animation loop needs to own between frames
- [ ] 4.2 Add `RANGE_OUTLINE_SWEEP_PERIOD_MS = 8_000` to `constants.ts` (one revolution per 8s — tune visually during implementation)
- [ ] 4.3 Implement the ray-polygon intersection helper (design.md Decision 4b): given the site position, a bearing, and the outline polygon's ring(s), return the distance from site to where that ray exits the polygon (or a fallback max radius if it doesn't intersect). Use this to build the sweep wedge's outer vertices for a set of angles spanning the trailing wedge's width, so the wedge naturally stops at the polygon boundary without needing any screen-space clip
- [ ] 4.4 Build the wedge as a `SolidPolygonLayer` (or a few thin angular slices with decreasing opacity from leading edge backward, for the graded fading-trail look — see design.md Decision 4b's note on reproducing "fading trailing wedge" without cross-frame persistence) plus a bright, high-opacity leading-edge slice
- [ ] 4.5 Compute `sweepAngle` from elapsed wall-clock time and `RANGE_OUTLINE_SWEEP_PERIOD_MS` (unbounded/monotonic, matching the reference's `sweepAngle += sweepSpeed*dt` approach but framed as `(elapsedMs / RANGE_OUTLINE_SWEEP_PERIOD_MS) * 360`)
- [ ] 4.6 No-op (skip building wedge/dot layers, i.e. return `[]`) whenever the outline polygon is empty (no data yet / feed unavailable) or the site location is unknown — don't error
- [ ] 4.7 Resolve the site position via the existing `getFeederLocation()` (`feederLocation.ts`), not a new location source

## 5. Aircraft dots on the sweep

- [ ] 5.1 In `radarSweep.ts`, add a way to feed it the current `Aircraft[]` (reuse `fetchAircraft()` from `aircraft.ts` on its own poll — same interval as `AIRCRAFT_FEED_REFRESH_INTERVAL_MS`, but a separate call from the deck.gl aircraft layer's own poll, since this layer must work independent of that layer's toggle per the spec)
- [ ] 5.2 Build a `ScatterplotLayer` (dots) and a `TextLayer` (hex labels) from the current `Aircraft[]`, positioned at `[lon, lat, altitude * FEET_TO_METERS]` — reuse the same feet-to-meters conversion `aircraftLayer.ts` already uses, so dots sit at the same real-world 3D point as that aircraft's own icon on the (independently toggleable) aircraft-icons layer. `getText: (d) => d.hex` (not `callsign`/`flight`)
- [ ] 5.3 Track each aircraft's bearing-from-site; when the current sweep angle passes over an aircraft's bearing, brighten/enlarge that aircraft's dot (e.g. via `getFillColor`/`getRadius` driven by a short-lived per-hex "last flash" timestamp) for a short duration, porting the reference's `paintEvents`/`flashContactRow` mechanic (adapted: no separate contacts-list panel, just the dot's own brightness/size change)
- [ ] 5.4 Confirm dots are drawn regardless of whether they fall inside or outside the outline polygon (only the sweep wedge's own geometry is bounded by the ray-cast in 4.3, per design.md Decision 6's note — dots are a separate, unbounded layer)

## 6. MapView wiring

- [ ] 6.1 In `MapView.tsx`: add `rangeOutlineVisibleRef` / `rangeOutlineVisible` ref+state pair, following the exact pattern used for every other layer
- [ ] 6.2 Pass `rangeOutline: rangeOutlineVisibleRef.current` into the `addCustomLayers()` call in `setupStyleDependentState` (this governs the MapLibre fill layer's visibility only — the sweep overlay's own visibility is handled separately in 6.3/6.5, since it isn't a style-owned layer)
- [ ] 6.3 Add a `handleRangeOutlineToggle` handler (calls `setRangeOutlineVisibility` for the fill layer, and starts/stops the sweep overlay's `requestAnimationFrame` loop to match) and a toggle button in the `.controls` row labeled "Hide/Show actual range outline", following the existing button pattern (`data-active`, "Hide X"/"Show X" label)
- [ ] 6.4 Add a `setInterval` refresh loop using `RANGE_OUTLINE_REFRESH_INTERVAL_MS` that calls `refreshRangeOutline(map)` only while the layer is visible, cleared on unmount — same pattern as the TFR/SUA/airspace-boundaries refresh intervals
- [ ] 6.5 Mount a second `MapboxOverlay` (`interleaved: false`, matching the existing aircraft overlay's settings and its documented deck.gl/MapLibre-terrain patch note) once in the map-init effect, alongside the existing aircraft overlay — not re-added on `style.load` (not part of the MapLibre style, same lifecycle reasoning as the existing overlay). Start its `requestAnimationFrame` loop (calling `buildRangeOutlineSweepLayers()` and `setProps({ layers })` each frame) only when the layer is visible; stop it when hidden or the component unmounts
- [ ] 6.6 Verify the visual stacking order between the two `MapboxOverlay` instances (design.md's flagged risk) — aircraft icons should read clearly on top of the sweep wedge; adjust mount order or overlay canvas positioning if the default order reads wrong

## 7. Verification

- [ ] 7.1 Manually verify the outline polygon loads and renders filled (solid color, not just a stroke) against a real or simulated `outline.json`
- [ ] 7.2 Manually verify the layer toggles independently on/off, and that hiding it stops the fill, the sweep animation, and the aircraft dots together
- [ ] 7.3 Manually verify the layer survives a theme switch (light/dark) and pilot-mode toggle without needing to be manually re-enabled while visible
- [ ] 7.4 Manually verify the sweep beam rotates continuously, stays visually confined to the polygon shape while panning/zooming the map, and shows a fading trail + bright leading edge
- [ ] 7.4a Manually verify the sweep and aircraft dots stay correctly positioned/aligned with the map at this app's default pitch (60°) and at a steeper pitch (up to 85°, e.g. via the navigation control's pitch control), including while the camera is rotated (bearing changed) — this is the specific "plays nice with the 3D" behavior this layer's deck.gl-based design (not the reference's flat-canvas technique) exists to satisfy
- [ ] 7.5 Manually verify aircraft dots render at correct lat/lon positions labeled with hex (not callsign), update as aircraft move, disappear when an aircraft is no longer reported, and still render when the separate aircraft-icons layer is toggled off
- [ ] 7.6 Manually verify graceful behavior when `outline.json` is unavailable (unset feeder, or a feeder that 404s on that path) — no console errors, layer renders empty rather than breaking
- [ ] 7.7 Confirm the new nginx proxy block doesn't affect the existing `receiver.json` proxy or any other route (`nginx -t` config check at minimum; live verification against a real deploy if feasible in this session)
- [ ] 7.8 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

## 1. Rendering

- [x] 1.1 `components/map/aircraftLayer.ts`: add `modelsEnabled: boolean` to `buildAircraftLayers` params; when false, skip model resolution so all `positioned` aircraft go to `iconOnlyPositioned` and no `AnimatedAircraftScenegraphLayer` is created
- [x] 1.2 `components/map/terrain.ts`: add `setTerrainEnabled(map, enabled)` (calls `applyTerrain` or `map.setTerrain(null)` plus sky handling); make the `style.load` path accept the current enabled state

## 2. Control

- [x] 2.1 Add `VIEW_MODE_2D_PITCH = 0` to `components/map/constants.ts`
- [x] 2.2 Add `components/map/viewMode.ts`: `ViewMode`, `VIEW_MODE_STORAGE_KEY = "squawkmap3d:viewMode"`, `getStoredViewMode`, `storeViewMode`, `getInitialViewMode` (default `"3d"`), same SSR-guard/try-catch shape as `components/map/theme.ts`
- [x] 2.3 Add `components/map/viewModeControl.ts`: `ViewModeControl implements IControl` with its own button in a `maplibregl-ctrl-group` showing the current mode label ("2D"/"3D"), `title`/`aria-label` naming the target action, `setMode(mode)`, click -> `onToggle()`. No compass listener, no fallback logic. Add CSS so it matches the nav group in light and dark themes
- [x] 2.4 `MapView.tsx`: keep `new NavigationControl(...)` (~line 668) unchanged; add `ViewModeControl` to `"top-left"` immediately after it

## 3. MapView wiring

- [x] 3.1 Add `viewModeRef`/`viewMode` state pair initialised from `getInitialViewMode()` (like `getInitialTheme()` at lines ~157/249) and `savedPitchRef`; construct the map with pitch 0 / `maxPitch` 0 / no terrain when the restored mode is 2D
- [x] 3.2 Toggle handler: 2D -> save pitch, `setMaxPitch(0)`, `easeTo({pitch:0})`, `setTerrainEnabled(false)`; 3D -> `setMaxPitch(MAX_PITCH)`, `setTerrainEnabled(true)`, `easeTo({pitch: saved ?? INITIAL_PITCH})` (bearing untouched in both); call `storeViewMode(mode)`, `setMode` on the control; then trigger an immediate aircraft layer rebuild
- [x] 3.3 Pass `modelsEnabled: viewModeRef.current === "3d"` to every `buildAircraftLayers` call
- [x] 3.4 In the `style.load` / `setupStyleDependentState` path honor `viewModeRef` for terrain and pitch

## 3b. 2D rotor animation: atlas/IconLayer approach (SUPERSEDED by section 3d)

Superseded by the inline-SVG DOM design (design.md Decisions 7 and 10). Already-implemented code for these items is to be removed by 3d.7 -- 3d.8; they are retained here for history only.

- [x] ~~3b.1 `aircraftIcons.ts`: atlas-build rotor split, `<KEY>#<rotorId>` entries, pivot anchors, `rotorBindingsByType`~~ SUPERSEDED (removed by 3d.7)
- [x] 3b.2 `constants.ts`: `ROTOR_DEFAULT_RPM=600` (parse fallback only) and `ROTOR_DISPLAY_REVS_PER_SECOND=1`; rpm not used for speed (KEPT, used by 3d.1)
- [x] ~~3b.3 `aircraftLayer.ts` rotor-binding `IconLayer` with `getPixelOffset` and deck.gl angle sign inversion~~ SUPERSEDED (removed by 3d.7)
- [x] ~~3b.4 `MapView.tsx` rAF loop that rebuilds rotor layers~~ SUPERSEDED (replaced by 3d.4)
- [x] 3b.5 Remove the generic A7 rotor-disc accent layer, its atlas glyph, and its MapView rAF wiring (STILL APPLIES)
- [x] ~~3b.6 Verify hub stays fixed under atlas hub-offset math~~ SUPERSEDED (see 3d.9)

## 3c. Flat altitude in 2D

- [x] 3c.1 `aircraftLayer.ts`: `altitudeToRenderMeters(alt, flat)` returns 0 when flat; `buildAircraftLayers` passes `flat = !modelsEnabled` to icon, icon-glow, track and dropline positions; `buildSelectionPulseLayer` takes `flat`; `MapView.tsx` passes `viewModeRef.current === "2d"` from the pulse rAF loop and the focus offset (rotor-binding layer parts of this task are superseded by 3d.7)
- [x] 3c.2 Unit test: icon/track z is 0 in 2D and altitude-lifted in 3D

## 3d. 2D inline-SVG DOM markers (supersedes 3b)

- [ ] 3d.1 Add `components/map/rotorSpin.ts`: `readRotorBindings(svgRoot)` (`[data-rotor]`, pivot `"x y"` in viewBox units, `sign = cw ? 1 : -1`, direction read per rotor, rpm ignored, invalid pivot skipped), `applyRotorSpin(bindings, tSeconds)` setting `transform="rotate(deg cx cy)"` with `deg = sign*360*ROTOR_DISPLAY_REVS_PER_SECOND*t % 360`, and `resetRotors`
- [ ] 3d.2 Add `components/map/aircraft2dMarkers.ts` marker manager: per-type SVG text fetch + cache from `public/aircraft-shapes`, per-marker `cloneNode`, MapLibre `Marker` (`anchor:"center"`, `rotationAlignment:"map"`), `setLngLat`/`setRotation(track)` per refresh, tint via `--aircraft-tint` CSS custom property applied to the whole SVG including rotors (add CSS rule), highlight class for selected
- [ ] 3d.3 Culling, cap and pool in the manager: viewport bounds + `MARKER_VIEWPORT_PADDING` (15%), re-evaluate on refresh and debounced `moveend`/`zoomend`; `MAX_2D_DOM_MARKERS = 300` in `constants.ts` with priority selected, hovered, then nearest to center; pooled elements keyed by aircraft id with a free list by type key; markers not yet SVG-loaded fall back to `IconLayer`
- [ ] 3d.4 Single shared rAF rotor loop in the manager (common `performance.now()` clock, optionally ~30 fps cap); runs only in 2D with at least one bound marker; stops on switch to 3D, when none, and on unmount; DOM attribute writes only, no deck.gl `setProps`
- [ ] 3d.5 Interaction: marker `click` -> existing select handler (stop propagation), `mouseenter`/`mouseleave` -> existing hover/tooltip state; selection pulse, tracks, droplines keep working (flat altitude)
- [ ] 3d.6 `MapView.tsx`: instantiate the manager, call `update(aircraft, { selectedId, hoveredId, colorFor })` from every aircraft refresh while in 2D, pass its `domMarkerIds` into `buildAircraftLayers` so the `IconLayer` data excludes marker-held ids (glow still draws all); on toggle to 3D call `clear()`; on unmount `destroy()`
- [ ] 3d.7 Remove superseded code: rotor-binding `IconLayer` (`buildRotorBindingLayer`) and its `getPixelOffset`/angle-inversion math in `aircraftLayer.ts`; rotor layer-rebuild rAF loop in `MapView.tsx`; atlas split, `<KEY>#<rotorId>` entries, anchors and `rotorBindingsByType` in `aircraftIcons.ts` (atlas icons become the full static SVG with rotors in place)
- [ ] 3d.8 Remove now-unused constants/helpers tied to the atlas approach; keep `ROTOR_DISPLAY_REVS_PER_SECOND` and `ROTOR_DEFAULT_RPM`; the prior atlas-time parse helper is removable unless reused by `rotorSpin.ts`
- [ ] 3d.9 Manual verify on a two-rotor contra-rotating SVG and an off-center single-rotor SVG: rotors spin about their own pivots in declared direction, hub stays on fuselage under track and bearing changes, tint is uniform, pan/zoom keeps markers aligned

## 4. Tests

- [x] 4.1 Unit test: `buildAircraftLayers` with `modelsEnabled=false` returns no scenegraph layers and includes every aircraft in the icon layer data
- [x] 4.2 Control test: clicking the toggle button calls `onToggle`; label/aria reflect mode; compass button behavior is unmodified (no listener attached to it)
- [ ] 4.2b Storage test (pattern of `test/drawerWidth.test.ts`): default `"3d"` when unset/invalid/unavailable, round-trips `"2d"`, restored on mount
- [ ] ~~4.3 (old) atlas-split tests: pivot-pixel math, deck.gl angle sign, rotor layer angle across ticks, fuselage entry without `[data-rotor]`~~ SUPERSEDED by 4.3b -- 4.3e
- [ ] 4.3b Unit tests for `rotorSpin.ts`: `readRotorBindings` (pivot parse, cw/ccw sign, direction never assumed, mirror ids, rpm ignored, no-binding SVG returns empty, tail-rotor/prop SVG yields none); `applyRotorSpin` writes `rotate(deg cx cy)` with a non-zero viewBox-origin pivot unchanged (viewBox units), `cw` positive and `ccw` negative, 1 rev/s regardless of rpm, `resetRotors` removes the attribute
- [ ] 4.3c Marker manager tests (jsdom + mocked MapLibre `Marker`): tint applied to whole SVG including rotor groups; no-binding SVG gets no transform and no added elements; culling excludes out-of-bounds aircraft; cap at `MAX_2D_DOM_MARKERS` leaves overflow ids out of `domMarkerIds` and in `IconLayer` data; selected aircraft always gets a marker; pooling reuses the element/Marker for the same id across polls; `clear()` removes all markers and stops the rAF loop
- [ ] 4.3d `buildAircraftLayers`: ids in `domMarkerIds` are absent from icon layer data but present in the glow layer; no rotor-binding layer is ever produced; no synthesized rotor layer for an A7 aircraft without bindings
- [ ] 4.3e Interaction tests: marker click selects the aircraft and does not trigger map deselect; hover updates tooltip state
- [x] 4.4 Run existing test suite and `openspec validate map-2d-3d-toggle`

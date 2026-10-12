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

## 3b. 2D rotor animation (SVG rotor bindings)

Note: parsing, speed and direction follow the requester's rotor docs (see design.md Decision 7). Icon assets already carry `[data-rotor]` bindings (no re-export needed). Only top rotors are tagged; tail rotors/props never spin.

- [x] 3b.1 `aircraftIcons.ts`: at atlas build, query each type SVG for `[data-rotor]`; types with none are unchanged. For types with bindings, rasterize the fuselage with all `[data-rotor]` groups removed, and each rotor group as its own entry `<KEY>#<rotorId>` (same viewBox/canvas size), with `anchorX/anchorY` set to the pivot's pixel position (from `data-rotor-pivot`: subtract viewBox min-x/min-y, then scale by canvas/viewBox size; viewBox origin is usually non-zero). Export `rotorBindingsByType: Map<key, {id, pivot, sign, rpm}[]>` (sign: `cw`=+1, `ccw`=-1; rpm default 600). Handle `-mirror` ids and multiple rotors
- [x] 3b.2 `constants.ts`: `ROTOR_DEFAULT_RPM=600` (parse fallback only) and `ROTOR_DISPLAY_REVS_PER_SECOND=1`; the rpm is not used for speed (matches iconizer spin-toggle). `rotorRevsPerSecond`/`ROTOR_REVS_*` removed
- [x] 3b.3 `aircraftLayer.ts`: build a rotor `IconLayer` per distinct rotor binding (or one layer with per-instance icon key) for 2D-mode aircraft whose type has bindings: `getPosition` = aircraft position, `getPixelOffset` = pivot offset from fuselage center rotated by track, `getAngle` = `-(track) - spinDeg` where `spinDeg = sign*360*t % 360` (fixed 1 rev/s) is clockwise-positive (deck.gl angle is CCW-positive, so a `cw` rotor appears clockwise), clock via `updateTriggers`. The generic rotor-disc accent (`buildRotorAccentLayer`, `ROTOR_ACCENT` atlas glyph) is removed: no rotor is drawn that is not in the SVG. No rotor layers when `modelsEnabled` is true
- [x] 3b.4 `MapView.tsx`: rAF loop (cap ~30 fps) running only in 2D mode with rotor-bearing aircraft visible; updates only rotor layers; cancelled on switch to 3D, when none visible, and on unmount
- [x] 3b.5 Remove the generic A7 rotor-disc accent layer, its atlas glyph, and its MapView rAF wiring
- [x] 3b.6 Verify against at least one binding SVG with two contra-rotating rotors and one off-center single rotor that the hub stays fixed on the fuselage under track rotation and bearing changes

## 3c. Flat altitude in 2D

- [x] 3c.1 `aircraftLayer.ts`: `altitudeToRenderMeters(alt, flat)` returns 0 when flat; `buildAircraftLayers` passes `flat = !modelsEnabled` to icon, icon-glow,  rotor-binding, track and dropline positions; `buildRotorBindingLayer`/`buildRotorAccentLayer`/`buildSelectionPulseLayer` take `flat`; `MapView.tsx` passes `viewModeRef.current === "2d"` from the rotor and pulse rAF loops and the focus offset
- [x] 3c.2 Unit test: icon/track/rotor-binding z is 0 in 2D and altitude-lifted in 3D

## 4. Tests

- [x] 4.1 Unit test: `buildAircraftLayers` with `modelsEnabled=false` returns no scenegraph layers and includes every aircraft in the icon layer data
- [x] 4.2 Control test: clicking the toggle button calls `onToggle`; label/aria reflect mode; compass button behavior is unmodified (no listener attached to it)
- [ ] 4.2b Storage test (pattern of `test/drawerWidth.test.ts`): default `"3d"` when unset/invalid/unavailable, round-trips `"2d"`, restored on mount
- [ ] 4.3 Unit tests: binding parser (pivot, cw/ccw sign, rpm default, no-binding SVG unchanged, mirror ids, per-rotor direction never assumed, tail rotor/prop SVG yields no bindings); pivot-pixel math with a non-zero viewBox origin and non-1:1 canvas scale; deck.gl angle sign (`cw` => clockwise on screen); fixed 1 rev/s regardless of rpm; no synthesized rotor layer for an A7 aircraft without bindings; fuselage entry contains no `[data-rotor]`; rotor angle changes across clock ticks without new data
- [x] 4.4 Run existing test suite and `openspec validate map-2d-3d-toggle`

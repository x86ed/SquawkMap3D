## 1. Rendering

- [ ] 1.1 `components/map/aircraftLayer.ts`: add `modelsEnabled: boolean` to `buildAircraftLayers` params; when false, skip model resolution so all `positioned` aircraft go to `iconOnlyPositioned` and no `AnimatedAircraftScenegraphLayer` is created
- [ ] 1.2 `components/map/terrain.ts`: add `setTerrainEnabled(map, enabled)` (calls `applyTerrain` or `map.setTerrain(null)` plus sky handling); make the `style.load` path accept the current enabled state

## 2. Control

- [ ] 2.1 Add `VIEW_MODE_2D_PITCH = 0` to `components/map/constants.ts`
- [ ] 2.2 Add `components/map/viewMode.ts`: `ViewMode`, `VIEW_MODE_STORAGE_KEY = "squawkmap3d:viewMode"`, `getStoredViewMode`, `storeViewMode`, `getInitialViewMode` (default `"3d"`), same SSR-guard/try-catch shape as `components/map/theme.ts`
- [ ] 2.3 Add `components/map/viewModeControl.ts`: `ViewModeControl implements IControl` with its own button in a `maplibregl-ctrl-group` showing the current mode label ("2D"/"3D"), `title`/`aria-label` naming the target action, `setMode(mode)`, click -> `onToggle()`. No compass listener, no fallback logic. Add CSS so it matches the nav group in light and dark themes
- [ ] 2.4 `MapView.tsx`: keep `new NavigationControl(...)` (~line 668) unchanged; add `ViewModeControl` to `"top-left"` immediately after it

## 3. MapView wiring

- [ ] 3.1 Add `viewModeRef`/`viewMode` state pair initialised from `getInitialViewMode()` (like `getInitialTheme()` at lines ~157/249) and `savedPitchRef`; construct the map with pitch 0 / `maxPitch` 0 / no terrain when the restored mode is 2D
- [ ] 3.2 Toggle handler: 2D -> save pitch, `setMaxPitch(0)`, `easeTo({pitch:0})`, `setTerrainEnabled(false)`; 3D -> `setMaxPitch(MAX_PITCH)`, `setTerrainEnabled(true)`, `easeTo({pitch: saved ?? INITIAL_PITCH})` (bearing untouched in both); call `storeViewMode(mode)`, `setMode` on the control; then trigger an immediate aircraft layer rebuild
- [ ] 3.3 Pass `modelsEnabled: viewModeRef.current === "3d"` to every `buildAircraftLayers` call
- [ ] 3.4 In the `style.load` / `setupStyleDependentState` path honor `viewModeRef` for terrain and pitch

## 3b. 2D rotor animation (SVG rotor bindings)

Note: parsing and speed/direction details here are provisional; reconcile with the other-repo rotor docs when the requester provides them. Icon assets already carry `[data-rotor]` bindings (no re-export needed).

- [ ] 3b.1 `aircraftIcons.ts`: at atlas build, query each type SVG for `[data-rotor]`; types with none are unchanged. For types with bindings, rasterize the fuselage with all `[data-rotor]` groups removed, and each rotor group as its own entry `<KEY>#<rotorId>` (same viewBox/canvas size), with `anchorX/anchorY` set to the pivot's pixel position (from `data-rotor-pivot` via the viewBox->pixel scale). Export `rotorBindingsByType: Map<key, {id, pivot, sign, rpm}[]>` (sign: `cw`=+1, `ccw`=-1; rpm default 600). Handle `-mirror` ids and multiple rotors
- [ ] 3b.2 `constants.ts`: `ROTOR_DEFAULT_RPM=600`, `ROTOR_REVS_AT_DEFAULT=2.5`, `ROTOR_REVS_MIN=1`, `ROTOR_REVS_MAX=4`; add pure helper `rotorRevsPerSecond(rpm)` = `clamp(rpm/600*2.5, 1, 4)`
- [ ] 3b.3 `aircraftLayer.ts`: build a rotor `IconLayer` per distinct rotor binding (or one layer with per-instance icon key) for 2D-mode aircraft whose type has bindings: `getPosition` = aircraft position, `getPixelOffset` = pivot offset from fuselage center rotated by track, `getAngle` = fuselage angle plus per-rotor spin from a per-frame clock via `updateTriggers`. Generic rotor-disc accent kept only as fallback for A7 aircraft lacking bindings. No rotor layers when `modelsEnabled` is true
- [ ] 3b.4 `MapView.tsx`: rAF loop (cap ~30 fps) running only in 2D mode with rotor-bearing aircraft visible; updates only rotor layers; cancelled on switch to 3D, when none visible, and on unmount
- [ ] 3b.5 Update the stale per-poll-spin comment in `aircraftLayer.ts` (rotor accent)
- [ ] 3b.6 Verify against at least one binding SVG with two contra-rotating rotors and one off-center single rotor that the hub stays fixed on the fuselage under track rotation and bearing changes

## 4. Tests

- [ ] 4.1 Unit test: `buildAircraftLayers` with `modelsEnabled=false` returns no scenegraph layers and includes every aircraft in the icon layer data
- [ ] 4.2 Control test: clicking the toggle button calls `onToggle`; label/aria reflect mode; compass button behavior is unmodified (no listener attached to it)
- [ ] 4.2b Storage test (pattern of `test/drawerWidth.test.ts`): default `"3d"` when unset/invalid/unavailable, round-trips `"2d"`, restored on mount
- [ ] 4.3 Unit tests: binding parser (pivot, cw/ccw sign, rpm default, no-binding SVG unchanged, mirror ids); `rotorRevsPerSecond` clamp at 1 and 4 and 600->2.5; fuselage entry contains no `[data-rotor]`; rotor angle changes across clock ticks without new data
- [ ] 4.4 Run existing test suite and `openspec validate map-2d-3d-toggle`

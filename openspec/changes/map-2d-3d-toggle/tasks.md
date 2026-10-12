## 1. Rendering

- [ ] 1.1 `components/map/aircraftLayer.ts`: add `modelsEnabled: boolean` to `buildAircraftLayers` params; when false, skip model resolution so all `positioned` aircraft go to `iconOnlyPositioned` and no `AnimatedAircraftScenegraphLayer` is created
- [ ] 1.2 `components/map/terrain.ts`: add `setTerrainEnabled(map, enabled)` (calls `applyTerrain` or `map.setTerrain(null)` plus sky handling); make the `style.load` path accept the current enabled state

## 2. Control

- [ ] 2.1 Add `VIEW_MODE_2D_PITCH = 0` to `components/map/constants.ts`
- [ ] 2.2 Add `components/map/viewModeControl.ts`: `ViewModeNavigationControl extends NavigationControl` with capture-phase click on `.maplibregl-ctrl-compass` doing `easeTo({bearing:0})` + `onToggle()`, mode text label, `aria-label`/`title` updates via `setMode(mode)`; null-guard fallback adds a button to the same group
- [ ] 2.3 `MapView.tsx`: replace `new NavigationControl(...)` (~line 668) with `ViewModeNavigationControl`, same options

## 3. MapView wiring

- [ ] 3.1 Add `viewModeRef`/`viewMode` state pair (default `"3d"`) and `savedPitchRef`
- [ ] 3.2 Toggle handler: 2D -> save pitch, `setMaxPitch(0)`, `easeTo({pitch:0,bearing:0})`, `setTerrainEnabled(false)`; 3D -> `setMaxPitch(MAX_PITCH)`, `setTerrainEnabled(true)`, `easeTo({pitch: saved ?? INITIAL_PITCH, bearing:0})`; then trigger an immediate aircraft layer rebuild
- [ ] 3.3 Pass `modelsEnabled: viewModeRef.current === "3d"` to every `buildAircraftLayers` call
- [ ] 3.4 In the `style.load` / `setupStyleDependentState` path honor `viewModeRef` for terrain and pitch

## 3b. 2D rotor animation

- [ ] 3b.1 `aircraftLayer.ts`: add `hasVerticalRotors(a)` (category A7 OR type in `VERTICAL_ROTOR_TYPES`) and use it to filter the rotor layer data instead of the category-only check; add `VERTICAL_ROTOR_TYPES` to `constants.ts` or `aircraftModels.ts`
- [ ] 3b.2 `aircraftIcons.ts`: for SVGs/types with rotor blades, emit a fuselage-only atlas entry plus a `<KEY>:rotor` blades-only entry (same canvas size, hub aligned); keep `ROTOR_ACCENT_KEY` as fallback; document hub offset handling for tandem/tail rotors
- [ ] 3b.3 Rotor `IconLayer`: `getIcon` resolves the per-type blade sprite; `getAngle` driven by a per-frame clock via `updateTriggers`
- [ ] 3b.4 `MapView.tsx`: rAF loop (cap ~30 fps) that rebuilds/updates only the rotor layer while `viewMode === "2d"` and rotorcraft are visible; cancel on 3D switch and unmount; keeps spinning between polls
- [ ] 3b.5 Update the existing per-poll comment in `aircraftLayer.ts` (Decision 8 text) that says the spin is stepped per poll

## 4. Tests

- [ ] 4.1 Unit test: `buildAircraftLayers` with `modelsEnabled=false` returns no scenegraph layers and includes every aircraft in the icon layer data
- [ ] 4.2 Control test: compass click calls `onToggle` and does not trigger default reset-north-pitch; label reflects mode
- [ ] 4.3 Unit test: `hasVerticalRotors` for A7, a helicopter type, a tiltrotor, and a fixed-wing; rotor layer `getAngle` changes across clock ticks without new data
- [ ] 4.4 Run existing test suite and `openspec validate map-2d-3d-toggle`

## Why

The map only renders in a tilted 3D perspective (`INITIAL_PITCH = 60`, `MAX_PITCH = 85`) with 3D terrain and 3D aircraft models. Users want a flat, dead-on top-down view where aircraft are drawn as the app's existing 2D SVG-derived icons, and a one-click way to switch between the two.

## What Changes

- Add a **2D/3D view mode** to the map, default `3d` (current behavior unchanged).
- In `2d` mode: camera pitch is forced to 0 and pitch gestures are disabled (`maxPitch` set to 0); 3D terrain exaggeration is disabled so the view is truly top-down; aircraft render as 2D icons only (the vendored `.glb` ScenegraphLayer groups are skipped, so every aircraft goes through the existing `IconLayer` path).
- In `3d` mode (default): previous pitch is restored (or `INITIAL_PITCH` if none was saved), `maxPitch` returns to `MAX_PITCH`, terrain and `.glb` models return.
- **Toggle UI**: an ADDITIONAL button added to the top-left control group directly after the existing `NavigationControl`, styled to match. It shows the current mode label ("2D"/"3D") and clicking it flips the mode. The compass keeps its normal reset-north behavior in both modes and is NOT the toggle.
- **Persistence**: the chosen mode is persisted in `localStorage` like the theme and drawer width (`squawkmap3d:viewMode`), defaults to `3d`, and is restored on load.
- Selected-aircraft overlay, tracks, and other layers are unaffected.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `map-view`: adds a 2D/3D view-mode requirement and its toggle control; the "3D perspective" requirement's default stays 3D but gains the 2D exception.
- `aircraft-tracks-layer`: aircraft model-vs-icon selection becomes dependent on view mode.

## Impact

- `components/map/MapView.tsx`: `viewMode` ref/state pair initialised from the stored value (ref read in style-swap/poll callbacks, per existing pattern); toggle handler that also persists the mode; adding the toggle control to the top-left group alongside the unchanged `NavigationControl` (line ~668); pass `viewMode` into `buildAircraftLayers`; reapply terrain state after `style.load`.
- `components/map/aircraftLayer.ts`: `buildAircraftLayers` gains a `modelsEnabled: boolean` param; when false, all positioned aircraft go into `iconOnlyPositioned` and no `AnimatedAircraftScenegraphLayer` is built.
- `components/map/terrain.ts`: add `setTerrainEnabled(map, enabled)` (or equivalent) used by the toggle and by `applyTerrain` on style reload.
- `components/map/constants.ts`: `VIEW_MODE_2D_PITCH = 0`.
- New `components/map/viewMode.ts` (`ViewMode` type, `VIEW_MODE_STORAGE_KEY`, `getStoredViewMode`, `storeViewMode`, mirroring `theme.ts`).
- New control module `components/map/viewModeControl.ts` (class implementing MapLibre `IControl`; separate button, does not touch the compass).
- Tests: unit tests for `buildAircraftLayers` with `modelsEnabled=false`; toggle control test; view-mode storage helper test.
- No new dependencies. Next.js specifics not touched (client component only).

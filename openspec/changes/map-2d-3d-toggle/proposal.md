## Why

The map only renders in a tilted 3D perspective (`INITIAL_PITCH = 60`, `MAX_PITCH = 85`) with 3D terrain and 3D aircraft models. Users want a flat, dead-on top-down view where aircraft are drawn as the app's existing 2D SVG-derived icons, and a one-click way to switch between the two.

## What Changes

- Add a **2D/3D view mode** to the map, default `3d` (current behavior unchanged).
- In `2d` mode: camera pitch is forced to 0 and pitch gestures are disabled (`maxPitch` set to 0); 3D terrain exaggeration is disabled so the view is truly top-down; aircraft render as 2D icons only (the vendored `.glb` ScenegraphLayer groups are skipped, so every aircraft goes through the existing `IconLayer` path).
- In `3d` mode: previous pitch is restored (or `INITIAL_PITCH` if none was saved), `maxPitch` returns to `MAX_PITCH`, terrain and `.glb` models return.
- **Toggle UI**: extend the existing top-left `NavigationControl` button group. The compass ("reset north") button becomes the 2D/3D toggle: clicking it resets bearing to north AND flips the mode. The button shows the current mode label ("2D"/"3D"). The acceptance-criteria wording ("click to reset north should serve as the toggle") is interpreted this way; if a separate extra button is wanted instead, only task 2 changes.
- Selected-aircraft overlay, tracks, and other layers are unaffected.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `map-view`: adds a 2D/3D view-mode requirement and its toggle control; the "3D perspective" requirement's default stays 3D but gains the 2D exception.
- `aircraft-tracks-layer`: aircraft model-vs-icon selection becomes dependent on view mode.

## Impact

- `components/map/MapView.tsx`: `viewMode` ref/state pair (ref read in style-swap/poll callbacks, per existing pattern); toggle handler; replacement of the compass click behavior on the `NavigationControl` (line ~668); pass `viewMode` into `buildAircraftLayers`; reapply terrain state after `style.load`.
- `components/map/aircraftLayer.ts`: `buildAircraftLayers` gains a `modelsEnabled: boolean` param; when false, all positioned aircraft go into `iconOnlyPositioned` and no `AnimatedAircraftScenegraphLayer` is built.
- `components/map/terrain.ts`: add `setTerrainEnabled(map, enabled)` (or equivalent) used by the toggle and by `applyTerrain` on style reload.
- `components/map/constants.ts`: `VIEW_MODE_2D_PITCH = 0`.
- New control module `components/map/viewModeControl.ts` (class extending MapLibre `NavigationControl`).
- Tests: unit tests for `buildAircraftLayers` with `modelsEnabled=false`; control behavior test.
- No new dependencies. Next.js specifics not touched (client component only).

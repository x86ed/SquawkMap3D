## Context

`MapView.tsx` constructs `MapLibreMap` with `pitch: INITIAL_PITCH` / `maxPitch: MAX_PITCH` and adds a `NavigationControl({ showZoom, showCompass, visualizePitch: true })` at `top-left`. Aircraft are drawn by `buildAircraftLayers` (`aircraftLayer.ts`) via a deck.gl `MapboxOverlay` (non-interleaved): aircraft with a loaded `.glb` go to `AnimatedAircraftScenegraphLayer` groups, the rest to `IconLayer` (+ glow/rotor). The 2D icon path already exists and is kept as the fallback for unmodeled types, so 2D mode needs no new rendering code. Terrain is applied by `applyTerrain(map)` in `terrain.ts` on every `style.load`.

## Decisions

### 1. View mode is a ref/state pair, default `3d`
Same pattern as other toggles (`terrainOutlineVisibleRef` + state). Ref is read in `style.load` and poll callbacks. Not persisted across reloads (no existing persistence for camera state).

### 2. Toggle = the compass (reset-north) button
`NavigationControl` has no hook for compass click. Create `components/map/viewModeControl.ts`: `class ViewModeNavigationControl extends NavigationControl` taking `{ getMode, onToggle }`. In `onAdd`, call `super.onAdd`, find the compass button (`.maplibregl-ctrl-compass`), and attach a capture-phase `click` listener that calls `stopImmediatePropagation()`, then `map.easeTo({ bearing: 0 })` and `onToggle()`. This both resets north and toggles. The button gets a text label child showing "2D"/"3D" and `title`/`aria-label` of "Switch to 2D view"/"Switch to 3D view" (plus "reset north"). Alternative rejected: a separate sibling button, because the requirement says the reset-north click serves as the toggle and to extend the existing group.

### 3. Entering 2D
`map.setMaxPitch(0)` then `map.easeTo({ pitch: 0, bearing: 0, duration: ~500 })`; save prior pitch in a ref first. Disable terrain via `map.setTerrain(null)` and sky off, since terrain relief at pitch 0 would still displace deck.gl icons relative to the flat basemap. `visualizePitch` stays on (compass rotates with bearing only at pitch 0). In 2D, `dragRotate`/`touchPitch` remain enabled for bearing but pitch cannot change because `maxPitch` is 0.

### 4. Entering 3D
`map.setMaxPitch(MAX_PITCH)`, re-run `applyTerrain(map)`, `easeTo({ pitch: savedPitch ?? INITIAL_PITCH })`. Bearing is left at north (just reset).

### 5. Models off in 2D
`buildAircraftLayers` gets `modelsEnabled`. When false, skip `resolveModelScenegraph` and push every aircraft to `iconOnlyPositioned`. Triggers an immediate layer rebuild on toggle (call the same refresh used on poll) so the swap is not delayed to the next ~1 Hz poll. The icon layer's `billboard: false` flat-in-ground-plane behavior is already correct at pitch 0 (top-down, nose-up icon rotated by track).

### 6. Style swaps
`style.load` handler (`setupStyleDependentState`) must consult `viewModeRef` when applying terrain, so theme/pilot-mode switches in 2D don't re-enable terrain.

## Risks
- Overriding the compass click via capture listener depends on MapLibre's DOM class name; guard with null check and fall back to adding a plain button to the same group.
- `setMaxPitch(0)` while pitched clamps immediately in some versions; call `setPitch`/`easeTo` before or rely on the clamp (verify with MapLibre 6.5 docs).

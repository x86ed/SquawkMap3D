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

### 7. Rotor animation in 2D (added; driven by SVG rotor bindings)
Exported icon SVGs for helicopters/drones/etc. with top-mounted rotors carry inert bindings: each rotor is `<g data-rotor="r1" data-rotor-pivot="x y" data-rotor-direction="cw|ccw" data-rotor-rpm="600">` wrapping its paths (pivot in viewBox user units; mirrored copies are `<id>-mirror`; SVGs without a top rotor have none and must be left unchanged; tail rotors/props are never tagged). These bindings, not the ADS-B emitter category, define which aircraft spin and how. Contract details and the reference `src/rotor-animation.ts` (`parseRotorBindings`, `readRotorBindings`, `applyRotorSpin`, `spinAngleDeg`) come from the SVG export instructions supplied by the requester.

Current state: the 2D rotor is a small generic rotor-disc `IconLayer` (`AIRCRAFT_ROTOR_ACCENT_LAYER_ID`, `aircraftLayer.ts` ~line 447) filtered to `category === ROTORCRAFT_CATEGORY`, with a per-poll stepped `getAngle`. This is replaced for any type whose SVG has `[data-rotor]` groups.

Why not just animate the inline SVG: icons are rasterized once into a single deck.gl `IconLayer` atlas (`aircraftIcons.ts`), so DOM `transform` attributes / SMIL cannot animate them. The bindings are used at atlas-build time instead, and the spin is applied in deck.gl.

Decisions:
- **Parsing (atlas build, `aircraftIcons.ts`)**: for each type SVG, query `[data-rotor]`. If none, behave exactly as today (single entry, no rotor sprites). If present: (a) rasterize the fuselage entry with all `[data-rotor]` groups removed so blades are not baked in and double-drawn; (b) rasterize each rotor group as its own atlas entry `<KEY>#<rotorId>` on a canvas the same size/viewBox as the fuselage, so the pivot's position within the sprite is `data-rotor-pivot` mapped through the same viewBox->pixel scale. Record per type `{ id, pivot: [x,y] in viewBox units, sign: cw?1:-1, rpm }[]` in an exported `rotorBindingsByType` map alongside the atlas mapping.
- **Rotation about the pivot, not the sprite center**: deck.gl `IconLayer` rotates about the icon anchor. Set each rotor entry's `anchorX/anchorY` in the atlas mapping to the pivot's pixel position inside its sprite (`iconMapping[...].anchorX/anchorY`), so `getAngle` spins it about the hub while `getPosition` places the hub. Because the fuselage sprite uses the default centered anchor, the rotor layer needs a per-instance pixel offset (`getPixelOffset`) equal to (pivot - viewBox center) scaled to icon size, rotated by the aircraft's track (fuselage orientation), so the hub stays attached to the fuselage as the aircraft heads change. Alternative: render rotor sprites with the same full-canvas size and same centered anchor as the fuselage and spin them about the canvas center only when the pivot is the center; rejected because pivots are generally off-center (tandem, twin-rotor drones).
- **Two angles per instance**: rotor `getAngle = -(track) + spinSign * spinDeg`-style composition, taking care of deck.gl's CCW-positive `angle` (see the existing `getAngle: -(d.track ?? 0)` comment; SVG `+angle` is clockwise, so flip sign accordingly) — rotor angle = fuselage angle plus the rotor's own spin about its pivot.
- **Speed**: `revsPerSecond = clamp(rpm / 600 * 2.5, 1, 4)`, per-rotor, sign from `data-rotor-direction` (never assume direction; contra-rotating pairs have opposite directions). Constants `ROTOR_DEFAULT_RPM = 600`, `ROTOR_REVS_MIN = 1`, `ROTOR_REVS_MAX = 4`, `ROTOR_REVS_AT_DEFAULT = 2.5` in `constants.ts`. Spin angle = `(sign * revs * 360 * tSeconds) % 360`.
- **Per-frame, not per-poll**: while `viewMode === "2d"` and at least one rendered aircraft has rotor bindings, a rAF loop (capped ~30 fps) bumps a frame tick and updates only the rotor layers (via `updateTriggers: { getAngle: tick }` and `deckOverlay.setProps({ layers })` with the cached non-rotor layers reused), not the full per-poll rebuild. Loop stops on switch to 3D, when no rotorcraft are visible, and on unmount.
- **Fallback**: aircraft the app already treats as rotorcraft (category A7) whose SVG has no `[data-rotor]` bindings keep the existing generic rotor-disc accent, now also per-frame instead of per-poll, so nothing regresses. Fixed-wing aircraft and SVGs without bindings never get rotor animation.
- **Not needed in 3D**: `AnimatedAircraftScenegraphLayer` already animates "Rotors" nodes per frame; 3D and 2D direction should agree since SVG direction matches the GLB `extras.rotor`.

## Context

`MapView.tsx` constructs `MapLibreMap` with `pitch: INITIAL_PITCH` / `maxPitch: MAX_PITCH` and adds a `NavigationControl({ showZoom, showCompass, visualizePitch: true })` at `top-left`. Aircraft are drawn by `buildAircraftLayers` (`aircraftLayer.ts`) via a deck.gl `MapboxOverlay` (non-interleaved): aircraft with a loaded `.glb` go to `AnimatedAircraftScenegraphLayer` groups, the rest to `IconLayer` (+ glow/rotor). The 2D icon path exists for unmodeled types; in 2D mode aircraft are now drawn primarily as inline-SVG DOM markers (Decision 10) with the `IconLayer` retained as the above-cap fallback and for glow. Terrain is applied by `applyTerrain(map)` in `terrain.ts` on every `style.load`.

## Decisions

### 1. View mode is a ref/state pair, default `3d`
Same pattern as other toggles (`terrainOutlineVisibleRef` + state). Ref is read in `style.load` and poll callbacks. Initial value comes from `getStoredViewMode() ?? "3d"` (see Decision 8); the map is constructed already in the restored mode (pitch/maxPitch/terrain per mode) so there is no 3D flash when 2D was saved.

### 2. Toggle = separate additional button in the top-left group
The existing `NavigationControl({ showZoom, showCompass, visualizePitch: true })` is left untouched; the compass keeps MapLibre's default reset-north behavior in both 2D and 3D (reset bearing; in 3D `visualizePitch` also resets pitch as today). There is no capture-phase listener, no compass hijack, and no fallback-button logic.

Create `components/map/viewModeControl.ts`: `class ViewModeControl implements IControl` taking `{ getMode, onToggle }`. `onAdd(map)` returns a new `div.maplibregl-ctrl.maplibregl-ctrl-group` containing a single `button.maplibregl-ctrl-view-mode` whose text is the current mode label ("2D"/"3D"); `title`/`aria-label` is the action ("Switch to 2D view"/"Switch to 3D view"). Clicking calls `onToggle()`. `setMode(mode)` updates label and aria text. Styling matches the neighbors: same `maplibregl-ctrl-group` class gives the border/shadow/size; a small CSS rule for `.maplibregl-ctrl-view-mode` sets font (bold ~12px), centered text, and dark-theme colors consistent with how the app already styles MapLibre controls (check existing global CSS for `.maplibregl-ctrl-group` overrides and reuse them).

Placement: add with `map.addControl(viewModeControl, "top-left")` immediately after the `NavigationControl` so MapLibre stacks it directly below as part of the same top-left column (MapLibre appends controls in add order within a corner). If visual grouping requires a single joined group, `onAdd` may instead return a container that visually continues the nav group; either is acceptable provided spacing and styling match. The label shows the CURRENT mode (initially "3D"); the aria-label states the target action.

### 3. Entering 2D
`map.setMaxPitch(0)` then `map.easeTo({ pitch: 0, duration: ~500 })`; save prior pitch in a ref first. Disable terrain via `map.setTerrain(null)` and sky off, since terrain relief at pitch 0 would still displace deck.gl icons relative to the flat basemap. Bearing is NOT forced to 0 by the toggle (the compass owns reset-north); the user may keep any bearing. Pitch is 0 and locked: `dragRotate`/`touchPitch` remain enabled for bearing but pitch cannot change because `maxPitch` is 0. Compass remains reset-north in 2D (bearing only).

### 4. Entering 3D
`map.setMaxPitch(MAX_PITCH)`, re-run `applyTerrain(map)`, `easeTo({ pitch: savedPitch ?? INITIAL_PITCH })`. Bearing is left unchanged.

### 5. Models off in 2D
`buildAircraftLayers` gets `modelsEnabled`. When false, skip `resolveModelScenegraph` and push every aircraft to `iconOnlyPositioned`; the icon layer data is then `iconOnlyPositioned` minus the ids currently holding a DOM marker (Decision 10), so the `IconLayer` draws only above-cap fallback aircraft (the glow layer still draws all). Triggers an immediate layer rebuild on toggle (call the same refresh used on poll) so the swap is not delayed to the next ~1 Hz poll. The icon layer's `billboard: false` flat-in-ground-plane behavior is already correct at pitch 0 (top-down, nose-up icon rotated by track).

### 6. Style swaps
`style.load` handler (`setupStyleDependentState`) must consult `viewModeRef` when applying terrain, so theme/pilot-mode switches in 2D don't re-enable terrain.

## Risks
- Visual match of the added button with the MapLibre nav group depends on MapLibre control CSS; verify in both light and dark themes.
- `setMaxPitch(0)` while pitched clamps immediately in some versions; call `setPitch`/`easeTo` before or rely on the clamp (verify with MapLibre 6.5 docs).

### 8. Persistence via localStorage helper
Existing user prefs use a per-feature module with a namespaced key and SSR-guarded, try/catch-wrapped `localStorage` accessors: `components/map/theme.ts` (`THEME_STORAGE_KEY = "squawkmap3d:theme"`, `getStoredTheme`/`storeTheme`, read on mount via `getInitialTheme()` in `useRef`/`useState` initialisers at `MapView.tsx` lines ~157/249) and `components/map/drawer/drawerWidth.ts` (`squawkmap3d:layerDrawer:width`). The view mode follows exactly this: new `components/map/viewMode.ts` exports `VIEW_MODE_STORAGE_KEY = "squawkmap3d:viewMode"`, `type ViewMode = "2d" | "3d"`, `getStoredViewMode(): ViewMode | null` (null when SSR, unavailable, or any value other than `"2d"`/`"3d"`), `storeViewMode(mode)`, and `getInitialViewMode()` returning stored ?? `"3d"`. The toggle handler calls `storeViewMode` (as `storeTheme` is called at line ~967). Unavailable storage degrades silently to non-persistence.

### 7. Rotor animation in 2D (REVISED: the SVG animates itself)
Superseded approach (removed): rasterizing each SVG into the deck.gl atlas as a white mask, splitting rotor groups into separate atlas entries (`<KEY>#<rotorId>`), `rotorBindingsByType`, pivot-pixel anchors, `getPixelOffset` hub offsets, deck.gl CCW angle sign inversion, and a rAF loop that rebuilt rotor layers. That did not animate the SVG itself, lost the SVG's own styling, and diverged from the iconizer. The earlier generic A7 rotor-disc accent also stays removed.

Reference: iconizer `3D-modeler/src/rotor-animation.ts` (`readRotorBindings` + `applyRotorSpin`, which set `transform="rotate(deg cx cy)"` on live `[data-rotor]` groups) and the `spin-toggle` in its `preview.ts`.

New behavior:
- **Bindings**: each icon SVG may carry `<g data-rotor="r1" data-rotor-pivot="x y" data-rotor-direction="cw|ccw" data-rotor-rpm="600">` groups (pivot in viewBox user units; mirrored copies `<id>-mirror`; only top rotors are tagged; tail rotors/props never). Whether a type has bindings is determined by querying the SVG, never from aircraft category.
- **`components/map/rotorSpin.ts`**: `readRotorBindings(svgRoot): { el: SVGGElement; cx: number; cy: number; sign: 1 | -1 }[]` (query `[data-rotor]`, parse pivot `"x y"`, `sign = direction === "cw" ? 1 : -1`; rpm may be parsed but is ignored; groups with an unparsable pivot are skipped) and `applyRotorSpin(bindings, tSeconds)`: `deg = (sign * 360 * ROTOR_DISPLAY_REVS_PER_SECOND * tSeconds) % 360`, then `el.setAttribute("transform", \`rotate(${deg} ${cx} ${cy})\`)`. A `resetRotors` helper removes the `transform` attribute. The attribute form with pivot in viewBox units is used (not CSS `transform-origin`/SMIL, which are viewBox-relative and wrong for non-zero viewBox origins). There is no atlas split, no hub-offset math and no deck.gl angle sign inversion: SVG `rotate()` is clockwise-positive, so `cw` => positive angle => clockwise on screen, and the marker's own rotation by track is a plain CSS/MapLibre rotation of the whole element.
- **Speed/direction**: fixed `ROTOR_DISPLAY_REVS_PER_SECOND = 1` (kept in `constants.ts`) for every rotor, RPM ignored (matches iconizer spin-toggle). Direction is read per rotor from `data-rotor-direction`; contra-rotating pairs get opposite signs.
- **No synthesized rotors**: SVGs without bindings render static exactly as drawn; there is no generic rotor disc, fallback glyph, or glow-derived rotor. Fixed-wing aircraft never animate.
- **Shared rAF loop**: one `requestAnimationFrame` loop owned by the marker manager (Decision 10), running only while in 2D and at least one live marker has bindings. Each frame it calls `applyRotorSpin` for every binding-bearing marker using a common `performance.now()` clock (optionally throttled to ~30 fps). It touches only DOM attributes; no deck.gl layer rebuild or `setProps`. Stops on switch to 3D, when no bound marker exists, and on unmount; markers removed from the DOM are dropped from the loop.
- **Not needed in 3D**: `AnimatedAircraftScenegraphLayer` already animates "Rotors" nodes per frame. (Whether the 3D rotor rate changes is a separate pending decision and is NOT specified here.) 3D and 2D direction agree since SVG direction matches GLB `extras.rotor`.

### 10. Inline SVG DOM markers in 2D (new)
**Element**: for each marker, a `div.aircraft-2d-marker` wrapping an inline `<svg>` created from the vendored per-type SVG text in `public/aircraft-shapes` (the same file the atlas uses; type -> file via the existing icon resolution order). SVG text is fetched once per type key, cached, and parsed with `DOMParser`; each marker gets its own `cloneNode(true)` so rotor transforms are per-instance (bindings are read once per element at creation and stored on the marker record). Positioning uses MapLibre `new Marker({ element, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" })` with `setLngLat([lon, lat])` and `setRotation(track ?? 0)`; MapLibre repositions markers on map move/zoom/rotate, so no per-frame JS positioning is needed. Because 2D pitch is 0, no altitude lift or perspective applies (consistent with Decision 9). Icon pixel size matches the current `IconLayer` icon size (reuse the existing size constant) so the swap is visually consistent.

**Tint**: the aircraft's colour (same altitude/colour-mode value that feeds `getColor` today) is applied to the whole SVG, rotors included, as one tint: set a CSS custom property `--aircraft-tint` on the marker element and a rule `.aircraft-2d-marker svg * { fill: var(--aircraft-tint) }` (plus stroke if the shapes use stroke), so rotor groups are tinted exactly like the rest. No separate rotor treatment. Tint is updated per poll or when colour mode/theme changes.

**Culling**: only aircraft whose position lies inside `map.getBounds()` expanded by `MARKER_VIEWPORT_PADDING` (default 15% each side, computed in screen pixels via `map.project`) get markers. Re-evaluated on every aircraft refresh and on map `moveend` (and `zoomend`), debounced to ~100 ms; markers whose aircraft leave bounds are returned to the pool.

**Cap and fallback**: `MAX_2D_DOM_MARKERS = 300` (constant in `constants.ts`). If more aircraft are visible, markers go first to the selected and hovered aircraft, then by ascending screen distance to the map center; the rest are drawn by the existing static `IconLayer` icons (white-mask atlas tinted by `getColor`, rotors baked static in the atlas icon, no spin). The fallback set changes with refresh; an aircraft is never drawn both as marker and as `IconLayer` icon (its id is excluded from the icon layer data).

**Pooling**: `Map<aircraftId, MarkerRecord>` where a record holds `Marker`, root element, rotor bindings, current type key and tint. On refresh: records for ids no longer eligible are detached (`marker.remove()`) and their elements parked in a free list keyed by type key for reuse (bounded by the cap); new ids reuse a parked element of the same type key when available, otherwise create one. An id whose type key changed has its SVG swapped. Per poll the manager only updates `setLngLat`, `setRotation`, tint and, if changed, SVG; no DOM is rebuilt for unchanged aircraft.

**Interaction**: marker elements have `pointer-events: auto` and `cursor: pointer`. `click` on a marker calls the same select handler as a deck.gl pick (and `stopPropagation` so the map click-to-deselect does not fire); `mouseenter`/`mouseleave` drive the same hover state/tooltip as deck.gl `onHover`. The selected marker gets a highlight class. Fallback `IconLayer` icons keep deck.gl picking. Tracks, droplines (zero-length in 2D) and the selection pulse remain deck.gl layers and unchanged; they draw beneath the DOM markers, which is acceptable.

**Teardown**: switching to 3D removes every marker (`marker.remove()`), clears the pool and rotor loop, and restores the `IconLayer` data to the model-vs-icon split. Unmount does the same.

### 9. No altitude lift in 2D (user decision)
In 2D mode the camera is top-down with perspective, so an aircraft drawn at its real altitude appears displaced from its ground position toward the screen edges. In 2D every aircraft-derived position uses z = 0: DOM markers, icon (fallback) and icon glow, track paths, dropline dots (zero-length, so equivalent to a single point) and the selection pulse ring. `altitudeToRenderMeters(alt, flat)` is the single switch, with `flat = !modelsEnabled` (view mode 2D). DOM markers have no z by construction. 3D is unchanged. Altitude-based color and the altitude readout are unaffected; only the vertical lift is removed. Toggling modes already triggers an immediate rebuild, and the pulse rAF loop reads the current mode each frame, so z follows the mode with no extra wiring.

## Risks (DOM markers)
- DOM cost: bounded by `MAX_2D_DOM_MARKERS` and culling; verify frame time with the cap populated and rotors spinning. Tune the cap if needed.
- Fetch/parse of per-type SVG is async; an aircraft whose SVG has not loaded yet is drawn by the fallback `IconLayer` until it resolves, then promoted to a marker.
- DOM markers sit above the deck.gl canvas, so tracks/pulse render beneath them.

## 1. Color-mode resolution logic

- [ ] 1.1 In `components/map/aircraftIcons.ts`, replace `ALTITUDE_COLOR_LOW`/`ALTITUDE_COLOR_HIGH`/`altitudeToColor` with a multi-stop gradient table (`ALTITUDE_COLOR_STOPS: Array<{ ft: number; rgb: [number, number, number] }>`) at 0/500/1,000/2,000/4,000/6,000/8,000/10,000/20,000/30,000/40,000ft with hex/RGB values sampled from the reference gradient image (orange → yellow → green → cyan → blue → magenta), and a rewritten `altitudeToColor(altitudeFt)` that finds the enclosing stop pair and linearly interpolates, clamping beyond the last stop.
- [ ] 1.2 In `aircraftIcons.ts`, add `airspeedToColor(groundSpeedKt: number | undefined): [number, number, number]` implementing the grey/green/yellow/orange/red/magenta/hot-pink bands from design.md Decision 3, plus a `MACH1_APPROX_KTS` constant (~660) in `constants.ts` with a comment documenting it as a ground-speed approximation, not true Mach.
- [ ] 1.3 In `aircraftRarity.ts` (or `aircraftIcons.ts`), add a small `rarityToColor(aircraft: Aircraft): [number, number, number]` that calls `computeRarityTier` + `RARITY_TIER_STYLES[...].color` and converts the hex to an RGB triple (reuse `aircraftLayer.ts`'s existing `hexColorToRgb` — move it to a shared location both files can import, e.g. `aircraftIcons.ts` or a new `colorUtils.ts`, rather than duplicating it).
- [ ] 1.4 Add a `ColorMode = "rarity" | "altitude" | "airspeed"` type and `resolveAircraftColor(aircraft: Aircraft, mode: ColorMode): [number, number, number]` dispatcher in `aircraftIcons.ts`.

## 2. Wire color mode through the aircraft layer

- [ ] 2.1 In `components/map/aircraftLayer.ts`, add a `colorMode: ColorMode` param to `buildAircraftLayers`; replace the `IconLayer`'s `getColor: (d) => altitudeToColor(...)` and the track `TrackSegment.color` computation with calls to `resolveAircraftColor(d, colorMode)`.
- [ ] 2.2 In `components/map/radarSweep.ts`, multiply the aircraft dots' z-position by `TERRAIN_EXAGGERATION` alongside the change in task 4.1 below (keep both z-position call sites consistent).
- [ ] 2.3 In `MapView.tsx`, add `colorMode`/`colorModeRef` state (default `"altitude"`), pass it into every `buildAircraftLayers` call site (`refreshAircraft`), and add a handler that updates both the state and ref when the color-mode popup's toggle buttons are activated.

## 3. Bottom-left 2-gang control + color-mode popup

- [ ] 3.1 Create `components/map/controls/AircraftColorControl.tsx` (or similar) rendering the 2-button gang box: button 1 (arrow/recenter icon) calls a passed-in `onRecenter` handler; button 2 (plane icon) toggles a popup containing three toggle buttons labeled for rarity/altitude/airspeed, calling `onColorModeChange(mode)` and reflecting `activeMode` via active/pressed styling.
- [ ] 3.2 Add a corresponding CSS module (e.g. `AircraftColorControl.module.css`) styled consistently with the existing `.controlButton` look in `MapView.module.css`, positioned `absolute; bottom; left` by default.
- [ ] 3.3 In `MapView.tsx`, wire `onRecenter` to the existing `handleJumpToLocation` behavior (per design.md's Open Questions — confirm this target during implementation) and mount `AircraftColorControl` alongside `AircraftOverlay`.

## 4. Terrain-exaggeration-aware altitude

- [ ] 4.1 In `aircraftLayer.ts`, update every `getPosition` z-term (icon layer, glow layer, track path segments) from `(d.altitude ?? 0) * FEET_TO_METERS` to `(d.altitude ?? 0) * FEET_TO_METERS * TERRAIN_EXAGGERATION`, importing `TERRAIN_EXAGGERATION` from `constants.ts`.
- [ ] 4.2 Verify `terrain.ts`'s `applyTerrain` still reads `TERRAIN_EXAGGERATION` for `map.setTerrain(...)` (already does — no change needed there, just confirm the same constant is now the single source both call sites share).

## 5. Color-mode legend

- [ ] 5.1 Create `components/map/overlay/ColorModeLegend.tsx` with three variants: a rarity-tier row (9 cards using `RARITY_TIER_STYLES`, mirroring `PlaneCard`'s tier badge styling), an altitude gradient bar (CSS `linear-gradient` built from the same `ALTITUDE_COLOR_STOPS` table from task 1.1, with tick labels at each stop), and an airspeed gradient bar (CSS gradient + tick labels from the bands in task 1.2).
- [ ] 5.2 Add `ColorModeLegend.module.css` for the three variants' layout (card row vs. gradient bar), matching the "speedometer-style" ask for the airspeed variant (rounded bar with tick marks, not a literal gauge).
- [ ] 5.3 Render `ColorModeLegend` in `MapView.tsx` next to `AircraftColorControl`, passing `activeMode` so exactly one variant renders.

## 6. Dock control + legend to the aircraft details drawer

- [ ] 6.1 In `MapView.tsx`, pass the drawer's open/closed state (already computed as `open = info !== null` in `AircraftOverlay`) down to (or expose via a shared `data-drawer-open` attribute/CSS custom property on a shared ancestor) the new control/legend wrapper.
- [ ] 6.2 In the new control/legend CSS module, add a `[data-drawer-open="true"]` rule that repositions the group (e.g. translates it above the drawer's top-left corner) with a transition matching `AircraftOverlay.module.css`'s existing open/close timing.

## 7. Camera-pitch icon tilt

- [ ] 7.1 In `MapView.tsx`, track the map's current pitch in a ref, updated on the map's `pitch`/`rotate` events (not per aircraft poll).
- [ ] 7.2 In `aircraftLayer.ts`'s `IconLayer`, set `billboard: false` and add a per-instance scale/transform derived from the tracked pitch (design.md Decision 7's foreshortening approximation) — pass pitch into `buildAircraftLayers` as a new param.
- [ ] 7.3 Verify at pitch 0 the icon renders with no tilt applied (matches the "Icon returns flat at zero pitch" scenario).

## 8. Rotorcraft rotating rotor blades

- [ ] 8.1 Create `components/map/rotorMarkers.ts` managing a `Map<hex, Marker>` of MapLibre `Marker`s for currently-rendered category-`A7` aircraft, each rendering the vendored top-view SVG shape (`getAircraftShape`) with an added rotor-disc `<g>` element.
- [ ] 8.2 Add a CSS `@keyframes spin` animation (e.g. in a new `rotorMarker.module.css` or a global stylesheet) applied to the rotor-disc element, running continuously and independent of React re-renders.
- [ ] 8.3 In `MapView.tsx`'s `refreshAircraft`, after building deck.gl layers, call an update function from `rotorMarkers.ts` that adds/updates/removes markers for the current rotorcraft set (add new hexes, `setLngLat`/rotation-update existing ones, remove markers for hexes no longer present) — mirrors the add/update/remove pattern already used for track buffers in `aircraft.ts`.
- [ ] 8.4 Ensure rotorcraft are excluded from (or layered consistently under/over) the deck.gl `IconLayer`'s own rendering for the same hex, so a rotorcraft isn't double-rendered by both systems — decide and document in-code which one "wins" visually for category `A7`.
- [ ] 8.5 Clean up all markers on unmount (mirror the existing cleanup pattern in `MapView.tsx`'s effect teardown).

## 9. Clickability

- [ ] 9.1 In `MapView.tsx`, set `pickingRadius` on the `MapboxOverlay` constructor call (`new MapboxOverlay({ interleaved: false, layers: [], pickingRadius: <value> })`) to a value comfortably larger than the current 40px icon size (tune visually during implementation).
- [ ] 9.2 Manually verify clicking near (not exactly on) a small/distant aircraft icon selects it, and that overlapping aircraft in denser traffic still resolve to a sensible pick.

## 10. Hover tooltip

- [ ] 10.1 In `aircraftLayer.ts`, add an `onHover` handler to the `IconLayer` (parallel to the existing `onClick`), forwarded via a new `buildAircraftLayers` param (e.g. `onAircraftHover: (aircraft: Aircraft | null) => void`).
- [ ] 10.2 In `MapView.tsx`, add `hoveredAircraft`/cursor-position state, updated only on hovered-object identity change (not every pointer-move pixel).
- [ ] 10.3 Create `components/map/overlay/AircraftHoverTooltip.tsx` + CSS module rendering the two-line dark rounded-rect tooltip (`{callsign ?? registration} · {typeDesignator}` / `{altitude} ft · {groundSpeed} kt`) positioned near the cursor, matching the captured reference image.
- [ ] 10.4 Mount `AircraftHoverTooltip` in `MapView.tsx`'s render tree, rendering only when `hoveredAircraft` is non-null, and confirm it never opens `AircraftOverlay` or changes selection state.

## 11. Verification

- [ ] 11.1 Run the existing test suite (`test/aircraftRarity.test.ts` and any others touched) and add/update unit tests for `altitudeToColor`, `airspeedToColor`, and `resolveAircraftColor`.
- [ ] 11.2 Manually verify in the browser: all three color modes apply to icons/tracks/legend consistently; the 2-gang control's recenter and popup both work; the control/legend reposition correctly as the aircraft details drawer opens/closes; aircraft altitude visually tracks the 3x-exaggerated terrain; icons tilt with camera pitch; a rotorcraft's rotor visibly spins; small icons are easier to click; hovering shows the tooltip and does not open the drawer.

## 1. Constants

- [x] 1.1 In `components/map/constants.ts`, add a new comment block (distinct from and cross-referenced against the existing `AIRCRAFT_SELECTION_GLOW_*` block, which becomes this pulse's baseline/midpoint) introducing:
  - `AIRCRAFT_SELECTION_PULSE_PERIOD_MS` (e.g. `1400`) — one full pulse cycle
  - `AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS` (e.g. `10`) — added to `AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS` at the wave's peak
  - `AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE` (e.g. `50`) — subtracted from `AIRCRAFT_SELECTION_GLOW_ALPHA` at the wave's peak

## 2. Pulse layer builder

- [x] 2.1 New file `components/map/selectionPulse.ts`, mirroring `radarSweep.ts`'s doc-comment style and imports (`ScatterplotLayer`, `Layer` type, `altitudeToRenderMeters` from `./aircraftLayer`, `hexColorToRgb` from `./aircraftIcons`, the new constants from `./constants`)
- [x] 2.2 Reused `AIRCRAFT_SELECTION_GLOW_LAYER_ID` (exported from `aircraftLayer.ts`) — no other code referenced the id string, so a separate id wasn't needed
- [x] 2.3 Export `buildSelectionPulseLayer(params: { selected: { lon: number; lat: number; altitude?: number; rarityColorHex: string } | null; nowMs: number; pulseStartMs: number }): Layer[]` — returns `[]` when `selected` is `null`; otherwise computes `t`/`wave` per design.md Decision 3 and returns a single-element `ScatterplotLayer` with `getPosition` from `selected`, `getFillColor` from `hexColorToRgb(selected.rarityColorHex)` plus the computed alpha, `getRadius` the computed radius, `radiusUnits: "pixels"`, `pickable: false`

## 3. Remove the static selection glow from `buildAircraftLayers()`

- [x] 3.1 In `components/map/aircraftLayer.ts`, delete the `glowLayer` `ScatterplotLayer` construction and its inclusion in `buildAircraftLayers()`'s returned array; keep the `AIRCRAFT_SELECTION_GLOW_LAYER_ID` export (still used, now by `selectionPulse.ts`/`MapView.tsx`) unless task 2.2 chose a separate id
- [x] 3.2 Remove now-unused imports from `aircraftLayer.ts` if `hexColorToRgb`/`computeRarityTier`/`RARITY_TIER_STYLES` are no longer referenced there (check first — `resolveAircraftColor` etc. may still need related imports for other layers)
- [x] 3.3 Update `buildAircraftLayers()`'s paint-order comment to drop the removed layer and note the selection ring now lives on its own overlay (`selectionPulse.ts`)

## 4. Wire the dedicated overlay + RAF loop into MapView.tsx

- [x] 4.1 Add refs mirroring the range-outline-sweep pattern: `selectionPulseOverlayRef` (`MapboxOverlay | null`), `selectionPulseRafRef` (`number | null`), `selectionPulseStartRef` (`number`), `selectedAircraftPulseRef` (`{ lon, lat, altitude, rarityColorHex } | null`)
- [x] 4.2 Create the overlay once at map-setup time (`new MapboxOverlay({ interleaved: false, layers: [] })`, `map.addControl(...)`), alongside the existing `deckOverlayRef`/`rangeOutlineOverlayRef` creation
- [x] 4.3 Add `selectionPulseFrame(nowMs)`: reads `selectedAircraftPulseRef.current`, calls `buildSelectionPulseLayer`, `setProps({ layers })` on the overlay, re-schedules itself via `requestAnimationFrame` — mirrors `rangeOutlineSweepFrame`
- [x] 4.4 Add `startSelectionPulse()`/`stopSelectionPulse()` mirroring `startRangeOutlineSweep`/`stopRangeOutlineSweep` (guard against double-start, reset `selectionPulseStartRef.current = performance.now()` on start, `cancelAnimationFrame` + `setProps({ layers: [] })` on stop)
- [x] 4.5 In `refreshAircraft()`, alongside the existing `selected` lookup, write `selectedAircraftPulseRef.current` from `selected` (or `null` if deselected/dropped out) using `computeRarityTier`/`RARITY_TIER_STYLES` for `rarityColorHex`
- [x] 4.6 Call `startSelectionPulse()` where a hex becomes newly selected and `stopSelectionPulse()` where it becomes deselected — both the direct click path (`handleAircraftClick`) and the drop-out-deselect branch already in `refreshAircraft()`
- [x] 4.7 Call `stopSelectionPulse()` in the mount-once effect's cleanup (alongside the existing `stopRangeOutlineSweep()` call) so the RAF loop doesn't leak past unmount

## 5. Verification

- [ ] 5.1 Manually verify selecting an aircraft shows a pulsing rarity-colored ring (size and/or opacity visibly oscillating) around its icon
- [ ] 5.2 Manually verify the pulsing ring's position updates to follow the aircraft on each feeder refresh while continuing to pulse
- [ ] 5.3 Manually verify deselecting (click same aircraft, click elsewhere, Escape, or the aircraft dropping out of the feed) immediately stops and removes the ring
- [ ] 5.4 Manually verify selecting a different aircraft restarts the pulse cleanly at the new aircraft's position (no stale ring left at the old position)
- [ ] 5.5 Manually verify no regression to the `aircraft-glow` always-on icon/track glow, or to aircraft click/hover/select hit-testing
- [x] 5.6 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

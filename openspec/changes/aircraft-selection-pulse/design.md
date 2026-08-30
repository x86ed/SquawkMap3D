## Context

The selected-aircraft glow highlight is currently built inside `components/map/aircraftLayer.ts`'s `buildAircraftLayers()` as a static `ScatterplotLayer` (`glowLayer`, id `AIRCRAFT_SELECTION_GLOW_LAYER_ID`): zero or one element (`selectedAircraft ? [selectedAircraft] : []`), fixed radius/alpha (`AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS`/`AIRCRAFT_SELECTION_GLOW_ALPHA`), colored by the selected aircraft's rarity tier (`RARITY_TIER_STYLES`/`computeRarityTier`, via `hexColorToRgb`). `buildAircraftLayers()` itself is only called once per ~1s feeder poll (`MapView.tsx`'s `refreshAircraft()`), by design (`aircraft-glow`'s design.md: "not a `requestAnimationFrame`-driven effect ... same update cadence as every other element").

This codebase already has a precedent for a per-frame-animated deck.gl layer kept fully separate from the poll-cadence aircraft overlay: the actual-range-outline's radar sweep (`components/map/radarSweep.ts`'s `buildRangeOutlineSweepLayers()`, driven by its own dedicated `MapboxOverlay` + `requestAnimationFrame` loop in `MapView.tsx` — `rangeOutlineOverlayRef`, `rangeOutlineSweepFrame`, `startRangeOutlineSweep`/`stopRangeOutlineSweep`).

## Goals / Non-Goals

**Goals:**
- The selected-aircraft glow highlight pulses (oscillates radius and/or alpha) continuously for as long as an aircraft stays selected.
- Reuse the existing dedicated-overlay-plus-RAF-loop pattern (`radarSweep.ts`/`rangeOutlineSweepFrame`) rather than inventing a new animation mechanism.
- Zero change to `buildAircraftLayers()`'s own poll cadence — the full icon/track/glow layer rebuild stays at ~1Hz.

**Non-Goals:**
- Any change to selection/deselection rules, the drop-out-deselects behavior, or the rarity-tier color computation.
- A user-facing control for pulse speed/amplitude — fixed tuning constants in `constants.ts`, same as every other glow/sweep constant in this codebase.
- Pulsing the new always-on icon/track glow from `aircraft-glow` — that stays static, unrelated to this change.
- Pulsing anything other than the selection ring itself (icon size, track width, etc. are unaffected).

## Decisions

### 1. Move the selection glow out of `buildAircraftLayers()` into a new dedicated, RAF-driven builder
`glowLayer`'s construction (the `ScatterplotLayer`, `AIRCRAFT_SELECTION_GLOW_LAYER_ID`) is removed from `aircraftLayer.ts`'s `buildAircraftLayers()` entirely — it can't pulse smoothly while only being rebuilt once per feeder poll. A new file, `components/map/selectionPulse.ts`, exports `buildSelectionPulseLayer(params)`, a pure per-frame layer builder analogous to `radarSweep.ts`'s `buildRangeOutlineSweepLayers()`: takes the selected aircraft's last-known position/altitude/rarity-tier color and the current animation time, returns a zero-or-one-element `ScatterplotLayer` array with radius/alpha computed from a sine wave over elapsed time. `AIRCRAFT_SELECTION_GLOW_LAYER_ID`'s id constant stays exported from `aircraftLayer.ts` (unchanged string) and is reused by the new layer, since it's still conceptually the same highlight, just relocated and now animated.
- **Alternative considered (rejected)**: keep `glowLayer` inside `buildAircraftLayers()` and make the *entire* aircraft overlay RAF-driven (rebuild icons/tracks/glows every frame too). Rejected — exactly the per-frame-rebuild cost `aircraft-glow`'s design explicitly avoided; the icon/track arrays can be large, and nothing about them needs to change faster than the feeder polls.
- **Alternative considered (rejected)**: keep `buildAircraftLayers()` on its poll cadence but pass it a live `pulsePhase` value recomputed via a separate RAF loop and threaded through as a parameter, still rebuilding the *whole* layer array each frame from that one changing number. Rejected — still forces the full icon/track/other-glow layer construction to run every frame just to change one number in one small layer; a dedicated small overlay is strictly cheaper and mirrors the existing sweep pattern instead of introducing a second animation idiom.

### 2. A second, dedicated `MapboxOverlay`, started on selection and stopped on deselection
`MapView.tsx` gets a new `selectionPulseOverlayRef` (`MapboxOverlay({ interleaved: false, layers: [] })`), created once at map-setup time alongside the existing `deckOverlayRef`/`rangeOutlineOverlayRef`. A `selectionPulseFrame(nowMs)` RAF loop (mirroring `rangeOutlineSweepFrame`) reads a `selectedAircraftPulseRef` (the selected aircraft's last-known `{ lon, lat, altitude, rarityColor }`, or `null`), calls `buildSelectionPulseLayer`, and `setProps({ layers })` on the dedicated overlay. `startSelectionPulse`/`stopSelectionPulse` (mirroring `startRangeOutlineSweep`/`stopRangeOutlineSweep`) are called from `handleAircraftClick` (start when a hex is newly selected, stop when deselected) and from the existing drop-out-deselect branch in `refreshAircraft()`. `stopSelectionPulse` also clears the overlay's layers immediately (`setProps({ layers: [] })`), same as `stopRangeOutlineSweep` does, so the ring doesn't linger one frame after deselection.
- **Why not reuse `rangeOutlineOverlayRet`/its RAF loop**: that overlay's frame function is specific to the range-outline sweep's own state (outline geometry, site, wedge); folding an unrelated selection-ring animation into it would couple two independent features' lifecycles (the sweep only runs while the range-outline toggle is on; the pulse only runs while something is selected) for no benefit.
- **Position/color source**: `refreshAircraft()` (`MapView.tsx`) already computes `selected` (the selected aircraft's current record) once per poll for the existing "recenter camera" logic. It now also writes `selectedAircraftPulseRef.current` from that same lookup (`{ lon, lat, altitude, rarityColor: computeRarityTier(selected) }` or `null` if deselected/dropped out) — no new fetch, just one more field derived from data already fetched at that cadence. The pulse's *position* therefore still only updates at the ~1Hz poll rate (matching the "Highlight tracks aircraft movement" scenario, unchanged); only the radius/alpha animate every frame in between.

### 3. Pulse shape: sine wave over radius and alpha, around the existing baseline
`buildSelectionPulseLayer` computes `t = (nowMs - pulseStartMs) / AIRCRAFT_SELECTION_PULSE_PERIOD_MS`, `wave = (Math.sin(t * 2 * Math.PI) + 1) / 2` (0..1), then:
- `radius = AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS + wave * AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS`
- `alpha = AIRCRAFT_SELECTION_GLOW_ALPHA - wave * AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE` (fades out slightly as it expands, the common "pulse ring" look — bigger and fainter at the wave's peak, smaller and fuller at its trough)

`pulseStartMs` resets to `performance.now()` each time `startSelectionPulse` runs (a fresh selection always starts the pulse at the same phase — small, full-alpha — rather than picking up mid-cycle from whenever the map was last loaded).
- **Alternative considered (rejected)**: pulse only alpha, keep radius fixed. Rejected — a size change is what reads as "pulsing" at a glance on a map already full of colored shapes; alpha-only is too subtle against a bright basemap.
- **Alternative considered (rejected)**: an eased (non-sinusoidal) pulse curve (e.g. a custom cubic ease) for a snappier look. Rejected as unnecessary complexity — a sine wave is smooth, cheap, and matches `radarSweep.ts`'s own `computeSweepAngleDeg`-style "elapsed-time-driven periodic function" idiom already established in this codebase.

## Risks / Trade-offs

- **[Risk] One more `requestAnimationFrame` loop running whenever anything is selected**: same order of cost as the existing range-outline sweep loop (a handful of trig ops and one `setProps` call per frame on a single-element layer) — negligible next to a full WebGL frame.
- **[Trade-off] Pulse position lags real position by up to one poll interval (~1s) during the pulse animation between polls**: accepted — identical lag already exists for the icon/track layers themselves (`aircraft-glow`'s design accepted the same ~1s cadence), so the pulsing ring is no less "live" than the aircraft it surrounds.

## Migration Plan

Purely additive/relocating — one new file (`selectionPulse.ts`), a few new constants, a new overlay+RAF-loop wired into `MapView.tsx` alongside the existing ones, and removal of one `ScatterplotLayer` construction from `buildAircraftLayers()` (replaced by the new file). Rollback is restoring the static `glowLayer` inside `buildAircraftLayers()` and deleting the new overlay/file/constants; nothing else depends on them.

## Open Questions

- Exact `AIRCRAFT_SELECTION_PULSE_PERIOD_MS` / `AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS` / `AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE` values are left to implementation to tune visually (starting points suggested in `tasks.md`), same as every other glow/sweep constant in this codebase's prior designs.

## Why

The selected aircraft's rarity-colored glow highlight (`aircraft-tracks-layer`'s "Selected aircraft rendered with a rarity-colored glow highlight" requirement, `AIRCRAFT_SELECTION_GLOW_LAYER_ID` in `components/map/aircraftLayer.ts`) renders as a static ring. Against a busy map with many icons and tracks, a static ring is easy to miss at a glance — a pulsing ring draws the eye and makes it immediately obvious which aircraft is selected.

## What Changes

- The selected-aircraft glow highlight now pulses (oscillates in size/opacity) continuously while an aircraft is selected, instead of rendering as a static ring.
- The pulsing ring is driven by its own `requestAnimationFrame` loop on a dedicated deck.gl overlay — separate from `components/map/aircraftLayer.ts`'s `buildAircraftLayers()`, which stays on its existing ~1s feeder-poll cadence (same "no per-frame rebuild of the full aircraft/track layer set" reasoning as `aircraft-glow`'s design, and the same dedicated-overlay pattern already used for the actual-range-outline's radar sweep, `components/map/radarSweep.ts`).
- No change to when the highlight appears/disappears (selection/deselection rules, drop-out handling) or its rarity-tier color — only that it now pulses instead of sitting still.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-tracks-layer`: the existing "Selected aircraft rendered with a rarity-colored glow highlight" requirement is modified so the highlight pulses continuously while selected, rather than rendering as a static ring.

## Impact

- `components/map/aircraftLayer.ts`: `buildAircraftLayers()` no longer builds the static `AIRCRAFT_SELECTION_GLOW_LAYER_ID` `ScatterplotLayer` — that responsibility moves to a new dedicated, RAF-driven layer builder.
- `components/map/selectionPulse.ts` (new file): per-frame layer builder for the pulsing selection ring, mirroring `radarSweep.ts`'s `buildRangeOutlineSweepLayers()` shape (a pure function of the selected aircraft's last-known position/color and the current animation time).
- `components/map/constants.ts`: new pulse-tuning constants (period, min/max radius or amplitude, min/max alpha), named/commented distinctly from the existing `AIRCRAFT_SELECTION_GLOW_*` constants (which become the pulse's baseline/midpoint).
- `components/map/MapView.tsx`: new dedicated `MapboxOverlay` + `requestAnimationFrame` loop for the pulsing ring (mirrors the existing range-outline-sweep overlay's start/stop/ref wiring), started on aircraft selection and stopped on deselection/drop-out; tracks the selected aircraft's last-known position/rarity color in a ref, updated each feeder poll in `refreshAircraft()`.
- `openspec/specs/aircraft-tracks-layer/spec.md`: the "Selected aircraft rendered with a rarity-colored glow highlight" requirement is modified via this change's spec delta.
- No changes to `aircraft-glow`'s always-on icon/track glow, to `aircraft-color-mode-control`, or to selection/hover/click/follow behavior.

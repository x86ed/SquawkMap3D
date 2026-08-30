## Why

Aircraft icons and their track trails (`aircraft-tracks-layer`) are drawn as thin, flat-shaded shapes directly on top of the basemap, terrain shading, and other layers (radar, satellite, airspace fills). Against busy or dark basemap tiles they can be hard to spot at a glance, especially small/distant icons and thin 2px track lines — the existing rarity-colored highlight only appears around the one *selected* aircraft (`AIRCRAFT_SELECTION_GLOW_LAYER_ID` in `components/map/aircraftLayer.ts`), so every other aircraft gets no visibility boost at all. Adding a subtle, always-on outer glow — slightly brighter than each aircraft's own current draw color — around every icon and along every track makes the traffic picture easier to read without changing what color each aircraft/track segment conveys under the active color mode.

## What Changes

- Add an always-on outer glow rendered behind every aircraft icon (not just the selected one), colored as a brightened variant of that aircraft's own current color-mode color (`resolveAircraftColor`, `components/map/aircraftIcons.ts`) rather than a fixed color — so the glow always reads as "a brighter version of this icon" regardless of whether rarity, altitude, or airspeed color mode is active.
- Add an always-on outer glow rendered behind every track trail segment, colored as a brightened variant of that segment's own current color-mode color (`resolveTrackPointColor`), as a wider/lower-opacity line beneath the existing 2px track line.
- Add a shared "brighten a color" helper (`components/map/aircraftIcons.ts`) used by both the icon glow and the track glow, so "slightly brighter than the draw color" is computed the same way in both places rather than two independent tints.
- This is purely a rendering-visibility change: it does not alter which color a given aircraft/track segment renders under any color mode (`aircraft-color-mode-control`), does not change icon/track selection, sizing, or click/hover behavior, and does not affect the existing selected-aircraft rarity-colored highlight (`AIRCRAFT_SELECTION_GLOW_LAYER_ID`), which continues to render as its own separate, larger, rarity-colored ring only around the selected aircraft, stacked with (not replacing) the new always-on glow.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-tracks-layer`: adds two new requirements — every rendered aircraft icon gets an always-on outer glow, and every rendered track segment gets an always-on outer glow — both colored as a brightened variant of the element's own current draw color.

## Impact

- `components/map/aircraftLayer.ts`: `buildAircraftLayers()` gains a new `ScatterplotLayer` (icon glow, all positioned aircraft, not just the selected one) and the existing track-segment building loop gains a second, wider/dimmer `PathLayer` (track glow) drawn beneath the existing track line.
- `components/map/aircraftIcons.ts`: new exported `brightenColor()` helper (or equivalent), used by both the new icon glow and track glow, and reused by nothing else that changes color semantics.
- `components/map/constants.ts`: new glow-tuning constants (radius/width and alpha for the icon and track glows, and the brighten amount), named and commented distinctly from the existing `AIRCRAFT_SELECTION_GLOW_*` constants so the two glows aren't confused.
- `openspec/specs/aircraft-tracks-layer/spec.md`: two new requirements (icon glow, track glow) via this change's spec delta.
- No changes to `aircraft-color-mode-control`, aircraft selection/hover/click behavior, feeder polling, or any other layer.

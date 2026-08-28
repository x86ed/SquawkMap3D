## Why

The aircraft layer works but reads as a functional placeholder: every icon is flat-planform and tinted by altitude only, rotorcraft look identical to fixed-wing traffic, the icon hit target is small and easy to miss, hovering gives no quick read of an aircraft, and the icon's altitude doesn't track the map's 3x terrain exaggeration (so a low-flying aircraft can visually sink into an exaggerated ridge it's actually above). Before layering true 3D aircraft models on top of this system, the 2D icon layer needs a coherent color/legend model, better interaction affordance, and correct altitude/terrain alignment — otherwise the 3D work inherits the same gaps.

## What Changes

- Aircraft icon and track color becomes switchable between three modes — **rarity** (9-tier adsb.win palette), **altitude** (fixed color ramp), and **airspeed** (speedometer-style gradient: grey stopped, green <100kt, yellow 100-200kt, orange 200-400kt, red 400-500kt, magenta >500kt, hot pink >Mach 1) — replacing the current always-on altitude tint.
- New bottom-left, two-button ("2-gang box") map control: button 1 recenters the map view; button 2 opens a popup with the three color-mode toggle buttons.
- New color-mode legend, docked at the bottom-left of the map alongside the control: a row of 9 tier cards for rarity mode, a horizontal altitude gradient bar for altitude mode, and a speedometer-style gradient bar for airspeed mode — swapping with the active mode.
- The control + legend group SHALL reposition to "ride" the aircraft details drawer (`AircraftOverlay`) — staying anchored to the drawer's top-left corner as it opens/closes — rather than overlapping it.
- Aircraft icon altitude position (currently real altitude in meters, independent of the map's terrain exaggeration) is scaled by the same `TERRAIN_EXAGGERATION` factor terrain rendering already uses, so an aircraft's rendered height stays visually consistent with the exaggerated terrain beneath it.
- Aircraft icons pitch to reflect the camera's current map pitch, tilting along the aircraft's own flight-path bearing (track) so the icon reads as oriented in 3D rather than staying flat-on as the camera tilts.
- Rotorcraft (ADS-B category `A7`) render with an animated, continuously rotating rotor-blade element layered on the SVG icon, distinguishing them from fixed-wing traffic at a glance.
- Aircraft icon click/hover hit target is enlarged/improved so small on-screen icons (distant or low-zoom aircraft) are easier to select than the current tight icon-only hit area.
- Hovering an aircraft (independent of click-to-select) shows a lightweight tooltip with quick-glance info (callsign/registration, type, altitude, speed) at the cursor, without opening the full details drawer.

## Capabilities

### New Capabilities
- `aircraft-color-mode-control`: the bottom-left 2-gang map control (recenter button + color-mode toggle popup), the rarity/altitude/airspeed color-mode legend, the mode's effect on aircraft icon/track coloring, and the control+legend group's docking behavior against the aircraft details drawer.

### Modified Capabilities
- `aircraft-tracks-layer`: aircraft icon altitude position scales with the map's terrain exaggeration factor; icons pitch with camera tilt along the aircraft's track; rotorcraft icons render an animated rotating rotor; icon click/hover hit target is enlarged; hovering an aircraft (not just clicking) shows a quick-info tooltip.

## Impact

- `components/map/aircraftLayer.ts`: `getPosition`'s altitude term gains the exaggeration multiplier; `getColor` for both the `IconLayer` and track `PathLayer` segments becomes mode-driven instead of hardcoded to `altitudeToColor`; `IconLayer`/pickable hit area sizing; new hover (`onHover`) handling for the tooltip; pitch/tilt applied to icon rendering (custom layer or `IconLayer` billboarding options, per design.md).
- `components/map/aircraftIcons.ts`: new airspeed-to-color function alongside the existing `altitudeToColor`; atlas/rotor-blade handling for rotorcraft.
- `components/map/MapView.tsx`: new color-mode state (`rarity | altitude | airspeed`), new control markup, hover state wiring, camera pitch tracking for icon tilt.
- New component(s) under `components/map/overlay/` or `components/map/controls/` for the 2-gang control and the color-mode legend, plus CSS module(s) for bottom-left docking that tracks the existing `AircraftOverlay` drawer's open/closed state.
- `components/map/constants.ts`: new constants for the airspeed color stops and any tilt/rotor animation tuning values.
- No changes to the feeder data contract (`aircraft.ts`) — all three color modes derive from fields already present on `Aircraft`.

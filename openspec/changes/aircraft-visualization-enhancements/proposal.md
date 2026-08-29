## Why

The aircraft layer works but reads as a functional placeholder: every icon is flat-planform and tinted by altitude only, rotorcraft look identical to fixed-wing traffic, the icon hit target is small and easy to miss, hovering gives no quick read of an aircraft, and the icon's altitude doesn't track the map's 3x terrain exaggeration (so a low-flying aircraft can visually sink into an exaggerated ridge it's actually above). Before layering true 3D aircraft models on top of this system, the 2D icon layer needs a coherent color/legend model, better interaction affordance, and correct altitude/terrain alignment — otherwise the 3D work inherits the same gaps.

## What Changes

- Aircraft icon and track color becomes switchable between three modes — **rarity** (9-tier adsb.win palette), **altitude** (fixed color ramp), and **airspeed** (speedometer-style gradient: grey stopped, green <100kt, yellow 100-200kt, orange 200-400kt, red 400-500kt, magenta >500kt, hot pink >Mach 1) — replacing the current always-on altitude tint.
- New bottom-left, two-button ("2-gang box") map control: button 1 recenters the map view; button 2 opens a popup with the three color-mode toggle buttons.
- New color-mode legend, docked at the bottom-**right** of the map (separate from the control, not sharing its corner — see below): a row of 9 tier cards for rarity mode, a horizontal altitude gradient bar for altitude mode, and a half-circle **speedometer arc gauge** (not a straight bar) for airspeed mode — swapping with the active mode.
- The control and the legend SHALL each independently reposition to "ride" the aircraft details drawer (`AircraftOverlay`) — the control staying anchored above the drawer's top-left corner, the legend above its top-right corner — as it opens/closes, rather than overlapping it.
- Aircraft icon altitude position (currently real altitude in meters, independent of the map's terrain exaggeration) is scaled by the same `TERRAIN_EXAGGERATION` factor terrain rendering already uses, so an aircraft's rendered height stays visually consistent with the exaggerated terrain beneath it.
- Rotorcraft (ADS-B category `A7`) render with an animated, continuously rotating rotor-blade element layered on the SVG icon, distinguishing them from fixed-wing traffic at a glance.
- Aircraft icon click/hover hit target is enlarged/improved so small on-screen icons (distant or low-zoom aircraft) are easier to select than the current tight icon-only hit area.
- Hovering an aircraft (independent of click-to-select) shows a lightweight tooltip with quick-glance info (callsign/registration, type, altitude, speed) at the cursor, without opening the full details drawer.
- **Changed after initial ship**: the legend originally shared the bottom-left stack with the 2-gang control (per the acceptance criteria's original "docked... alongside the control" wording); moved to its own bottom-right dock after the airspeed gauge became a taller arc (see below) and after user feedback that it needed to not crowd the control buttons. Doing so also surfaced and fixed a pre-existing collision: `MapView.tsx`'s own top-right layer-toggle button column is tall enough on a typical viewport to reach down near the bottom-right corner, so the legend's dock is offset `right: 210px` (clearing that column's ~186px rendered width) rather than flush against the map edge.
- **Not shipped**: a camera-pitch tilt cue for icons was attempted (`billboard: false`, letting deck.gl's own projection foreshorten the flat icon as pitch changes) but reverted after live testing showed it washed out icon color legibility at this app's typical 60-85° pitch — see design.md Decision 7. Icons remain always-facing-camera; true 3D orientation stays deferred to the separate 3D-aircraft-models change.

## Capabilities

### New Capabilities
- `aircraft-color-mode-control`: the bottom-left 2-gang map control (recenter button + color-mode toggle popup), the bottom-right rarity/altitude/airspeed color-mode legend, the mode's effect on aircraft icon/track coloring, and each of the control's and legend's independent docking behavior against the aircraft details drawer.

### Modified Capabilities
- `aircraft-tracks-layer`: aircraft icon altitude position scales with the map's terrain exaggeration factor; rotorcraft icons render an animated rotating rotor; icon click/hover hit target is enlarged; hovering an aircraft (not just clicking) shows a quick-info tooltip.

## Impact

- `components/map/aircraftLayer.ts`: `getPosition`'s altitude term gains the exaggeration multiplier; `getColor` for both the `IconLayer` and track `PathLayer` segments becomes mode-driven instead of hardcoded to `altitudeToColor`; `IconLayer` pickable hit area sizing; new hover (`onHover`) handling for the tooltip.
- `components/map/aircraftIcons.ts`: new airspeed-to-color function alongside the existing `altitudeToColor`; rotor-blade handling for rotorcraft (`rotorMarkers.ts`).
- `components/map/MapView.tsx`: new color-mode state (`rarity | altitude | airspeed`), new control markup, hover state wiring.
- `components/map/controls/AircraftColorDock.tsx` (bottom-left, control only) and `components/map/overlay/ColorModeLegendDock.tsx` (bottom-right, legend only) — separate CSS-module-driven docks, each tracking the existing `AircraftOverlay` drawer's open/closed state independently.
- `components/map/constants.ts`: new constants for the airspeed color stops and any tilt/rotor animation tuning values.
- No changes to the feeder data contract (`aircraft.ts`) — all three color modes derive from fields already present on `Aircraft`.

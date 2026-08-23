# day-night-terminator Specification

## Purpose
TBD - created by archiving change day-night-terminator. Update Purpose after archive.

## Requirements

### Requirement: Day/night terminator rendered on the map
The map SHALL render the current solar terminator as a shaded overlay showing which parts of the world are in daylight and which are in darkness, computed from the sun's current subsolar point.

#### Scenario: Terminator visible on load
- **WHEN** the map finishes loading with the terminator layer enabled
- **THEN** a shaded night-hemisphere region is rendered over the portion of the map currently in darkness, and the day-side portion of the map is left unshaded

#### Scenario: Twilight is a gradient, not a hard edge
- **WHEN** the terminator overlay is rendered
- **THEN** the boundary between day and night fades gradually through one or more intermediate twilight shades rather than switching abruptly from fully unshaded to fully shaded at a single line

### Requirement: Terminator live-updates with time
The terminator overlay SHALL be recomputed periodically while the map is open, so its position reflects the sun's actual current position — including its slow seasonal drift, not just its daily motion.

#### Scenario: Overlay reflects the current time
- **WHEN** the map has been open long enough for at least one recompute interval to elapse
- **THEN** the terminator's rendered position matches what the solar terminator's position should be for the current time (not the time the map was first loaded)

#### Scenario: Overlay reflects the season
- **WHEN** the terminator is computed at different times of year
- **THEN** its shape/tilt (how far it extends toward each pole) differs accordingly, reflecting the sun's seasonal declination rather than a fixed year-round curve

### Requirement: Terminator layer is toggleable
The user SHALL be able to show or hide the day/night terminator overlay independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer (airports, military bases), the same way those layers are already toggleable.

#### Scenario: Hiding the terminator layer
- **WHEN** the user turns the terminator layer off
- **THEN** the day/night shading is no longer rendered, while other layers and the base map remain visible per their own state

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the terminator layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the terminator layer remains hidden until the user explicitly turns it back on

### Requirement: Terminator renders correctly in both map themes
The day/night overlay SHALL remain visually legible in both the light and dark base styles. Each theme shades whichever side of the terminator has visual headroom to shade against that theme's basemap: the light theme darkens the night region (the light basemap has room to darken); the dark theme brightens the day region instead (the dark basemap has no room to darken further — a dark overlay would be invisible against it), using the same terminator geometry and a much lower per-band opacity than the light theme (a color shift as intense as the light theme's toward a light tint reads as far too opaque against a dark basemap).

#### Scenario: Terminator visible against light style
- **WHEN** the map is showing its light style with the terminator layer enabled
- **THEN** the darkened night region is visually distinguishable from the unshaded day region and from the light basemap surface

#### Scenario: Terminator visible against dark style
- **WHEN** the map is showing its dark style with the terminator layer enabled
- **THEN** the brightened day region is visually distinguishable from the unshaded night region and from the dark basemap surface, without obscuring underlying basemap detail (coastlines, borders, labels)

#### Scenario: Terminator layer stacks below other map overlays
- **WHEN** the terminator layer is enabled alongside the FAA sectional chart, military bases, or airports layers
- **THEN** the terminator's shading sits beneath those layers (added first, at the bottom of the custom-layer stack) so their own markers/shapes render undimmed on top

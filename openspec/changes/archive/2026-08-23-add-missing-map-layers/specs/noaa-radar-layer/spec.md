## ADDED Requirements

### Requirement: NOAA Radar layer rendered as raster tiles
The map SHALL support a raster tile overlay of NOAA/NWS-hosted national radar mosaic imagery when the layer is enabled, sourced independently of the NEXRAD layer.

#### Scenario: Layer loads successfully
- **WHEN** the NOAA Radar layer is enabled
- **THEN** NOAA-hosted radar tiles are requested and rendered as an overlay on the map

### Requirement: NOAA Radar layer is toggleable
The user SHALL be able to show or hide the NOAA Radar layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, including independently of the NEXRAD layer.

#### Scenario: Hiding the NOAA Radar layer
- **WHEN** the user turns the NOAA Radar layer off
- **THEN** NOAA Radar tiles are no longer rendered, while other layers (including NEXRAD, if enabled) and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the NOAA Radar layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the NOAA Radar layer remains hidden until the user explicitly turns it back on

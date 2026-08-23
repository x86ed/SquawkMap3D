## ADDED Requirements

### Requirement: NOAA infrared satellite layer rendered as raster tiles
The map SHALL support a raster tile overlay of NOAA GOES infrared satellite imagery when the layer is enabled.

#### Scenario: Layer loads successfully
- **WHEN** the NOAA infrared satellite layer is enabled
- **THEN** infrared satellite tiles are requested and rendered as an overlay on the map

### Requirement: NOAA infrared satellite layer is toggleable
The user SHALL be able to show or hide the NOAA infrared satellite layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the NOAA infrared satellite layer
- **WHEN** the user turns the NOAA infrared satellite layer off
- **THEN** infrared satellite tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the NOAA infrared satellite layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the NOAA infrared satellite layer remains hidden until the user explicitly turns it back on

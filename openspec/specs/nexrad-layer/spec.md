# nexrad-layer Specification

## Purpose
TBD - created by archiving change add-missing-map-layers. Update Purpose after archive.
## Requirements
### Requirement: US NEXRAD layer rendered as raster tiles
The map SHALL support a raster tile overlay of the US NEXRAD national base reflectivity radar composite when the layer is enabled.

#### Scenario: Layer loads successfully
- **WHEN** the NEXRAD layer is enabled
- **THEN** NEXRAD composite reflectivity tiles are requested and rendered as an overlay on the map

### Requirement: NEXRAD layer is toggleable
The user SHALL be able to show or hide the NEXRAD layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the NEXRAD layer
- **WHEN** the user turns the NEXRAD layer off
- **THEN** NEXRAD tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the NEXRAD layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the NEXRAD layer remains hidden until the user explicitly turns it back on

### Requirement: NEXRAD layer distinguishable from NOAA Radar layer
The NEXRAD layer SHALL be labeled and styled so it is distinguishable from the separate NOAA Radar layer when both are enabled.

#### Scenario: NEXRAD and NOAA Radar both visible
- **WHEN** both the NEXRAD layer and the NOAA Radar layer are enabled on the map at the same time
- **THEN** a user can tell which overlay is which via their distinct toggle labels/attribution, even if the underlying radar imagery looks visually similar


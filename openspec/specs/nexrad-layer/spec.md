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

The user SHALL be able to show or hide the NEXRAD layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer. The NEXRAD layer SHALL default to hidden on initial page load (and on any subsequent fresh page load, since this toggle state is not persisted); the user's own explicit toggle interaction during the current session takes precedence over this default until the page is reloaded.

#### Scenario: Hiding the NEXRAD layer
- **WHEN** the user turns the NEXRAD layer off
- **THEN** NEXRAD tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the NEXRAD layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the NEXRAD layer remains hidden until the user explicitly turns it back on

#### Scenario: Hidden by default on initial load
- **WHEN** the map loads for the first time in a session, with no prior toggle interaction
- **THEN** the NEXRAD layer renders hidden until the user explicitly turns it on

### Requirement: NEXRAD layer distinguishable from NOAA Radar layer
The NEXRAD layer SHALL be labeled and styled so it is distinguishable from the separate NOAA Radar layer when both are enabled.

#### Scenario: NEXRAD and NOAA Radar both visible
- **WHEN** both the NEXRAD layer and the NOAA Radar layer are enabled on the map at the same time
- **THEN** a user can tell which overlay is which via their distinct toggle labels/attribution, even if the underlying radar imagery looks visually similar


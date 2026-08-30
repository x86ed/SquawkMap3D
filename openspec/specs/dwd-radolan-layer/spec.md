# dwd-radolan-layer Specification

## Purpose
TBD - created by archiving change add-missing-map-layers. Update Purpose after archive.
## Requirements
### Requirement: DWD RADOLAN layer rendered as raster tiles
The map SHALL support a raster tile overlay of the German Weather Service (DWD) RADOLAN precipitation radar composite, covering Europe, when the layer is enabled.

#### Scenario: Layer loads successfully
- **WHEN** the DWD RADOLAN layer is enabled
- **THEN** RADOLAN precipitation tiles are requested and rendered as an overlay over the covered European region

#### Scenario: Layer outside coverage area
- **WHEN** the DWD RADOLAN layer is enabled and the map view is panned outside the RADOLAN product's coverage area
- **THEN** no radar tiles are rendered outside the coverage bounds, and no error is raised

### Requirement: DWD RADOLAN layer is toggleable

The user SHALL be able to show or hide the DWD RADOLAN layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer. The DWD RADOLAN layer SHALL default to hidden on initial page load (and on any subsequent fresh page load, since this toggle state is not persisted); the user's own explicit toggle interaction during the current session takes precedence over this default until the page is reloaded.

#### Scenario: Hiding the DWD RADOLAN layer
- **WHEN** the user turns the DWD RADOLAN layer off
- **THEN** RADOLAN tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the DWD RADOLAN layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the DWD RADOLAN layer remains hidden until the user explicitly turns it back on

#### Scenario: Hidden by default on initial load
- **WHEN** the map loads for the first time in a session, with no prior toggle interaction
- **THEN** the DWD RADOLAN layer renders hidden until the user explicitly turns it on


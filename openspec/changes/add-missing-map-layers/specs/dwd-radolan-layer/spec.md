## ADDED Requirements

### Requirement: DWD RADOLAN layer rendered as raster tiles
The map SHALL support a raster tile overlay of the German Weather Service (DWD) RADOLAN precipitation radar composite, covering Europe, when the layer is enabled.

#### Scenario: Layer loads successfully
- **WHEN** the DWD RADOLAN layer is enabled
- **THEN** RADOLAN precipitation tiles are requested and rendered as an overlay over the covered European region

#### Scenario: Layer outside coverage area
- **WHEN** the DWD RADOLAN layer is enabled and the map view is panned outside the RADOLAN product's coverage area
- **THEN** no radar tiles are rendered outside the coverage bounds, and no error is raised

### Requirement: DWD RADOLAN layer is toggleable
The user SHALL be able to show or hide the DWD RADOLAN layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the DWD RADOLAN layer
- **WHEN** the user turns the DWD RADOLAN layer off
- **THEN** RADOLAN tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the DWD RADOLAN layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the DWD RADOLAN layer remains hidden until the user explicitly turns it back on

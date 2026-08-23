## ADDED Requirements

### Requirement: OpenAIP airspace layer rendered as raster tiles
The map SHALL support an OpenAIP-sourced raster tile overlay showing aeronautical airspace (controlled airspace boundaries, TMAs) when the layer is enabled and an OpenAIP API key is configured.

#### Scenario: Layer loads with a configured API key
- **WHEN** the OpenAIP layer is enabled and a valid OpenAIP API key is configured
- **THEN** OpenAIP airspace tiles are requested and rendered as an overlay on the map

#### Scenario: Layer gracefully unavailable without a configured API key
- **WHEN** the OpenAIP layer is toggled on but no OpenAIP API key is configured
- **THEN** the map does not request OpenAIP tiles and does not error or break other layers; the layer remains visually empty

### Requirement: OpenAIP layer is toggleable
The user SHALL be able to show or hide the OpenAIP airspace layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the OpenAIP layer
- **WHEN** the user turns the OpenAIP layer off
- **THEN** OpenAIP tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the OpenAIP layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the OpenAIP layer remains hidden until the user explicitly turns it back on

### Requirement: OpenAIP attribution shown
The OpenAIP layer's map source SHALL carry OpenAIP's required attribution text.

#### Scenario: Attribution present when layer is added
- **WHEN** the OpenAIP source is added to the map
- **THEN** the source's attribution field includes OpenAIP's required attribution text

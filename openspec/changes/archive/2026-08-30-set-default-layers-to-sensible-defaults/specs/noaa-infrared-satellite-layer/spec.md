## MODIFIED Requirements

### Requirement: NOAA infrared satellite layer is toggleable

The user SHALL be able to show or hide the NOAA infrared satellite layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer. The NOAA infrared satellite layer SHALL default to hidden on initial page load (and on any subsequent fresh page load, since this toggle state is not persisted); the user's own explicit toggle interaction during the current session takes precedence over this default until the page is reloaded.

#### Scenario: Hiding the NOAA infrared satellite layer
- **WHEN** the user turns the NOAA infrared satellite layer off
- **THEN** infrared satellite tiles are no longer rendered, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the NOAA infrared satellite layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the NOAA infrared satellite layer remains hidden until the user explicitly turns it back on

#### Scenario: Hidden by default on initial load
- **WHEN** the map loads for the first time in a session, with no prior toggle interaction
- **THEN** the NOAA infrared satellite layer renders hidden until the user explicitly turns it on

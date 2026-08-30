## MODIFIED Requirements

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

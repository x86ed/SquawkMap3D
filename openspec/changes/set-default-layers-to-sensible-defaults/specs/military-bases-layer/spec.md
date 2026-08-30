## MODIFIED Requirements

### Requirement: Military base layer is toggleable

The user SHALL be able to show or hide the military base layer independently of any other map mode (light/dark theme, pilot mode). The toggle SHALL work the same way regardless of which map mode is currently active. The military base layer SHALL default to hidden on initial page load (and on any subsequent fresh page load, since this toggle state is not persisted); the user's own explicit toggle interaction during the current session takes precedence over this default until the page is reloaded.

#### Scenario: Hiding the military base layer
- **WHEN** the user turns the military base layer off
- **THEN** military base shapes are no longer rendered, while airports and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the military base layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the military base layer remains hidden until the user explicitly turns it back on

#### Scenario: Toggle available in pilot mode
- **WHEN** pilot mode is active
- **THEN** the military base layer toggle still works the same as in the default topographic view

#### Scenario: Hidden by default on initial load
- **WHEN** the map loads for the first time in a session, with no prior toggle interaction
- **THEN** the military base layer renders hidden until the user explicitly turns it on

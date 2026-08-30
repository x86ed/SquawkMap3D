## MODIFIED Requirements

### Requirement: Terrain-based outline layer is toggleable

The user SHALL be able to show or hide the terrain-based outline layer (all currently-loaded rings together, as one layer named "terrain-based outline") independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, following this app's existing layer-toggle pattern, and the layer SHALL remain correctly rendered across theme and pilot-mode switches. The terrain-based outline layer SHALL default to hidden on initial page load (and on any subsequent fresh page load, since this toggle state is not persisted); the user's own explicit toggle interaction during the current session takes precedence over this default until the page is reloaded.

#### Scenario: Toggle available in the layer menu
- **WHEN** the map's layer toggle controls are shown
- **THEN** a toggle for the terrain-based outline layer is present, following the same toggle-button pattern as every other layer

#### Scenario: Hiding the layer hides all rings
- **WHEN** the user turns the terrain-based outline layer off
- **THEN** every currently-rendered ring is hidden, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the terrain-based outline layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the layer remains hidden until the user explicitly turns it back on

#### Scenario: Layer survives style swap while visible
- **WHEN** the terrain-based outline layer is visible and the user switches theme (light/dark) or toggles pilot mode
- **THEN** the rings remain correctly rendered after the map style finishes reloading, without requiring the user to manually re-enable the layer or losing previously-loaded ring data

#### Scenario: Hidden by default on initial load
- **WHEN** the map loads for the first time in a session, with no prior toggle interaction
- **THEN** the terrain-based outline layer renders hidden until the user explicitly turns it on, even though its ring data is still fetched on load per this capability's other requirements

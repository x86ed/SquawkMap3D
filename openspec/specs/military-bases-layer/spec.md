# military-bases-layer Specification

## Purpose
TBD - created by archiving change install-maplibre. Update Purpose after archive.
## Requirements
### Requirement: Military base layer loaded from KML/GeoJSON
The map SHALL load a military base dataset bundled with the app, in KML or GeoJSON format, and render it as a distinct layer.

#### Scenario: Military base layer loads successfully
- **WHEN** the map initializes and fetches the bundled military base data file
- **THEN** the military base locations/boundaries are parsed and rendered as a layer on the map

#### Scenario: Military base data source format
- **WHEN** the bundled military base source data is authored as KML
- **THEN** it is converted to GeoJSON before being loaded into the map so the map only ever loads GeoJSON at runtime

### Requirement: Military bases visually distinct from airports
The military base layer SHALL use a color/style clearly distinguishable from the airports layer and from the base map, so the two layers are never confused.

#### Scenario: Both layers visible simultaneously
- **WHEN** both the airports layer and the military bases layer are enabled on the map at the same time
- **THEN** a user can visually distinguish military base markers/shapes from airport markers by color or symbol alone

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


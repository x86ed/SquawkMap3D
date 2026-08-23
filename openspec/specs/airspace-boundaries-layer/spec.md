# airspace-boundaries-layer Specification

## Purpose
TBD - created by archiving change add-airspace-boundaries-layer. Update Purpose after archive.
## Requirements
### Requirement: Airspace boundaries layer loaded from a live feed
The map SHALL load global FIR/UIR/oceanic ATC airspace boundary polygons at runtime from VATSIM's `vatspy-data-project` feed (`https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/refs/heads/master/Boundaries.geojson`) and render them as a distinct line layer. The feed SHALL be fetched live from that URL every time it is loaded — it SHALL NOT be vendored or bundled as a static file shipped with the app.

#### Scenario: Airspace boundaries layer loads successfully
- **WHEN** the airspace boundaries layer is enabled and the upstream VATSIM feed responds successfully
- **THEN** current FIR/UIR/oceanic boundary polygons are parsed from the live response and rendered as a layer on the map

#### Scenario: Feed refetch
- **WHEN** the airspace boundaries layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches the feed from the live URL and updates the rendered boundaries to reflect any changes

#### Scenario: Feed unavailable
- **WHEN** the airspace boundaries layer is enabled but the upstream feed request fails
- **THEN** the map does not error or break other layers; previously loaded boundary polygons (if any) remain displayed until the next successful refetch

### Requirement: Airspace boundaries layer visually distinct
The airspace boundaries layer SHALL use a color/style clearly distinguishable from other airspace/boundary layers (OpenAIP airspace, special use airspace, TFR, military bases) and from the base map.

#### Scenario: Airspace boundaries and special use airspace both visible
- **WHEN** both the airspace boundaries layer and the special use airspace layer are enabled on the map at the same time
- **THEN** a user can visually distinguish airspace boundary lines from special use airspace polygons by color or style alone

### Requirement: Airspace boundaries layer is toggleable
The user SHALL be able to show or hide the airspace boundaries layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, via a toggle button consistent with the other layer toggle buttons on the map.

#### Scenario: Hiding the airspace boundaries layer
- **WHEN** the user turns the airspace boundaries layer off
- **THEN** airspace boundary lines are no longer rendered, and periodic refetch stops, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the airspace boundaries layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the airspace boundaries layer remains hidden until the user explicitly turns it back on

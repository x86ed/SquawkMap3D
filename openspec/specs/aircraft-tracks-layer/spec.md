# aircraft-tracks-layer Specification

## Purpose
TBD - created by archiving change plane-tracks-3d-layer. Update Purpose after archive.
## Requirements
### Requirement: Live aircraft positions loaded from a configured feeder
The map SHALL load current aircraft positions from a user-configured feeder endpoint serving a tar1090/readsb-compatible `aircraft.json` feed, and render each aircraft as a 3D-positioned marker at its real barometric altitude above the terrain, refetched periodically so displayed positions stay current.

#### Scenario: Aircraft layer loads successfully
- **WHEN** the aircraft layer is enabled, a feeder URL is configured, and the feeder responds successfully
- **THEN** current aircraft are parsed from the feed and rendered as 3D markers positioned at their altitude above the terrain

#### Scenario: Feeder refetch
- **WHEN** the aircraft layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches the feeder and updates rendered aircraft positions, adding newly-seen aircraft and removing aircraft no longer reported

#### Scenario: Feeder unavailable or unconfigured
- **WHEN** the aircraft layer is enabled but no feeder URL is configured, or the configured feeder request fails
- **THEN** the map does not error or break other layers; the aircraft layer renders no aircraft (or continues showing the last successfully fetched positions) until a subsequent successful refetch

### Requirement: Aircraft rendered with per-type or fallback icons
Each rendered aircraft SHALL use an icon resolved from its ICAO type designator where a matching shape exists, falling back to a generic silhouette resolved from its ADS-B emitter category when no type-specific shape exists, falling back to a generic marker when neither resolves — so an aircraft is never rendered invisible for lack of a matching icon.

#### Scenario: Icon resolved by type designator
- **WHEN** an aircraft reports a type designator that matches a vendored aircraft shape
- **THEN** that aircraft is rendered using the matching type-specific icon, oriented to the aircraft's reported track/heading

#### Scenario: Icon falls back to category silhouette
- **WHEN** an aircraft reports a type designator with no matching vendored shape, but reports a recognized ADS-B emitter category
- **THEN** that aircraft is rendered using the generic silhouette mapped from its emitter category

#### Scenario: Icon falls back to generic marker
- **WHEN** an aircraft reports neither a type designator with a matching shape nor a recognized emitter category
- **THEN** that aircraft is still rendered, using a generic marker oriented to its reported track/heading

### Requirement: Recent flight track rendered per aircraft
The map SHALL accumulate and render a recent flight-track trail for each visible aircraft, built from successive position reports received while the layer is enabled, with the trail's color or shading reflecting the aircraft's altitude along its path.

#### Scenario: Track builds from successive polls
- **WHEN** an aircraft is observed across multiple successive feeder refreshes
- **THEN** the map renders a trail connecting its recent reported positions in 3D, positioned at each point's reported altitude

#### Scenario: Track colored by altitude
- **WHEN** an aircraft's track spans a meaningful altitude change
- **THEN** the rendered trail's color visibly varies along its length to reflect the altitude at each point

#### Scenario: Aircraft no longer reported
- **WHEN** an aircraft that previously had a rendered track stops appearing in the feeder's reported aircraft
- **THEN** the map stops updating that aircraft's marker and track, without erroring or affecting other aircraft

### Requirement: Aircraft layer is toggleable
The user SHALL be able to show or hide the aircraft layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, and the layer SHALL remain correctly rendered across theme and pilot-mode switches.

#### Scenario: Hiding the aircraft layer
- **WHEN** the user turns the aircraft layer off
- **THEN** aircraft markers and tracks are no longer rendered, and periodic refetch stops, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the aircraft layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the aircraft layer remains hidden until the user explicitly turns it back on

#### Scenario: Layer survives style swap while visible
- **WHEN** the aircraft layer is visible and the user switches theme (light/dark) or toggles pilot mode
- **THEN** aircraft markers and tracks remain correctly rendered after the map style finishes reloading, without requiring the user to manually re-enable the layer


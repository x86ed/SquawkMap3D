## ADDED Requirements

### Requirement: Terrain-based outline sourced from the running feeder's own HeyWhatsThat data
The map SHALL derive its terrain-based outline data from the running adsb.im/`ultrafeeder` instance's own server-generated `upintheair.json` (produced by that instance's existing HeyWhatsThat integration, configured through adsb.im's own setup UI — not through any SquawkMap3D-specific configuration), fetched through a same-origin proxy path the same way `actual-range-outline-layer`'s `outline.json` already is, gated on whether a feeder is configured at all.

#### Scenario: Feeder configured and HeyWhatsThat data available
- **WHEN** a feeder is configured (the same configuration `actual-range-outline-layer` already requires) and the feeder's own `upintheair.json` is available
- **THEN** the map fetches that data through a same-origin proxy request (no direct cross-origin request to any third-party terrain service)

#### Scenario: No feeder configured
- **WHEN** the terrain-based outline layer is enabled but no feeder is configured
- **THEN** the map does not error or break other layers; the terrain-based outline layer renders no rings, and no request is made for terrain outline data

#### Scenario: Feeder configured but no HeyWhatsThat panorama set up on the feeder
- **WHEN** a feeder is configured but the deployer has not configured a HeyWhatsThat panorama on that feeder (its own server-generated `upintheair.json` is unavailable or the request for it fails)
- **THEN** the map does not error or break other layers; the terrain-based outline layer renders no rings

### Requirement: Terrain-based range rings parsed from the feeder's upintheair data
The map SHALL parse per-altitude theoretical line-of-sight range rings from the feeder's `upintheair.json`-shaped data and render each returned ring as outline geometry.

#### Scenario: Rings load successfully
- **WHEN** the terrain-based outline layer is enabled, a feeder is configured, and the feeder's `upintheair.json` data contains one or more entries in its `rings` array
- **THEN** each ring is parsed into closed outline geometry, tagged with that ring's altitude, and rendered as part of the terrain-based outline layer

#### Scenario: Ring geometry is closed
- **WHEN** a ring in the fetched data does not already end with the same point it starts with
- **THEN** the rendered outline geometry for that ring is closed by repeating its first point as its last point

#### Scenario: Fetched once, not polled
- **WHEN** the terrain-based outline layer has been visible for an extended period with no map style reload
- **THEN** the map does not repeatedly refetch the terrain outline data on a timer; the previously-fetched rings remain displayed

#### Scenario: Unavailable or unparseable data
- **WHEN** the terrain-based outline layer is enabled, a feeder is configured, and the request for the feeder's `upintheair.json` data fails, times out, or returns an empty or unparseable response body
- **THEN** the map does not error or break other layers; the terrain-based outline layer renders no rings

### Requirement: Terrain-based outline rendered as unfilled, altitude-colored strokes
Each terrain-based outline ring SHALL be rendered as an unfilled stroked outline (not a solid fill), colored according to the ring's altitude using this app's existing altitude color gradient, so that multiple concurrently-displayed rings at different altitudes remain individually visible and distinguishable.

#### Scenario: Rings render as strokes, not fills
- **WHEN** the terrain-based outline layer is enabled and ring data has been successfully loaded
- **THEN** each ring is rendered as a stroked outline with no fill, so a higher-altitude ring's interior does not visually obscure a lower-altitude ring nested inside it

#### Scenario: Rings colored by altitude
- **WHEN** the terrain-based outline layer renders more than one ring at different altitudes
- **THEN** each ring's stroke color reflects its altitude according to this app's existing altitude-color gradient, so rings at different altitudes are visually distinguishable from one another

### Requirement: Terrain-based outline layer is toggleable
The user SHALL be able to show or hide the terrain-based outline layer (all currently-loaded rings together, as one layer named "terrain-based outline") independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, following this app's existing layer-toggle pattern, and the layer SHALL remain correctly rendered across theme and pilot-mode switches.

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

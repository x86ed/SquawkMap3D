## ADDED Requirements

### Requirement: Terrain-based outline configured via a HeyWhatsThat panorama ID
The map SHALL derive its terrain-based outline data from a HeyWhatsThat panorama ID, configured via a build-time environment variable, accepted either as a bare panorama ID (e.g. `CG4B3P7M`) or a full panorama URL containing a `view=` parameter (e.g. `https://www.heywhatsthat.com/?view=CG4B3P7M`).

#### Scenario: Panorama ID configured as a bare ID
- **WHEN** the configured value is a bare HeyWhatsThat panorama ID (no URL structure)
- **THEN** that value is used directly as the panorama ID when querying HeyWhatsThat's API

#### Scenario: Panorama ID configured as a full panorama URL
- **WHEN** the configured value is a full HeyWhatsThat panorama URL containing `view=<id>`
- **THEN** the `<id>` portion is extracted and used as the panorama ID when querying HeyWhatsThat's API

#### Scenario: No panorama ID configured
- **WHEN** the terrain-based outline layer is enabled but no panorama ID is configured
- **THEN** the map does not error or break other layers; the terrain-based outline layer renders no rings, and no request is made to HeyWhatsThat's API

### Requirement: Terrain-based range rings loaded from HeyWhatsThat's upintheair API
The map SHALL fetch per-altitude theoretical line-of-sight range rings directly from HeyWhatsThat's public `upintheair.json` API for the configured panorama ID and a fixed set of altitudes, and render each returned ring as outline geometry.

#### Scenario: Rings load successfully
- **WHEN** the terrain-based outline layer is enabled, a panorama ID is configured, and HeyWhatsThat's API responds successfully with one or more entries in its `rings` array
- **THEN** each ring is parsed into closed outline geometry, tagged with that ring's altitude, and rendered as part of the terrain-based outline layer

#### Scenario: Ring geometry is closed
- **WHEN** a ring returned by HeyWhatsThat's API does not already end with the same point it starts with
- **THEN** the rendered outline geometry for that ring is closed by repeating its first point as its last point

#### Scenario: Fetched once, not polled
- **WHEN** the terrain-based outline layer has been visible for an extended period with no map style reload
- **THEN** the map does not repeatedly refetch HeyWhatsThat's API on a timer; the previously-fetched rings remain displayed

#### Scenario: Invalid panorama ID or unreachable API
- **WHEN** the terrain-based outline layer is enabled, a panorama ID is configured, and HeyWhatsThat's API request fails, times out, or returns an empty or unparseable response body (including a successful HTTP response with an empty body, which HeyWhatsThat returns for an unknown or invalid panorama ID)
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

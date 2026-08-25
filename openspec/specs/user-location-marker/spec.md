# user-location-marker Specification

## Purpose
TBD - created by archiving change user-location-view. Update Purpose after archive.

## Requirements

### Requirement: Jump to current location
The map SHALL provide an on-screen control that, when activated, re-centers (flies) the map view to the user's current geolocation on demand, at any time after the map has loaded — independent of the one-time initial-load centering described in `map-view`'s "Center on user location" requirement.

#### Scenario: User activates jump-to-location with permission granted
- **WHEN** the user clicks/taps the "jump to my location" control and the browser successfully retrieves the user's current position
- **THEN** the map flies to the user's current coordinates

#### Scenario: User activates jump-to-location with permission denied or unavailable
- **WHEN** the user clicks/taps the "jump to my location" control and geolocation permission is denied, geolocation is unavailable/unsupported, or the request times out
- **THEN** the map view does not change, no error interrupts the user, and the map remains fully interactive

### Requirement: Pan, tilt, and zoom controls
The map SHALL display on-screen controls, built on MapLibre's built-in `NavigationControl`, that let the user zoom in/out, reset bearing to north, and adjust/visualize pitch, without requiring drag gestures.

#### Scenario: Zoom controls available on load
- **WHEN** the map finishes loading
- **THEN** on-screen zoom-in and zoom-out controls are visible and, when clicked, change the map's zoom level

#### Scenario: Compass/pitch control available on load
- **WHEN** the map finishes loading
- **THEN** an on-screen compass control is visible that, when clicked, resets the map's bearing to north, and visually reflects the map's current pitch

### Requirement: Satellite icon marker at user location
Once the user's location is known — via the initial automatic geolocation on load or via the jump-to-location control — the map SHALL render a static satellite icon marker (`sat.svg`, rendered as a MapLibre symbol layer), anchored at that location and colored the same blue as the range rings.

#### Scenario: Location becomes known
- **WHEN** the user's location is successfully resolved (initial load or jump-to-location)
- **THEN** a satellite icon marker appears on the map anchored at the user's coordinates, colored the same blue as the range rings

#### Scenario: Location is denied or unavailable
- **WHEN** geolocation permission is denied, geolocation is unavailable/unsupported, or the request times out, and no prior location has been resolved
- **THEN** no satellite icon marker is rendered anywhere on the map

#### Scenario: Marker persists across a theme switch
- **WHEN** the user switches the map's light/dark theme after their location is already known
- **THEN** the satellite icon marker remains visible, anchored at the same coordinates, after the theme's style finishes reloading

#### Scenario: Marker moves on repeated jump-to-location
- **WHEN** the user activates the jump-to-location control again from a different position and a new location is resolved
- **THEN** the satellite icon marker updates to the newly resolved coordinates rather than leaving a marker at the previous location

### Requirement: Labeled range rings at 50, 100, 150, and 200 nautical miles
Once the user's location is known, the map SHALL render 4 concentric, labeled range rings centered on that location, at great-circle radii of 50 nautical miles, 100 nautical miles, 150 nautical miles, and 200 nautical miles. Each ring SHALL display a text label indicating its distance.

#### Scenario: Rings render when location becomes known
- **WHEN** the user's location is successfully resolved (initial load or jump-to-location)
- **THEN** 4 concentric ring outlines appear centered on the user's coordinates, at approximately 50 NM, 100 NM, 150 NM, and 200 NM radius, each with a visible text label showing its distance (e.g. "50 NM", "100 NM", "150 NM", "200 NM")

#### Scenario: Rings absent when location is denied or unavailable
- **WHEN** geolocation permission is denied, geolocation is unavailable/unsupported, or the request times out, and no prior location has been resolved
- **THEN** no range rings or ring labels are rendered anywhere on the map

#### Scenario: Rings persist across a theme switch
- **WHEN** the user switches the map's light/dark theme after their location is already known
- **THEN** all 4 range rings and their labels remain visible, centered on the same coordinates, after the theme's style finishes reloading

#### Scenario: Rings recenter on repeated jump-to-location
- **WHEN** the user activates the jump-to-location control again from a different position and a new location is resolved
- **THEN** all 4 range rings and labels recenter on the newly resolved coordinates rather than leaving rings at the previous location

### Requirement: Toggle to hide/show user location marker and range rings
The map SHALL provide an on-screen control that toggles the visibility of the satellite icon marker and all 4 range rings (with labels) together, as a single combined layer. The toggle SHALL only affect visibility of already-rendered marker/ring layers and SHALL NOT clear the underlying resolved location.

#### Scenario: User hides the user-location layer
- **WHEN** the satellite icon marker and range rings are visible and the user activates the toggle control
- **THEN** the satellite icon marker and all 4 range rings and their labels are hidden from the map

#### Scenario: User re-shows the user-location layer
- **WHEN** the satellite icon marker and range rings are hidden and the user activates the toggle control again
- **THEN** the satellite icon marker and all 4 range rings and their labels reappear at the user's last-resolved coordinates

#### Scenario: Toggle state persists across a theme switch
- **WHEN** the user switches the map's light/dark theme while the user-location layer is hidden
- **THEN** the marker and rings remain hidden after the theme's style finishes reloading, rather than reappearing

#### Scenario: Toggling while no location has been resolved yet
- **WHEN** the user activates the toggle control before any location has ever been resolved
- **THEN** the control's state changes but no marker or rings appear, since none have been rendered yet

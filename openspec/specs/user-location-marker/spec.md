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
The map SHALL provide two independent on-screen controls: one that toggles visibility of the satellite icon marker alone (the "Transponder Location" control), and one that toggles visibility of all 4 range rings (with labels) alone (the "Range Rings" control). Each control SHALL only affect visibility of its own already-rendered layer(s) and SHALL NOT clear the underlying resolved location, and SHALL NOT affect the other control's layer(s).

#### Scenario: User hides the transponder-location marker independently of range rings
- **WHEN** the satellite icon marker is visible and the user activates the Transponder Location toggle
- **THEN** the satellite icon marker is hidden from the map, and the range rings and their labels remain in whatever visibility state the Range Rings toggle was already in

#### Scenario: User hides range rings independently of the transponder-location marker
- **WHEN** the range rings are visible and the user activates the Range Rings toggle
- **THEN** all 4 range rings and their labels are hidden from the map, and the satellite icon marker remains in whatever visibility state the Transponder Location toggle was already in

#### Scenario: User re-shows the transponder-location marker
- **WHEN** the satellite icon marker is hidden and the user activates the Transponder Location toggle again
- **THEN** the satellite icon marker reappears at the user's last-resolved coordinates

#### Scenario: User re-shows range rings
- **WHEN** the range rings are hidden and the user activates the Range Rings toggle again
- **THEN** all 4 range rings and their labels reappear centered on the user's last-resolved coordinates

#### Scenario: Both toggle states persist independently across a theme switch
- **WHEN** the user switches the map's light/dark theme while the Transponder Location and Range Rings toggles are in different visibility states from each other
- **THEN** each layer remains in its own independent visibility state after the theme's style finishes reloading, rather than the two layers becoming coupled or either one reappearing unexpectedly

#### Scenario: Toggling either control while no location has been resolved yet
- **WHEN** the user activates either the Transponder Location or Range Rings toggle before any location has ever been resolved
- **THEN** that control's state changes but no marker or rings appear, since none have been rendered yet

#### Scenario: Both marker and rings can be shown simultaneously
- **WHEN** both the Transponder Location and Range Rings toggles are set to visible
- **THEN** the satellite icon marker and all 4 range rings and their labels are all visible at the same time, matching this requirement's pre-existing combined-visibility behavior when both controls happen to agree

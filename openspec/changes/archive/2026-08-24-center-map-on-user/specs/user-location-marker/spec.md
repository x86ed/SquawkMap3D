## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: 3D rotating radar marker at user location
**Reason**: Replaced by a static, ring-colored satellite icon marker (see "Satellite icon marker at user location" above) — the rotating `fill-extrusion` radar-mast visual is dropped per the acceptance criteria.
**Migration**: No user-facing migration; the marker's positioning behavior (appears on location resolve, persists across theme switch, moves on repeated jump-to-location) is preserved by the replacement requirement above.

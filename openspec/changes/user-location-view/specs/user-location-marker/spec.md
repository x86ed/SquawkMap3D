## ADDED Requirements

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

### Requirement: 3D rotating radar marker at user location
Once the user's location is known — via the initial automatic geolocation on load or via the jump-to-location control — the map SHALL render a small 3D radar-mast marker, built from MapLibre `fill-extrusion` geometry (no external 3D model/asset pipeline), anchored at that location. The marker's antenna blade SHALL continuously rotate around the mast's vertical axis.

#### Scenario: Location becomes known
- **WHEN** the user's location is successfully resolved (initial load or jump-to-location)
- **THEN** a 3D extruded radar-mast marker appears on the map anchored at the user's coordinates, with its antenna blade rotating continuously

#### Scenario: Location is denied or unavailable
- **WHEN** geolocation permission is denied, geolocation is unavailable/unsupported, or the request times out, and no prior location has been resolved
- **THEN** no radar marker is rendered anywhere on the map

#### Scenario: Marker persists across a theme switch
- **WHEN** the user switches the map's light/dark theme after their location is already known
- **THEN** the radar marker remains visible and rotating, anchored at the same coordinates, after the theme's style finishes reloading

#### Scenario: Marker moves on repeated jump-to-location
- **WHEN** the user activates the jump-to-location control again from a different position and a new location is resolved
- **THEN** the radar marker updates to the newly resolved coordinates rather than leaving a marker at the previous location

### Requirement: Labeled range rings at 50, 100, and 200 nautical miles
Once the user's location is known, the map SHALL render 3 concentric, labeled range rings centered on that location, at great-circle radii of 50 nautical miles, 100 nautical miles, and 200 nautical miles. Each ring SHALL display a text label indicating its distance.

#### Scenario: Rings render when location becomes known
- **WHEN** the user's location is successfully resolved (initial load or jump-to-location)
- **THEN** 3 concentric ring outlines appear centered on the user's coordinates, at approximately 50 NM, 100 NM, and 200 NM radius, each with a visible text label showing its distance (e.g. "50 NM", "100 NM", "200 NM")

#### Scenario: Rings absent when location is denied or unavailable
- **WHEN** geolocation permission is denied, geolocation is unavailable/unsupported, or the request times out, and no prior location has been resolved
- **THEN** no range rings or ring labels are rendered anywhere on the map

#### Scenario: Rings persist across a theme switch
- **WHEN** the user switches the map's light/dark theme after their location is already known
- **THEN** all 3 range rings and their labels remain visible, centered on the same coordinates, after the theme's style finishes reloading

#### Scenario: Rings recenter on repeated jump-to-location
- **WHEN** the user activates the jump-to-location control again from a different position and a new location is resolved
- **THEN** all 3 range rings and labels recenter on the newly resolved coordinates rather than leaving rings at the previous location

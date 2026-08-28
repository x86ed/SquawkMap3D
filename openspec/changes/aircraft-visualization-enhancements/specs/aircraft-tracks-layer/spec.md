## MODIFIED Requirements

### Requirement: Live aircraft positions loaded from a configured feeder
The map SHALL load current aircraft positions from a user-configured feeder endpoint serving a tar1090/readsb-compatible `aircraft.json` feed, and render each aircraft as a 3D-positioned marker at its real barometric altitude above the terrain, scaled by the same exaggeration factor applied to the terrain itself so the aircraft's rendered height stays visually consistent with the exaggerated terrain surface, refetched periodically so displayed positions stay current.

#### Scenario: Aircraft layer loads successfully
- **WHEN** the aircraft layer is enabled, a feeder URL is configured, and the feeder responds successfully
- **THEN** current aircraft are parsed from the feed and rendered as 3D markers positioned at their altitude above the terrain

#### Scenario: Feeder refetch
- **WHEN** the aircraft layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches the feeder and updates rendered aircraft positions, adding newly-seen aircraft and removing aircraft no longer reported

#### Scenario: Feeder unavailable or unconfigured
- **WHEN** the aircraft layer is enabled but no feeder URL is configured, or the configured feeder request fails
- **THEN** the map does not error or break other layers; the aircraft layer renders no aircraft (or continues showing the last successfully fetched positions) until a subsequent successful refetch

#### Scenario: Aircraft altitude scales with terrain exaggeration
- **WHEN** the map's terrain is rendered with its configured exaggeration factor
- **THEN** each aircraft marker's rendered height above the terrain surface is scaled by that same exaggeration factor, rather than using the aircraft's raw unscaled altitude

### Requirement: Recent flight track rendered per aircraft
The map SHALL accumulate and render a recent flight-track trail for each visible aircraft, built from successive position reports received while the layer is enabled, with the trail's color or shading reflecting the aircraft's value under the currently active aircraft color mode (per the `aircraft-color-mode-control` capability) along its path.

#### Scenario: Track builds from successive polls
- **WHEN** an aircraft is observed across multiple successive feeder refreshes
- **THEN** the map renders a trail connecting its recent reported positions in 3D, positioned at each point's reported altitude

#### Scenario: Track colored by the active color mode
- **WHEN** an aircraft's track spans a meaningful change in the value driving the currently active color mode (altitude, airspeed, or rarity)
- **THEN** the rendered trail's color visibly varies along its length to reflect that change

#### Scenario: Aircraft no longer reported
- **WHEN** an aircraft that previously had a rendered track stops appearing in the feeder's reported aircraft
- **THEN** the map stops updating that aircraft's marker and track, without erroring or affecting other aircraft

## ADDED Requirements

### Requirement: Aircraft icon tilts to reflect camera pitch along its flight path
As the map camera's pitch changes, each rendered aircraft icon SHALL visually tilt along the aircraft's own track/flight-path axis to suggest a 3D orientation, rather than remaining a flat, always-upright 2D sprite regardless of camera angle.

#### Scenario: Icon tilts as camera pitch increases
- **WHEN** the user tilts the map camera to a non-zero pitch
- **THEN** rendered aircraft icons visibly tilt along their track axis to reflect that pitch, rather than staying flat

#### Scenario: Icon returns flat at zero pitch
- **WHEN** the map camera pitch is 0 degrees (top-down view)
- **THEN** rendered aircraft icons render without the tilt effect applied

### Requirement: Rotorcraft icons render animated rotor blades
Aircraft reporting the rotorcraft ADS-B emitter category SHALL render with a rotor-blade element that continuously animates (spins), visually distinguishing them from fixed-wing aircraft, independent of the aircraft's own track/heading updates.

#### Scenario: Rotorcraft renders a spinning rotor
- **WHEN** an aircraft reports the rotorcraft emitter category
- **THEN** its rendered icon includes a rotor-blade element that continuously rotates while the aircraft is rendered

#### Scenario: Fixed-wing aircraft has no rotor animation
- **WHEN** an aircraft reports a non-rotorcraft emitter category (or no category)
- **THEN** its rendered icon does not include a rotating rotor-blade element

### Requirement: Aircraft icon click/hover hit target is enlarged for easier selection
The clickable/hoverable area around each rendered aircraft icon SHALL extend beyond the icon's own visually-drawn pixel bounds, so small, distant, or low-zoom aircraft icons can be selected without requiring pixel-precise clicks directly on the icon artwork.

#### Scenario: Clicking near a small icon selects it
- **WHEN** the user clicks within the enlarged hit area surrounding a rendered aircraft icon, but not on the icon's own drawn pixels
- **THEN** that aircraft becomes selected, the same as clicking directly on the icon

### Requirement: Hovering an aircraft shows a quick-info tooltip
Hovering the pointer over a rendered aircraft icon (independent of clicking/selecting it) SHALL show a lightweight tooltip near the pointer displaying that aircraft's callsign or registration, type designator, current altitude, and current ground speed, without opening the full aircraft details drawer.

#### Scenario: Tooltip appears on hover
- **WHEN** the user hovers the pointer over a rendered aircraft icon
- **THEN** a tooltip appears near the pointer showing that aircraft's callsign/registration, type, altitude, and ground speed

#### Scenario: Tooltip disappears when the pointer leaves the icon
- **WHEN** the user moves the pointer off a hovered aircraft icon without clicking it
- **THEN** the tooltip is no longer shown

#### Scenario: Hovering does not open the details drawer
- **WHEN** the user hovers an aircraft icon without clicking it
- **THEN** the aircraft details drawer does not open and no aircraft becomes selected

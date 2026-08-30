# aircraft-tracks-layer Specification

## Purpose
TBD - created by archiving change plane-tracks-3d-layer. Update Purpose after archive.
## Requirements
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

### Requirement: Aircraft icons rendered with an always-on outer glow
Every rendered aircraft icon SHALL be rendered with an outer glow, independent of whether that aircraft is currently selected. The glow SHALL be colored as a brightened variant of that same aircraft's own current draw color (the color it renders under the currently active aircraft color mode, per `aircraft-color-mode-control`), so the glow's hue always matches the icon it surrounds.

#### Scenario: Every rendered aircraft icon has a glow
- **WHEN** aircraft are currently rendered on the map
- **THEN** each rendered aircraft icon, whether selected or not, has a visible outer glow behind it

#### Scenario: Glow color tracks the icon's own draw color
- **WHEN** an aircraft's icon renders in a given color under the currently active color mode
- **THEN** that aircraft's outer glow renders as a visibly brighter variant of that same color, not a fixed color independent of the active mode

#### Scenario: Glow color updates when the active color mode changes
- **WHEN** the user switches the active aircraft color mode
- **THEN** every rendered aircraft icon's glow color updates to match the newly resolved draw color for that aircraft under the new mode

#### Scenario: Always-on glow is distinct from the selected-aircraft highlight
- **WHEN** an aircraft is selected
- **THEN** that aircraft's always-on outer glow continues to render as described above, and the existing rarity-colored selection highlight (per this capability's selected-aircraft glow-highlight requirement) also renders, distinguishable from and in addition to the always-on glow

#### Scenario: Glow follows the icon's own silhouette, not a plain circle
- **WHEN** an aircraft icon renders (any type shape, category fallback, or generic marker)
- **THEN** the outer glow behind it is shaped like that icon's own outline, rotated to match the icon's own heading, rather than a plain circle unrelated to the icon's shape

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

### Requirement: Track trails rendered with an always-on outer glow
Every rendered segment of a recent flight-track trail SHALL be rendered with an outer glow, colored as a brightened variant of that same segment's own current draw color (per this capability's track-coloring requirement), so the glow's hue varies along the trail exactly as the trail's own color does.

#### Scenario: Every rendered track segment has a glow
- **WHEN** a track trail is currently rendered for an aircraft
- **THEN** each rendered segment of that trail has a visible outer glow along its length, wider and dimmer than the trail's own line

#### Scenario: Track glow color tracks the segment's own draw color
- **WHEN** a track segment renders in a given color reflecting the active color mode
- **THEN** that segment's outer glow renders as a visibly brighter variant of that same color

#### Scenario: Track glow varies along the trail with the trail's own color
- **WHEN** a track's color visibly varies along its length under the active color mode (per this capability's track-coloring requirement)
- **THEN** the track's outer glow visibly varies along its length in the same way, staying a brighter variant of the underlying trail color at each point

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

### Requirement: Aircraft selectable by clicking its icon
The map SHALL allow the user to select exactly one aircraft by clicking its rendered icon, and to deselect it by clicking its icon again, clicking elsewhere on the map, or pressing the Escape key. Selecting an aircraft while another is already selected SHALL replace the selection.

#### Scenario: Selecting an aircraft
- **WHEN** the user clicks a currently-rendered aircraft icon and no aircraft is currently selected
- **THEN** that aircraft becomes the selected aircraft

#### Scenario: Switching selection
- **WHEN** the user clicks a different aircraft icon while another aircraft is already selected
- **THEN** the previously-selected aircraft is deselected and the newly-clicked aircraft becomes selected

#### Scenario: Deselecting by clicking the same aircraft again
- **WHEN** the user clicks the icon of the currently-selected aircraft
- **THEN** that aircraft becomes deselected

#### Scenario: Deselecting by clicking elsewhere on the map
- **WHEN** an aircraft is selected and the user clicks a point on the map that is not any aircraft icon
- **THEN** the selected aircraft becomes deselected

#### Scenario: Deselecting via Escape key
- **WHEN** an aircraft is selected and the user presses the Escape key
- **THEN** the selected aircraft becomes deselected

#### Scenario: Selected aircraft drops out of the feed
- **WHEN** the selected aircraft's hex is no longer present in a subsequent feeder refresh
- **THEN** the aircraft becomes deselected without erroring, and any UI driven by the selection (highlight, overlay) is cleared

### Requirement: Selected aircraft rendered with a rarity-colored glow highlight
While an aircraft is selected, the map SHALL render a glow highlight around that aircraft's icon, colored according to that aircraft's computed rarity tier (see the `aircraft-rarity` capability), and the highlight SHALL track the aircraft's live position on each feeder refresh. The highlight SHALL pulse continuously (oscillate in size and/or opacity) for as long as the aircraft remains selected, rather than rendering as a static, unchanging ring.

#### Scenario: Highlight appears on selection
- **WHEN** the user selects an aircraft
- **THEN** a glow highlight renders around that aircraft's icon, colored per its computed rarity tier

#### Scenario: Highlight pulses continuously while selected
- **WHEN** an aircraft remains selected across multiple animation frames
- **THEN** the glow highlight's size and/or opacity continuously oscillates rather than staying fixed

#### Scenario: Highlight tracks aircraft movement
- **WHEN** the selected aircraft's position changes on a subsequent feeder refresh
- **THEN** the glow highlight's rendered position updates to match the aircraft's new position, and it continues pulsing at that new position

#### Scenario: Highlight clears on deselection
- **WHEN** the selected aircraft becomes deselected (by any means)
- **THEN** the glow highlight is no longer rendered, and the pulse animation stops

### Requirement: Follow-selected-aircraft map control pins the aircraft on screen while the map recenters underneath it
The map SHALL provide a toggle control, enabled by default, labeled to indicate it follows/centers on the selected aircraft. This toggle and the act of selecting an aircraft while it is enabled are the same mechanism: when enabled, selecting an aircraft locks the camera to it, framed as the aircraft staying fixed at its on-screen position (map center) while the map viewport pans underneath/around it as it moves — not the map staying fixed while the aircraft icon drifts. While enabled and an aircraft is selected, the map SHALL recenter its view on that aircraft's current position immediately upon selection and again on each subsequent aircraft-feed refresh. While disabled, selecting an aircraft SHALL still select it (highlight and open the overlay) without moving the camera. While disabled, or while no aircraft is selected, the map SHALL NOT recenter due to aircraft position changes. Once locked, the lock SHALL be broken only by the aircraft becoming deselected (by any of the means defined in this capability's selection requirement above) — manual map panning, dragging, or zooming while locked SHALL NOT break the lock.

#### Scenario: Camera centers on the aircraft immediately upon selection
- **WHEN** the follow toggle is enabled and the user selects an aircraft
- **THEN** the map immediately recenters its view on that aircraft's current position as part of the selection action, without waiting for the next aircraft-feed refresh

#### Scenario: Map recenters on every refresh while following
- **WHEN** the follow toggle is enabled and an aircraft is selected
- **THEN** each subsequent aircraft-feed refresh recenters the map view on that aircraft's current reported position, keeping the aircraft's on-screen position fixed while the map viewport moves underneath it

#### Scenario: Manual panning while locked does not break the lock
- **WHEN** the follow toggle is enabled, an aircraft is selected, and the user manually pans, drags, or zooms the map
- **THEN** the selection and the follow lock remain unchanged, and the map recenters back onto the selected aircraft on the next aircraft-feed refresh

#### Scenario: Toggling follow off stops recentering without deselecting
- **WHEN** the user disables the follow toggle while an aircraft is selected
- **THEN** subsequent aircraft-feed refreshes no longer recenter the map, the user's own pan/zoom is left undisturbed, and the aircraft remains selected (highlight and overlay stay visible)

#### Scenario: Selecting an aircraft while follow is disabled does not move the camera
- **WHEN** the follow toggle is disabled and the user selects an aircraft
- **THEN** that aircraft becomes selected (highlight appears, overlay opens) and the map does not recenter

#### Scenario: Follow toggle is on by default
- **WHEN** the map first loads
- **THEN** the follow-selected-aircraft toggle control is in its enabled (on) state

#### Scenario: Follow has no effect with nothing selected
- **WHEN** the follow toggle is enabled but no aircraft is currently selected
- **THEN** the map does not recenter due to aircraft-feed refreshes

### Requirement: Aircraft icon tilts to reflect camera pitch along its flight path
As the map camera's pitch changes, each rendered aircraft icon SHALL visually tilt along the aircraft's own track/flight-path axis to suggest a 3D orientation, rather than remaining a flat, always-upright 2D sprite regardless of camera angle.

#### Scenario: Icon tilts as camera pitch increases
- **WHEN** the user tilts the map camera to a non-zero pitch
- **THEN** rendered aircraft icons visibly tilt along their track axis to reflect that pitch, rather than staying flat

#### Scenario: Icon returns flat at zero pitch
- **WHEN** the map camera pitch is 0 degrees (top-down view)
- **THEN** rendered aircraft icons render without the tilt effect applied

### Requirement: Rotorcraft icons render animated rotor blades at the aircraft's real altitude
Aircraft reporting the rotorcraft ADS-B emitter category SHALL render with a rotor-blade element that continuously animates (spins), visually distinguishing them from fixed-wing aircraft, independent of the aircraft's own track/heading updates. The rotor element SHALL be positioned at the same real-world altitude as the aircraft's own icon, so it stays visually attached to the fuselage at any altitude or camera pitch rather than projecting onto the ground plane beneath it.

#### Scenario: Rotorcraft renders a spinning rotor
- **WHEN** an aircraft reports the rotorcraft emitter category
- **THEN** its rendered icon includes a rotor-blade element that continuously rotates while the aircraft is rendered

#### Scenario: Fixed-wing aircraft has no rotor animation
- **WHEN** an aircraft reports a non-rotorcraft emitter category (or no category)
- **THEN** its rendered icon does not include a rotating rotor-blade element

#### Scenario: Rotor tracks the aircraft's altitude
- **WHEN** a rotorcraft is rendered at a non-zero altitude and the camera is pitched
- **THEN** the rotor element renders at that same altitude, visually coincident with the aircraft's own icon rather than offset toward the ground

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


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
While an aircraft is selected, the map SHALL render a glow highlight around that aircraft's icon, colored according to that aircraft's computed rarity tier (see the `aircraft-rarity` capability), and the highlight SHALL track the aircraft's live position on each feeder refresh.

#### Scenario: Highlight appears on selection
- **WHEN** the user selects an aircraft
- **THEN** a glow highlight renders around that aircraft's icon, colored per its computed rarity tier

#### Scenario: Highlight tracks aircraft movement
- **WHEN** the selected aircraft's position changes on a subsequent feeder refresh
- **THEN** the glow highlight's rendered position updates to match the aircraft's new position

#### Scenario: Highlight clears on deselection
- **WHEN** the selected aircraft becomes deselected (by any means)
- **THEN** the glow highlight is no longer rendered

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


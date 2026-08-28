## ADDED Requirements

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

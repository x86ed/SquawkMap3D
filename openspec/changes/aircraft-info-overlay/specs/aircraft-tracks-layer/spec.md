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

### Requirement: Follow-selected-aircraft map control
The map SHALL provide a toggle control, enabled by default, labeled to indicate it follows/centers on the selected aircraft. While enabled and an aircraft is selected, the map SHALL recenter its view on that aircraft's current position on each aircraft-feed refresh. While disabled, or while no aircraft is selected, the map SHALL NOT recenter due to aircraft position changes.

#### Scenario: Map recenters while following
- **WHEN** the follow toggle is enabled and an aircraft is selected
- **THEN** each aircraft-feed refresh recenters the map view on that aircraft's current reported position

#### Scenario: Toggling follow off stops recentering
- **WHEN** the user disables the follow toggle while an aircraft is selected
- **THEN** subsequent aircraft-feed refreshes no longer recenter the map, and the user's own pan/zoom is left undisturbed

#### Scenario: Follow toggle is on by default
- **WHEN** the map first loads
- **THEN** the follow-selected-aircraft toggle control is in its enabled (on) state

#### Scenario: Follow has no effect with nothing selected
- **WHEN** the follow toggle is enabled but no aircraft is currently selected
- **THEN** the map does not recenter due to aircraft-feed refreshes

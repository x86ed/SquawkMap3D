## MODIFIED Requirements

### Requirement: Overlay opens and closes with aircraft selection
The map SHALL show a bottom drawer ("the overlay") whenever an aircraft is selected, and SHALL hide it whenever no aircraft is selected. While the right-hand layer-control drawer (per the `layer-control-drawer` capability) is closed, the overlay SHALL span the full viewport width; while that drawer is open, the overlay's right edge SHALL stop at the layer-control drawer's left edge instead of continuing to span the full viewport width. The overlay SHALL provide its own close control, and closing it SHALL deselect the aircraft (consistent with the `aircraft-tracks-layer` capability's selection/deselection requirements).

#### Scenario: Overlay opens on selection
- **WHEN** the user selects an aircraft
- **THEN** the bottom drawer becomes visible, showing that aircraft's information

#### Scenario: Overlay closes on deselection
- **WHEN** the selected aircraft becomes deselected (by any means defined in `aircraft-tracks-layer`'s selection requirement)
- **THEN** the bottom drawer becomes hidden

#### Scenario: Overlay's own close control deselects
- **WHEN** the user activates the overlay's close control
- **THEN** the overlay hides and the aircraft becomes deselected

#### Scenario: Switching selected aircraft updates the open overlay
- **WHEN** the user selects a different aircraft while the overlay is already open
- **THEN** the overlay remains open and updates to show the newly-selected aircraft's information, without a visible close/reopen flash

#### Scenario: Overlay spans the full viewport width when the layer-control drawer is closed
- **WHEN** an aircraft is selected and the right-hand layer-control drawer is closed
- **THEN** the overlay's bottom drawer spans the full viewport width, edge to edge

#### Scenario: Overlay stops at the layer-control drawer's left edge when it's open
- **WHEN** an aircraft is selected and the user opens the right-hand layer-control drawer
- **THEN** the overlay's bottom drawer's right edge moves to the layer-control drawer's left edge, no longer extending underneath it

#### Scenario: Overlay's content scales to the narrower available width
- **WHEN** the overlay is open, the right-hand layer-control drawer is open, and the overlay's content would not otherwise fit in the remaining width
- **THEN** the overlay's content (per the "Overlay is composed of four independent components" requirement's layout) scales down to fit the remaining width, the same way it already scales down for a narrow browser window, without a horizontal scrollbar

## MODIFIED Requirements

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

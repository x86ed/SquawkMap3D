## ADDED Requirements

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

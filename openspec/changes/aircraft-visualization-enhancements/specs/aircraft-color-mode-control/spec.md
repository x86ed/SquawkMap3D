## ADDED Requirements

### Requirement: Aircraft color mode is switchable between rarity, altitude, and airspeed
The map SHALL provide exactly three mutually-exclusive aircraft color modes — `rarity`, `altitude`, and `airspeed` — exactly one of which is active at a time, defaulting to `altitude` on load. The active mode SHALL determine the fill color of every rendered aircraft icon and its track trail (per the `aircraft-tracks-layer` capability's track-coloring requirement).

#### Scenario: Default color mode on load
- **WHEN** the map first loads
- **THEN** the active aircraft color mode is `altitude`

#### Scenario: Switching to rarity mode
- **WHEN** the user selects the rarity color mode
- **THEN** every rendered aircraft icon and track is colored according to that aircraft's computed rarity tier (per the `aircraft-rarity` capability), and the legend shows the 9 rarity tier cards

#### Scenario: Switching to altitude mode
- **WHEN** the user selects the altitude color mode
- **THEN** every rendered aircraft icon and track is colored according to that aircraft's current altitude along the fixed altitude gradient, and the legend shows the altitude gradient bar

#### Scenario: Switching to airspeed mode
- **WHEN** the user selects the airspeed color mode
- **THEN** every rendered aircraft icon and track is colored according to that aircraft's current ground speed along the fixed airspeed gradient, and the legend shows the airspeed gradient bar

#### Scenario: Only one mode active at a time
- **WHEN** the user selects a different color mode than the currently active one
- **THEN** the previously active mode is deactivated and every rendered aircraft/track/legend updates to reflect the newly selected mode

### Requirement: Altitude color mode uses a fixed multi-stop gradient
When the altitude color mode is active, an aircraft's icon and track color SHALL be computed from a fixed gradient with control points at 0, 500, 1,000, 2,000, 4,000, 6,000, 8,000, 10,000, 20,000, 30,000, and 40,000+ feet, running orange at 0ft through yellow, green, cyan, and blue, to magenta at 40,000ft and above, linearly interpolated between adjacent control points.

#### Scenario: Low-altitude aircraft renders orange
- **WHEN** altitude color mode is active and an aircraft's altitude is at or near 0ft
- **THEN** its icon and track render orange

#### Scenario: High-altitude aircraft renders magenta
- **WHEN** altitude color mode is active and an aircraft's altitude is 40,000ft or higher
- **THEN** its icon and track render magenta

#### Scenario: Mid-range altitude interpolates between stops
- **WHEN** altitude color mode is active and an aircraft's altitude falls between two adjacent gradient control points
- **THEN** its icon and track color is linearly interpolated between those two control points' colors

### Requirement: Airspeed color mode uses a fixed speedometer-style gradient
When the airspeed color mode is active, an aircraft's icon and track color SHALL be computed from its ground speed using these fixed bands: grey when stopped or ground speed is unavailable, green below 100 knots, yellow from 100 to 200 knots, orange from 200 to 400 knots, red from 400 to 500 knots, magenta above 500 knots, and hot pink above an approximate Mach 1 ground-speed threshold.

#### Scenario: Stopped or unknown speed renders grey
- **WHEN** airspeed color mode is active and an aircraft has no ground speed or a ground speed of 0 knots
- **THEN** its icon and track render grey

#### Scenario: Speed bands render their assigned color
- **WHEN** airspeed color mode is active and an aircraft's ground speed falls within one of the defined knot bands (green/yellow/orange/red/magenta)
- **THEN** its icon and track render that band's assigned color

#### Scenario: Supersonic ground speed renders hot pink
- **WHEN** airspeed color mode is active and an aircraft's ground speed exceeds the configured approximate Mach 1 threshold
- **THEN** its icon and track render hot pink

### Requirement: Bottom-left two-button map control provides recenter and color-mode selection
The map SHALL provide a two-button ("2-gang") control docked to the bottom-left of the map. The first button SHALL show a recenter/arrow icon and, when activated, recenter the map view. The second button SHALL show a plane icon and, when activated, open a popup containing exactly three toggle buttons — one per color mode (rarity, altitude, airspeed) — allowing the user to select the active color mode.

#### Scenario: Recenter button recenters the view
- **WHEN** the user activates the first (recenter) button
- **THEN** the map view recenters

#### Scenario: Color-mode button opens the mode popup
- **WHEN** the user activates the second (plane icon) button
- **THEN** a popup appears containing the three color-mode toggle buttons, reflecting the currently active mode

#### Scenario: Selecting a mode from the popup applies it
- **WHEN** the color-mode popup is open and the user activates one of its three toggle buttons
- **THEN** that button's color mode becomes the active aircraft color mode (per the color-mode-switching requirement above)

### Requirement: Color-mode legend is shown for the active mode
The map SHALL display a legend matching the currently active color mode, docked at the bottom-left of the map alongside the two-button control: a row of the 9 rarity tier cards when rarity mode is active, a horizontal altitude gradient bar (matching the altitude color mode's control points) when altitude mode is active, or a horizontal speedometer-style airspeed gradient bar (matching the airspeed color mode's bands) when airspeed mode is active. Exactly one legend variant SHALL be visible at a time, matching the active mode.

#### Scenario: Rarity legend shown in rarity mode
- **WHEN** rarity color mode is active
- **THEN** the bottom-left legend shows a row of cards for all 9 rarity tiers

#### Scenario: Altitude legend shown in altitude mode
- **WHEN** altitude color mode is active
- **THEN** the bottom-left legend shows the altitude gradient bar

#### Scenario: Airspeed legend shown in airspeed mode
- **WHEN** airspeed color mode is active
- **THEN** the bottom-left legend shows the airspeed gradient bar

### Requirement: Control and legend dock to the aircraft details drawer
The two-button control and its legend SHALL be positioned to avoid overlapping the aircraft details drawer (per the `aircraft-info-overlay` capability): remaining anchored at the bottom-left of the map when the drawer is closed, and repositioning to sit above/alongside the drawer's top-left edge when the drawer is open.

#### Scenario: Control sits at the map's bottom-left when nothing is selected
- **WHEN** no aircraft is selected and the aircraft details drawer is closed
- **THEN** the two-button control and legend render anchored at the bottom-left corner of the map

#### Scenario: Control repositions when the drawer opens
- **WHEN** the user selects an aircraft and the aircraft details drawer opens
- **THEN** the two-button control and legend reposition so they no longer overlap the open drawer

#### Scenario: Control returns to the map corner when the drawer closes
- **WHEN** the aircraft details drawer closes
- **THEN** the two-button control and legend return to their bottom-left-of-map position

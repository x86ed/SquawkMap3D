# aircraft-color-mode-control Specification

## Purpose
TBD - created by archiving change aircraft-visualization-enhancements. Update Purpose after archive.
## Requirements
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
- **THEN** every rendered aircraft icon and track is colored according to that aircraft's current ground speed along the fixed airspeed gradient, and the legend shows the airspeed speedometer arc

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
When the airspeed color mode is active, an aircraft's icon and track color SHALL be computed from its ground speed using these fixed bands: grey when stopped or ground speed is unavailable, green below 100 knots, yellow from 100 to 200 knots, orange from 200 to 400 knots, red from 400 to 500 knots, magenta above 500 knots, and a darker purple (matching the map's airport-icon accent color) above an approximate Mach 1 ground-speed threshold.

#### Scenario: Stopped or unknown speed renders grey
- **WHEN** airspeed color mode is active and an aircraft has no ground speed or a ground speed of 0 knots
- **THEN** its icon and track render grey

#### Scenario: Speed bands render their assigned color
- **WHEN** airspeed color mode is active and an aircraft's ground speed falls within one of the defined knot bands (green/yellow/orange/red/magenta)
- **THEN** its icon and track render that band's assigned color

#### Scenario: Supersonic ground speed renders the airport-icon accent color
- **WHEN** airspeed color mode is active and an aircraft's ground speed exceeds the configured approximate Mach 1 threshold
- **THEN** its icon and track render the same darker-purple accent color used for airport icons

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
The map SHALL display a legend matching the currently active color mode, docked at the bottom-right of the map (separate from the bottom-left two-button control, so neither ever overlaps the other or the map's own top-right layer-toggle controls): a row of the 9 rarity tier cards when rarity mode is active, a horizontal altitude gradient bar (matching the altitude color mode's control points) when altitude mode is active, or a half-circle speedometer-style arc gauge (matching the airspeed color mode's bands, swept across the arc rather than laid out as a straight bar) when airspeed mode is active. Exactly one legend variant SHALL be visible at a time, matching the active mode.

#### Scenario: Rarity legend shown in rarity mode
- **WHEN** rarity color mode is active
- **THEN** the bottom-right legend shows a row of cards for all 9 rarity tiers

#### Scenario: Altitude legend shown in altitude mode
- **WHEN** altitude color mode is active
- **THEN** the bottom-right legend shows the altitude gradient bar

#### Scenario: Airspeed legend shown in airspeed mode
- **WHEN** airspeed color mode is active
- **THEN** the bottom-right legend shows the airspeed speedometer arc gauge

### Requirement: Control and legend each dock to the aircraft details drawer
The two-button control and the color-mode legend SHALL each be positioned to avoid overlapping the aircraft details drawer (per the `aircraft-info-overlay` capability), independently of each other: the control remains anchored at the bottom-left of the map when the drawer is closed and repositions to sit above the drawer's top-left edge when it's open; the legend remains anchored at the bottom-right of the map when the drawer is closed and repositions to sit above the drawer's top-right edge when it's open.

#### Scenario: Control and legend sit at the map's bottom corners when nothing is selected
- **WHEN** no aircraft is selected and the aircraft details drawer is closed
- **THEN** the two-button control renders anchored at the bottom-left corner of the map and the legend renders anchored at the bottom-right corner of the map

#### Scenario: Control and legend reposition when the drawer opens
- **WHEN** the user selects an aircraft and the aircraft details drawer opens
- **THEN** the two-button control and the legend each reposition so neither overlaps the open drawer

#### Scenario: Control and legend return to the map corners when the drawer closes
- **WHEN** the aircraft details drawer closes
- **THEN** the two-button control and the legend return to their respective bottom-corner positions

### Requirement: Control and legend also dock to the right-hand layer-control drawer
The color-mode legend SHALL reposition to sit against the right-hand layer-control drawer's left edge whenever that drawer is open, in addition to (and independently of) its existing repositioning against the aircraft details drawer. The bottom-left two-button control's own horizontal position SHALL NOT change in response to the layer-control drawer opening or resizing — only its vertical position changes, and only when it collides with the legend (per the collision requirement below).

#### Scenario: Legend rides the layer-control drawer's left edge when it opens
- **WHEN** the layer-control drawer is closed and the user opens it
- **THEN** the color-mode legend's right edge moves to sit against the layer-control drawer's left edge, rather than remaining hidden underneath the drawer

#### Scenario: Legend follows the layer-control drawer while it's being resized
- **WHEN** the layer-control drawer is open and the user drags its resize handle to a new width
- **THEN** the color-mode legend's position follows the drawer's left edge to the new width

#### Scenario: Legend returns to the map's bottom-right corner when the layer-control drawer closes
- **WHEN** the layer-control drawer is open (legend riding its left edge) and the user closes it
- **THEN** the color-mode legend returns to its default bottom-right-corner position

#### Scenario: Two-button control's horizontal position is unaffected by the layer-control drawer
- **WHEN** the layer-control drawer opens, closes, or is resized, and the two-button control and legend are not colliding
- **THEN** the two-button control remains anchored to the bottom-left corner of the map, unmoved

### Requirement: Two-button control moves above the legend when they would otherwise collide
The map SHALL detect when the bottom-left two-button control's rendered position would overlap (or come within a minimum visual gap of) the bottom-right color-mode legend's rendered position, and SHALL reposition the two-button control upward, above the legend, whenever that's true. The legend's own position SHALL NOT change in response to this collision — only the two-button control moves.

#### Scenario: Control stacks above the legend when the layer-control drawer's width pushes them together
- **WHEN** the layer-control drawer is open wide enough (or the viewport is narrow enough) that the color-mode legend's rendered box would overlap or come within the minimum gap of the two-button control's rendered box
- **THEN** the two-button control repositions to sit directly above the legend, with at least the minimum gap between them, rather than overlapping it

#### Scenario: Control returns to its normal row position once the collision clears
- **WHEN** the two-button control is stacked above the legend due to a prior collision, and a subsequent change (drawer narrowing, drawer closing, viewport widening, or a legend variant change) removes that collision
- **THEN** the two-button control returns to its normal position beside (not above) the legend

#### Scenario: Collision check accounts for the active legend variant's own width
- **WHEN** the active color-mode legend variant changes (between the rarity row, the altitude gradient bar, and the airspeed speedometer gauge — each a different rendered width) while the layer-control drawer is open
- **THEN** the collision check is re-evaluated against the newly-rendered legend's actual width, and the two-button control stacks above or returns to its normal position accordingly

### Requirement: Both bottom docks hide on the full-screen mobile drawer breakpoint
Below the layer-control drawer's mobile breakpoint (where it expands to cover the full viewport width while open), both the two-button control and the color-mode legend SHALL be hidden while the layer-control drawer is open, since neither has any remaining space to occupy beside a full-viewport-width drawer.

#### Scenario: Both docks hide when the full-screen drawer opens on a narrow viewport
- **WHEN** the viewport width is below the layer-control drawer's mobile breakpoint and the user opens the layer-control drawer
- **THEN** neither the two-button control nor the color-mode legend is visible

#### Scenario: Both docks reappear once the full-screen drawer closes
- **WHEN** the viewport width is below the layer-control drawer's mobile breakpoint and the user closes the layer-control drawer
- **THEN** the two-button control and the color-mode legend each become visible again, in whatever position their other docking rules (aircraft details drawer, collision-avoidance) currently dictate


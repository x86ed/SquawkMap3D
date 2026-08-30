## ADDED Requirements

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

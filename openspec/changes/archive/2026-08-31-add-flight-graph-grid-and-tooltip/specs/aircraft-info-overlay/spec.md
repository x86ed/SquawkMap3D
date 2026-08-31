## ADDED Requirements

### Requirement: FlightInfoPane sparkline renders scaling per-axis gridlines
`FlightInfoPane`'s dual sparkline SHALL render a horizontal gridline row at each of the altitude axis's tick values, styled as faint blue lines spanning the plot width, and a horizontal row of green dots at each of the ground-speed axis's tick values, spanning the plot width. Both grids SHALL be computed from the same domain/tick calculation each axis's own label column already uses, so that whenever a series' observed peak grows its axis's domain, that axis's gridline rows reposition to match the newly-computed ticks in the same render as the updated axis labels.

#### Scenario: Altitude grid renders as faint blue lines aligned to its axis ticks
- **WHEN** the selected aircraft has at least two retained altitude track points (enough for the altitude line to render)
- **THEN** a horizontal gridline is rendered at each of the altitude axis's tick y-positions, styled as a faint blue line spanning the plot width

#### Scenario: Ground-speed grid renders as green dots aligned to its axis ticks
- **WHEN** the selected aircraft has at least two retained ground-speed track points (enough for the ground-speed line to render)
- **THEN** a horizontal row of green dots is rendered at each of the ground-speed axis's tick y-positions, spanning the plot width

#### Scenario: Grids rescale when a y-axis domain grows
- **WHEN** an aircraft's observed altitude or ground-speed peak exceeds that axis's current domain max, causing that axis's domain (and its rendered tick labels) to grow
- **THEN** that axis's gridline rows reposition to the newly-computed tick y-positions in the same render, remaining aligned with the also-updated tick labels

#### Scenario: No stale or partial grid when a series has insufficient data
- **WHEN** a series has fewer than two retained track points (the sparkline's own existing "not enough data yet" condition for that series)
- **THEN** that series' gridline rows are not rendered

### Requirement: FlightInfoPane sparkline shows a hover tooltip with per-axis values at the cursor
While `FlightInfoPane`'s dual sparkline has at least one series with enough history to render a line, moving the mouse over the plot's horizontal extent SHALL show a tooltip near the cursor displaying the altitude value and the ground-speed value nearest that horizontal (time) position, along with a visual indicator on the chart marking where those values were read from. The tooltip and indicator SHALL disappear when the cursor leaves the plot.

#### Scenario: Hovering shows both series' values at that x position
- **WHEN** the user moves the mouse over the sparkline's plotting area while at least one series has enough history to render a line
- **THEN** a tooltip near the cursor displays the altitude value and the ground-speed value nearest that horizontal position, and a visual indicator (e.g. a crosshair and/or markers) appears on the chart at that position

#### Scenario: Missing data at the hovered position shown honestly
- **WHEN** the user hovers a position where one of the two series has no retained data at all (e.g. ground speed was never reported for this aircraft)
- **THEN** the tooltip shows an explicit placeholder for that series' value rather than a fabricated number, while still showing the other series' real value

#### Scenario: Tooltip and indicator disappear when the cursor leaves the chart
- **WHEN** the user moves the mouse away from the sparkline's plotting area
- **THEN** the tooltip and the on-chart hover indicator are no longer rendered

#### Scenario: Hovering anywhere in the plot area works, not only precisely on a line's stroke
- **WHEN** the user hovers anywhere within the plot's horizontal extent, including positions not precisely on either line's rendered stroke
- **THEN** the tooltip still reflects the nearest data at that horizontal position, since hover is based on the cursor's horizontal position across the whole plot rather than requiring the cursor to be exactly on a rendered line

# aircraft-info-overlay Specification

## Purpose
TBD - created by archiving change aircraft-info-overlay. Update Purpose after archive.
## Requirements
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

### Requirement: Overlay is composed of four independent components
The overlay SHALL be composed of four distinct, independently-defined UI components — `PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` — each implemented as its own component (own file, own props), not merged into a single monolithic drawer component. Each component SHALL render correctly given only the slice of the selected aircraft's data it needs, without depending on the others' internal state.

#### Scenario: Four components render together
- **WHEN** the overlay is open
- **THEN** `PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` are all present and rendering data for the selected aircraft

#### Scenario: Components are independently defined
- **WHEN** the overlay's implementation is inspected
- **THEN** each of the four components exists as its own component definition (not inlined as a single combined drawer component), each consumable and testable on its own

### Requirement: Overlay is responsive and stacks on narrow viewports
The overlay SHALL use a responsive layout that arranges `RecordPanelHero`, `PlaneCard`, `FlightInfoPane`, and `TelemetryMarquee` as a multi-column grid on wide viewports, and reflows to a single stacked column (in that order: hero, then plane card, then flight info pane, then marquee) on narrow viewports.

#### Scenario: Wide viewport shows a multi-column layout
- **WHEN** the overlay is open and the viewport is wide enough for the grid layout
- **THEN** the four components render in their multi-column grid arrangement

#### Scenario: Narrow viewport stacks to a single column
- **WHEN** the overlay is open and the viewport is narrow
- **THEN** the four components reflow to a single stacked column in the order: `RecordPanelHero`, `PlaneCard`, `FlightInfoPane`, `TelemetryMarquee`

### Requirement: PlaneCard shows aircraft identity and rarity tier
`PlaneCard` SHALL display the selected aircraft's registration and manufacturer/model when known, and SHALL display its computed rarity tier — one of the nine real tier values defined by the `aircraft-rarity` capability (`unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, `apex`) — as a labeled tag, with the card's frame/accent styling driven by that tier's `{ color, highlight, glow }` style (per the `aircraft-rarity` capability), including the `mythic`/`apex` gradient frame overrides. Fields with no known value SHALL render an explicit placeholder rather than blank space or the literal string "undefined"/"null". Operator is intentionally not shown here — adsb.win's own real card has no operator field (confirmed on its live authenticated dashboard); it's shown instead by `RecordPanelHero`'s spec grid.

#### Scenario: Full identity data known
- **WHEN** the selected aircraft has a known registration and manufacturer/model description
- **THEN** `PlaneCard` displays both, alongside a tag showing the aircraft's rarity tier name (one of the nine real tier values) styled with that tier's accent style

#### Scenario: Identity data unknown
- **WHEN** the selected aircraft is missing its registration and/or manufacturer/model (e.g. the feeder has no tar1090-db loaded)
- **THEN** `PlaneCard` renders an explicit "unknown" placeholder for each missing field, with no literal "undefined"/"null" text and no blank/missing row

#### Scenario: Aircraft with no rarity classification renders the unidentified tier honestly
- **WHEN** the selected aircraft's computed rarity tier is `unidentified` (no type designator, or no matching entry in the vendored rareness dataset)
- **THEN** `PlaneCard` displays the `unidentified` tier's own tag/style rather than substituting the `standard` tier's style or omitting the tag entirely

### Requirement: PlaneCard shows optional fleet-wide stats when available, never fabricated
`PlaneCard` SHALL accept optional per-aircraft-type fleet stat fields — unique registrations count, flights captured count, observed flight time, highest altitude observed, XP, and percent-progress to the next tier. When all are `undefined` (the case for every aircraft as of this change, since no data source for these exists), `PlaneCard` SHALL render an explicit "not tracked yet" empty state for the stat region rather than blank space, zeros, or fabricated values. When these fields are present (populated by some future change), `PlaneCard` SHALL render them in a stat grid plus an XP progress bar filled to the given progress value.

#### Scenario: Stat fields absent renders an honest empty state
- **WHEN** the selected aircraft's fleet stat fields are all `undefined`
- **THEN** `PlaneCard` renders an explicit "not tracked yet" (or equivalently honest) empty state for the stat region, with no fabricated numbers and no collapsed/blank gap

#### Scenario: Stat fields present render the real stat grid and progress bar
- **WHEN** the selected aircraft's fleet stat fields are all defined
- **THEN** `PlaneCard` renders the registrations/flights/observed-time/highest-altitude values and an XP progress bar reflecting the given progress-to-next-tier value, using only the provided real values — never a value not present in the given data

### Requirement: RecordPanelHero shows identity and specs with aspect-driven reflow
`RecordPanelHero` SHALL display the selected aircraft's registration (as its primary heading), callsign, ICAO hex, and a spec grid of manufacturer, model, operator, and age (when known). Its internal layout SHALL reflow between a portrait and landscape arrangement based on its own measured container aspect ratio, not the browser viewport's aspect ratio.

#### Scenario: Hero shows core identity fields
- **WHEN** the overlay is open
- **THEN** `RecordPanelHero` displays the selected aircraft's registration as its heading, plus callsign and ICAO hex

#### Scenario: Spec grid reflects known and unknown fields
- **WHEN** the selected aircraft has some but not all of manufacturer/model/operator/age known
- **THEN** `RecordPanelHero`'s spec grid shows the known fields and an explicit placeholder for each unknown one

#### Scenario: Layout reflows by measured container aspect, not viewport
- **WHEN** `RecordPanelHero`'s own container is measured (via `ResizeObserver`) as wider than it is tall
- **THEN** it renders in its landscape arrangement, independent of the overall browser viewport's own aspect ratio

#### Scenario: Portrait container reflows to portrait arrangement
- **WHEN** `RecordPanelHero`'s own container is measured as taller than it is wide
- **THEN** it renders in its portrait arrangement, independent of the overall browser viewport's own aspect ratio

### Requirement: TelemetryMarquee shows a scrolling live telemetry ticker
`TelemetryMarquee` SHALL display a continuously-scrolling, monospace ticker of the selected aircraft's live telemetry: altitude, ground speed, heading, vertical rate (with an indicator of climbing/descending/level trend), squawk, distance from the resolved feeder/user site, and seconds since last message. The scroll SHALL pause while the user hovers or focuses the marquee.

#### Scenario: Telemetry values render
- **WHEN** the overlay is open and the selected aircraft reports altitude, ground speed, heading, vertical rate, and squawk
- **THEN** `TelemetryMarquee` displays all of these values, with the vertical-rate value accompanied by a climbing, descending, or level trend indicator matching its sign (positive/negative/near-zero)

#### Scenario: Distance computed from the resolved site
- **WHEN** the overlay is open and the app has a resolved feeder or user site location
- **THEN** `TelemetryMarquee` displays the great-circle distance between that site and the selected aircraft's current position

#### Scenario: Ticker scrolls continuously and pauses on interaction
- **WHEN** the overlay is open and the user is not hovering or focusing `TelemetryMarquee`
- **THEN** the ticker scrolls continuously; **WHEN** the user hovers or focuses it, the scroll pauses until the interaction ends

#### Scenario: Missing telemetry value omitted, not fabricated
- **WHEN** the selected aircraft is missing a given telemetry value (e.g. no squawk reported)
- **THEN** `TelemetryMarquee` omits or placeholders that value rather than rendering a fabricated number

### Requirement: FlightInfoPane shows a telemetry sparkline and route/timeline data when available
`FlightInfoPane` SHALL display a dual sparkline of the selected aircraft's recent altitude and ground-speed history (each independently normalized to its own observed min/max within the retained session-local track history), built from real, already-collected telemetry — never synthetic/placeholder data points. `FlightInfoPane` SHALL source flight-route (origin/destination) and timeline data by looking up the selected aircraft's callsign against the feeder's own tar1090 route database (proxied server-side, per the `aircraft-info-overlay` capability's route-lookup dependency — see design.md Decision 12), rendering the real route/timeline when a route is found, and an explicit "no route data available" state — never fabricated route or time values — when no route is found for that callsign or the lookup fails for any reason.

#### Scenario: Sparkline renders from real track history
- **WHEN** the selected aircraft has at least two retained track points in its session-local history
- **THEN** `FlightInfoPane` renders altitude and ground-speed sparklines from those real recorded points, each normalized to its own series' observed min/max

#### Scenario: Insufficient history for a sparkline
- **WHEN** the selected aircraft has fewer than two retained track points (e.g. just selected)
- **THEN** `FlightInfoPane` renders an explicit "not enough data yet" state for the sparkline rather than a flat/fabricated line

#### Scenario: Route/timeline shows real data when the feeder's route lookup finds a match
- **WHEN** the overlay is open for an aircraft whose callsign the feeder's tar1090 route lookup resolves to a known route
- **THEN** `FlightInfoPane`'s route-progress and timeline elements render that route's real origin/destination (and, if the lookup response includes one, a real departure timestamp; otherwise a "first seen this session" value worded honestly as session-local, not a fabricated departure time)

#### Scenario: Route/timeline shows an explicit no-data state when no route is found
- **WHEN** the overlay is open for an aircraft whose callsign the feeder's tar1090 route lookup does not resolve to a route (e.g. general aviation with no filed route), or the route lookup fails or is unavailable for any reason
- **THEN** `FlightInfoPane`'s route-progress and timeline elements render an explicit "no route data available" state, rather than an error or fabricated values — this is an expected, legitimate per-aircraft outcome, not exclusively an error condition

### Requirement: Overlay chrome, RecordPanelHero, TelemetryMarquee, and FlightInfoPane reflect the active light/dark theme; PlaneCard does not
The overlay's own drawer chrome, and three of its four components — `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` — SHALL render using the map's currently active light/dark theme's panel, border, and text colors, rather than a fixed palette independent of the active theme. `PlaneCard`'s appearance SHALL continue to be driven entirely by the selected aircraft's rarity tier and SHALL NOT change when the active theme changes.

#### Scenario: Overlay chrome and its three theme-reactive components use dark-theme colors when dark theme is active
- **WHEN** the active theme is dark and the overlay is open
- **THEN** the overlay's drawer background/border, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all render using the dark theme's palette

#### Scenario: Overlay chrome and its three theme-reactive components use light-theme colors when light theme is active
- **WHEN** the active theme is light and the overlay is open
- **THEN** the overlay's drawer background/border, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all render using the light theme's palette

#### Scenario: Theme-reactive components update immediately when the theme is toggled
- **WHEN** the overlay is open and the user toggles the theme
- **THEN** the overlay's chrome, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all update to the newly active theme's colors without the overlay needing to be closed/reopened or the selected aircraft to change

#### Scenario: PlaneCard's colors are unaffected by a theme toggle
- **WHEN** the overlay is open for a given selected aircraft and the user toggles the theme
- **THEN** `PlaneCard`'s rendered colors (background, border, rarity-tier accent) remain unchanged, driven only by that aircraft's rarity tier, not by the newly active theme

#### Scenario: PlaneCard renders identically for the same aircraft regardless of active theme
- **WHEN** the same selected aircraft's overlay is viewed once under the dark theme and once under the light theme
- **THEN** `PlaneCard`'s rendered colors are identical between the two views

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

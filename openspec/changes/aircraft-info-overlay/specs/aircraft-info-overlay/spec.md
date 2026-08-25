## ADDED Requirements

### Requirement: Overlay opens and closes with aircraft selection
The map SHALL show a full-width bottom drawer ("the overlay") whenever an aircraft is selected, and SHALL hide it whenever no aircraft is selected. The overlay SHALL provide its own close control, and closing it SHALL deselect the aircraft (consistent with the `aircraft-tracks-layer` capability's selection/deselection requirements).

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
`PlaneCard` SHALL display the selected aircraft's registration, manufacturer/model, and operator when known, and SHALL display its computed rarity tier as a labeled corner tag, with the card's accent color driven by that tier's color (per the `aircraft-rarity` capability). Fields with no known value SHALL render an explicit placeholder rather than blank space or the literal string "undefined"/"null".

#### Scenario: Full identity data known
- **WHEN** the selected aircraft has a known registration, manufacturer/model description, and operator
- **THEN** `PlaneCard` displays all three, alongside a corner tag showing the aircraft's rarity tier name in that tier's accent color

#### Scenario: Identity data unknown
- **WHEN** the selected aircraft is missing its registration, manufacturer/model, and/or operator (e.g. the feeder has no tar1090-db loaded)
- **THEN** `PlaneCard` renders an explicit "unknown" placeholder for each missing field, with no literal "undefined"/"null" text and no blank/missing row

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

### Requirement: FlightInfoPane shows a telemetry sparkline and an explicit route-data state
`FlightInfoPane` SHALL display a dual sparkline of the selected aircraft's recent altitude and ground-speed history (each independently normalized to its own observed min/max within the retained session-local track history), built from real, already-collected telemetry — never synthetic/placeholder data points. Since this app has no flight-route (origin/destination) or ETA/departed/landed data source, `FlightInfoPane` SHALL render an explicit "no route data available" state for the route-progress/timeline portion of the mockup's design, rather than displaying fabricated route or time values.

#### Scenario: Sparkline renders from real track history
- **WHEN** the selected aircraft has at least two retained track points in its session-local history
- **THEN** `FlightInfoPane` renders altitude and ground-speed sparklines from those real recorded points, each normalized to its own series' observed min/max

#### Scenario: Insufficient history for a sparkline
- **WHEN** the selected aircraft has fewer than two retained track points (e.g. just selected)
- **THEN** `FlightInfoPane` renders an explicit "not enough data yet" state for the sparkline rather than a flat/fabricated line

#### Scenario: Route/timeline shows an explicit no-data state
- **WHEN** the overlay is open for any aircraft
- **THEN** `FlightInfoPane`'s route-progress and timeline elements render an explicit "no route data available" state, since this app does not source flight-route or ETA/departed/landed data (see design.md's Open Questions for the deferred follow-up)

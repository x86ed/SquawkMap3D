## ADDED Requirements

### Requirement: Plane listing panel shows currently-tracked aircraft
The drawer SHALL display a panel, below the layer-control accordion, listing every aircraft currently reported by the configured feeder, kept up to date as the feeder's reported aircraft change.

#### Scenario: Aircraft appear in the listing
- **WHEN** the drawer is open, a feeder is configured, and the feeder reports one or more aircraft
- **THEN** each reported aircraft appears as a row in the listing

#### Scenario: Listing updates as aircraft come and go
- **WHEN** the drawer remains open and the feeder's reported aircraft change (a new aircraft appears, or a previously-listed aircraft is no longer reported)
- **THEN** the listing adds the newly-reported aircraft and removes the no-longer-reported aircraft, without requiring the user to manually refresh

#### Scenario: No feeder configured or no aircraft reported
- **WHEN** the drawer is open and no feeder is configured, or the feeder currently reports zero aircraft
- **THEN** the listing shows an empty state, rather than erroring or showing stale/placeholder rows

### Requirement: Tabbed search, filters, and column configuration
The plane listing panel SHALL present a tab navigation with Search, Filters, and Columns sections, only one of which is shown at a time, above the data table.

#### Scenario: Search tab provides a text search
- **WHEN** the user selects the Search tab and types into its search field
- **THEN** the table's visible rows are filtered to aircraft matching the entered text against at least callsign, registration, and hex ID

#### Scenario: Filters tab narrows visible rows
- **WHEN** the user selects the Filters tab and applies a filter (e.g. altitude range, distance range)
- **THEN** the table's visible rows are filtered to aircraft matching the applied filter criteria

#### Scenario: Columns tab toggles column visibility
- **WHEN** the user selects the Columns tab and toggles a column's checkbox
- **THEN** the table adds or removes that column from its currently displayed columns, without affecting the current sort or filter state

#### Scenario: Switching tabs preserves other tabs' state
- **WHEN** the user switches from one tab (e.g. Search) to another (e.g. Filters) and back
- **THEN** the values/selections made in the first tab (e.g. the entered search text) are still present when returning to it

### Requirement: Sortable data table with the full column set
The plane listing panel SHALL render a data table of the currently-visible (filtered) aircraft, supporting these columns: Hex ID, Flag, Callsign, Airline, Route, Registration, Type, Squawk, Altitude, Speed, Vertical Rate, Distance, Track, Messages, Seen, RSSI, Latitude, Longitude, Source, Mil., Wind D., Wind S., XP, Rarity, Registrations, Flight Time, and Level. Each column's header SHALL be clickable to sort the table by that column, toggling between ascending and descending order.

#### Scenario: Clicking a column header sorts ascending
- **WHEN** the user clicks a column header that is not the current sort column
- **THEN** the table's rows re-order by that column's value in ascending order, and the header indicates it is now the active sort column in ascending direction

#### Scenario: Clicking the active sort column's header reverses direction
- **WHEN** the user clicks the column header that is already the active sort column
- **THEN** the table's rows re-order by that column's value in descending order, and the header indicates the sort direction has reversed

#### Scenario: Only currently-enabled columns render
- **WHEN** a column has been hidden via the Columns tab
- **THEN** that column's header and cell values do not render in the table, and clicking column headers still works for the remaining visible columns

### Requirement: Columns with real underlying data render actual values
For every column with a real underlying data source in this application (Hex ID, Flag, Callsign, Registration, Type, Squawk, Altitude, Speed, Vertical Rate, Track, Messages, Seen, RSSI, Latitude, Longitude, Source, Mil., Wind D., Wind S., Rarity, and Distance), the table SHALL render that aircraft's actual current value for that column, not a placeholder or randomized value.

#### Scenario: Core telemetry columns render real values
- **WHEN** an aircraft row is displayed with a known altitude, speed, vertical rate, track, latitude, and longitude
- **THEN** the corresponding cells display that aircraft's actual reported altitude, speed, vertical rate, track, latitude, and longitude

#### Scenario: Flag column renders the aircraft's registration country
- **WHEN** an aircraft's registration/tail number resolves to a known country prefix
- **THEN** the Flag column renders that country's flag

#### Scenario: Distance column renders great-circle distance from the resolved site location
- **WHEN** the site location (transponder/feeder location, or its browser-geolocation fallback) is known and an aircraft has a known position
- **THEN** the Distance column renders the great-circle distance between the site location and the aircraft's current position

#### Scenario: Rarity column renders the computed rarity tier/value
- **WHEN** an aircraft's rarity tier and value have been computed
- **THEN** the Rarity column renders that computed tier/value, consistent with the rarity styling used elsewhere in the app

#### Scenario: A field the feeder hasn't reported for a given aircraft renders as empty, not fabricated
- **WHEN** an aircraft's feeder data omits a given real-data-backed field (e.g. no RSSI reported)
- **THEN** that aircraft's cell for that column renders an empty/placeholder indicator, not a fabricated value

### Requirement: Columns pending a data source render as a stub for now
The XP, Registrations, and Flight Time columns SHALL render as an explicit placeholder value for every row — no per-aircraft tracking exists for these in this application yet — and SHALL be excluded from the table's default-visible column set. This is a stub, not a permanent absence: the column exists now so real values can be wired in by a future change without further UI changes.

#### Scenario: Placeholder columns show a placeholder value
- **WHEN** the XP, Registrations, or Flight Time column is made visible via the Columns tab
- **THEN** every row's cell for that column renders the same placeholder indicator (e.g. "—"), not a computed or randomized value

#### Scenario: Placeholder columns are hidden by default
- **WHEN** the plane listing panel is first opened without any prior column customization
- **THEN** the XP, Registrations, and Flight Time columns are not part of the default visible column set

### Requirement: Airline and Route are derived without excessive third-party requests
The Airline column SHALL be derived locally from the aircraft's callsign prefix. The Route column SHALL be looked up via this application's existing flight-route lookup, throttled so that a given callsign is looked up at most once per session rather than on every refresh.

#### Scenario: Airline resolves from a known callsign prefix
- **WHEN** an aircraft's callsign's ICAO airline-designator prefix matches a known entry
- **THEN** the Airline column renders that airline's name without an additional network request

#### Scenario: Route is looked up once per distinct callsign
- **WHEN** the same callsign appears across multiple successive listing refreshes
- **THEN** the route lookup for that callsign is performed at most once (until the callsign changes), with subsequent refreshes reusing the cached result

#### Scenario: Unresolvable airline or route renders empty
- **WHEN** an aircraft's callsign prefix has no known airline match, or the route lookup finds no plausible route
- **THEN** the Airline and/or Route column renders an empty/placeholder indicator rather than erroring or blocking the rest of the row

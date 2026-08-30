## ADDED Requirements

### Requirement: Plane listing panel shows currently-tracked aircraft
The drawer SHALL display a panel, in its own "Aircraft" top-level tab (separate from the layer-control accordion's "Layers" tab — see `layer-control-drawer`'s top-level tab requirement), listing every aircraft currently reported by the configured feeder, kept up to date as the feeder's reported aircraft change.

#### Scenario: Aircraft appear in the listing
- **WHEN** the drawer is open, the Aircraft tab is active, a feeder is configured, and the feeder reports one or more aircraft
- **THEN** each reported aircraft appears as a row in the listing

#### Scenario: Listing updates as aircraft come and go
- **WHEN** the drawer remains open with the Aircraft tab active and the feeder's reported aircraft change (a new aircraft appears, or a previously-listed aircraft is no longer reported)
- **THEN** the listing adds the newly-reported aircraft and removes the no-longer-reported aircraft, without requiring the user to manually refresh

#### Scenario: No feeder configured or no aircraft reported
- **WHEN** the drawer is open, the Aircraft tab is active, and no feeder is configured, or the feeder currently reports zero aircraft
- **THEN** the listing shows an empty state, rather than erroring or showing stale/placeholder rows

### Requirement: Tabbed search, filters, and column configuration
The plane listing panel SHALL present a tab navigation with Search, Filters, and Columns sections, only one of which is shown at a time, above the data table.

#### Scenario: Search tab provides a text search
- **WHEN** the user selects the Search tab and types into its search field
- **THEN** the table's visible rows are filtered to aircraft matching the entered text against at least callsign, registration, and hex ID

#### Scenario: Filters tab narrows visible rows
- **WHEN** the user selects the Filters tab and applies a filter (e.g. altitude range, distance range)
- **THEN** the table's visible rows are filtered to aircraft matching the applied filter criteria

### Requirement: Full filter-field set matching this app's underlying feeder stack
The Filters tab SHALL provide the following filters, each independently applicable and all simultaneously combinable (an aircraft SHALL be shown only if it matches every currently-active filter):
- Altitude range (min/max)
- Distance range (min/max)
- Callsign (substring)
- Squawk (substring)
- Registration (substring)
- ICAO hex ID (substring)
- Type code (substring, matching the same value as the Type column)
- Type description (substring, matching the type code's decoded description)
- Route (substring, matching the resolved Route value)
- Country of registration (substring, matching either the resolved country's code or name)
- Category (substring, matching the ADS-B emitter category)
- Source (multi-select: ADS-B, UAT/ADS-R, MLAT, TIS-B, Mode-S, Other, ACARS — an aircraft matches if its source bucket is one of the currently-selected chips, or if no chip is selected)
- DB flags (multi-select: Military, PIA, LADD — an aircraft matches if it has any of the currently-selected flags set, or if none is selected)

#### Scenario: Multiple simultaneous field filters narrow the row set together
- **WHEN** the user sets both a Callsign filter and an Altitude range filter
- **THEN** only aircraft matching both the callsign substring and the altitude range are shown

#### Scenario: Type description filter matches on decoded description, not the raw code
- **WHEN** the user enters a Type description filter value that matches a known type code's decoded description but not the code itself
- **THEN** aircraft whose type code decodes to a matching description are shown

#### Scenario: Source multi-select filters by resolved source bucket
- **WHEN** the user selects one or more Source chips (e.g. "ADS-B" and "MLAT")
- **THEN** only aircraft whose resolved source bucket matches one of the selected chips are shown

#### Scenario: ACARS source chip has no matching data
- **WHEN** the user views the Source chip row
- **THEN** the ACARS chip is present but disabled, since this application has no ACARS data source, and selecting it has no effect

#### Scenario: DB flags multi-select filters by Military/PIA/LADD
- **WHEN** the user selects one or more DB-flag chips (e.g. "Military")
- **THEN** only aircraft with at least one of the selected flags set are shown

#### Scenario: No filter values set shows all aircraft
- **WHEN** the Filters tab has no field filled in and no chips selected
- **THEN** the table shows every currently-tracked aircraft, unfiltered by this tab (still subject to Search tab text if any is entered)

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

### Requirement: Airline and Route reuse this application's existing route cache, with no additional throttling
The Airline column SHALL be derived locally from the aircraft's callsign prefix, with no network request. The Route column SHALL be looked up via this application's existing flight-route lookup and its existing per-aircraft cache (the same cache the selected-aircraft info overlay already uses), so a given aircraft's route is looked up at most once per cache lifetime rather than once per refresh — matching this application's current route-lookup behavior exactly, not adding any new rate-limiting, debouncing, or request-staggering beyond that existing cache.

#### Scenario: Airline resolves from a known callsign prefix
- **WHEN** an aircraft's callsign's ICAO airline-designator prefix matches a known entry
- **THEN** the Airline column renders that airline's name without an additional network request

#### Scenario: Route is looked up once per distinct aircraft and shared with the selected-aircraft overlay
- **WHEN** the same aircraft appears across multiple successive listing refreshes, or is looked up by both the plane listing panel and the selected-aircraft info overlay
- **THEN** the route lookup for that aircraft is performed at most once (until its cache entry is cleared), with subsequent lookups from either consumer reusing the same cached result

#### Scenario: Unresolvable airline or route renders empty
- **WHEN** an aircraft's callsign prefix has no known airline match, or the route lookup finds no plausible route
- **THEN** the Airline and/or Route column renders an empty/placeholder indicator rather than erroring or blocking the rest of the row

### Requirement: Search, filters, and columns persist across reloads, with one reset control
The search text, every filter's current value, and column visibility SHALL each persist to `localStorage` and be restored the next time the plane listing panel is opened. A single "Clear all" control SHALL reset search text, all filters, and column visibility to their defaults in one action and remove all of this panel's persisted state.

#### Scenario: Search text persists across a reload
- **WHEN** the user enters search text, then reloads the page and reopens the drawer
- **THEN** the Search tab's field still contains the previously entered text, and the table is filtered accordingly

#### Scenario: Filter values persist across a reload
- **WHEN** the user sets one or more filters, then reloads the page and reopens the drawer
- **THEN** the Filters tab still reflects the previously set values, and the table is filtered accordingly

#### Scenario: Clear all resets and wipes persisted state in one action
- **WHEN** the user activates "Clear all"
- **THEN** search text is emptied, every filter is reset to its default, every column returns to the default-visible set, the table reflects all of this immediately, and no persisted state for this panel remains in `localStorage`

### Requirement: Table rows are color-coded by source, with a shared, always-visible legend/filter chip row
Each table row SHALL render with a background tint corresponding to its resolved source bucket (ADS-B, UAT/ADS-R, MLAT, TIS-B, Mode-S, or Other — the same buckets as the Source filter). The same Source chip row SHALL also render pinned beneath the table at all times, regardless of which tab (Search/Filters/Columns) is active, acting as both a legend and a live shortcut to the Source filter.

#### Scenario: Row background reflects its source bucket
- **WHEN** an aircraft's resolved source bucket is known
- **THEN** that aircraft's row renders with the background tint associated with that bucket, distinguishable from rows in a different bucket

#### Scenario: Legend chip row is visible beneath the table regardless of active tab
- **WHEN** the drawer is open and any of Search, Filters, or Columns is the active tab
- **THEN** the Source chip row is visible pinned beneath the table

#### Scenario: Clicking a legend chip toggles the Source filter
- **WHEN** the user clicks a chip in the pinned legend row beneath the table
- **THEN** that source bucket's filter state toggles exactly as if the same chip had been clicked from within the Filters tab, and the table's visible rows update accordingly

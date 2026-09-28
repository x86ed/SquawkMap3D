## MODIFIED Requirements

### Requirement: PlaneCard shows aircraft identity and rarity tier
`PlaneCard` SHALL render as a two-face flip card (a back face shown by default and a front face revealed on hover, per the "PlaneCard is a two-face flip card" behavior below), and SHALL display the selected aircraft's registration and manufacturer/model when known, and SHALL display its computed rarity tier — one of the nine real tier values defined by the `aircraft-rarity` capability (`unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, `apex`) — as a labeled tag on both faces, with the card's frame/accent styling driven by that tier's `{ color, highlight, glow }` style (per the `aircraft-rarity` capability), including the `mythic`/`apex` gradient frame overrides. Fields with no known value SHALL render an explicit placeholder rather than blank space or the literal string "undefined"/"null". Operator is intentionally not shown here — adsb.win's own real card has no operator field (confirmed on its live authenticated dashboard); it's shown instead by `RecordPanelHero`'s spec grid.

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
`PlaneCard`'s back face SHALL render its stat region using the `adsb-win-aircraft-stats` capability's aircraft-model-card result for the selected aircraft's type, distinguishing the following states, and SHALL NEVER fabricate a value not present in that result:
- **No aircraft type known** (the feeder hasn't loaded tar1090-db for this aircraft) or **the account hasn't captured this type** (`404 not_found`): an explicit "not tracked yet" empty state — no fabricated numbers, no collapsed/blank gap.
- **No feeder UUID configured**: an inline prompt to enter one, with a way to save it.
- **Feeder UUID not recognized** (`401 invalid_token`): a message indicating the configured feeder UUID isn't recognized, with a way to update it.
- **Request failed for another reason**: a generic "unable to load stats right now" message.
- **Successful card result**: a stat grid showing unique registrations, flights captured, observed flight time, and highest altitude observed (rendering an explicit placeholder for highest altitude when the API reports it as `null`), plus the account's current XP count, current adsb.win tier name, and a progress-to-next-tier bar computed from a confirmed, tester-sourced default XP threshold table (no per-tier threshold is documented by adsb.win's API itself, but the tester has supplied the real values directly; see `adsb-win-aircraft-card-api`'s design.md Decision 4/4a) — never claiming 100%/promotion on a non-max tier ahead of what the API's own `tier` field reports, and rendering no bar at all (XP count and tier name only) if the reported tier name isn't one this table recognizes (e.g. a future tier adsb.win adds above the current max). This tier name and progress bar are adsb.win's own account-progression tier and are displayed separately from, and do not affect, `PlaneCard`'s existing `rarityTier`-driven frame/badge styling (`aircraft-rarity` capability), which continues to be sourced independently and is unaffected by this requirement. The front face's XP panel (see "PlaneCard is a two-face flip card") mirrors the XP count/tier/progress-bar portion of this same data; it does not duplicate the stat grid.

#### Scenario: No aircraft type known renders the empty state
- **WHEN** the selected aircraft has no known type designator
- **THEN** `PlaneCard`'s back face renders the "not tracked yet" empty state for the stat region, with no fabricated numbers

#### Scenario: Account hasn't captured this aircraft type renders the same empty state
- **WHEN** the selected aircraft's type is known, a feeder UUID is configured, and adsb.win reports `404 not_found` for that type
- **THEN** `PlaneCard`'s back face renders the same "not tracked yet" empty state, with no wording implying whether another account has captured it

#### Scenario: No feeder UUID configured shows a configuration prompt
- **WHEN** the selected aircraft's type is known and no feeder UUID has been saved in this browser
- **THEN** `PlaneCard`'s back-face stat region shows a prompt to enter a feeder UUID, with a way to save it, and does not render a "not tracked yet" or fabricated-stats state instead

#### Scenario: Invalid or unclaimed feeder UUID shows a distinct message
- **WHEN** a feeder UUID is configured and adsb.win reports `401 invalid_token` for it
- **THEN** `PlaneCard`'s back-face stat region shows a message indicating the feeder UUID isn't recognized, with a way to update it, distinct from the "not tracked yet" empty state

#### Scenario: Other request failures show a generic error state
- **WHEN** a feeder UUID is configured, the aircraft type is known, and the request fails for a reason other than `401`/`404`
- **THEN** `PlaneCard`'s back-face stat region shows a generic "unable to load stats right now" message, not a fabricated value and not the "not tracked yet" empty state

#### Scenario: Successful card result renders real stats, XP, tier name, and a confirmed progress bar
- **WHEN** a feeder UUID is configured, adsb.win returns a successful aircraft-model card for the selected aircraft's type, and the response's `tier` name is one the app's confirmed threshold table recognizes
- **THEN** `PlaneCard`'s back face renders the unique registrations, flights captured, observed flight time, and highest altitude values from that response (an explicit placeholder for highest altitude if it is `null`), plus the response's XP count, tier name, and a progress-to-next-tier bar computed from the confirmed threshold table, never showing 100%/a completed bar unless the tier is the table's max tier

#### Scenario: An unrecognized tier name renders XP and tier name with no progress bar
- **WHEN** a successful card result's `tier` name is not one the confirmed threshold table recognizes
- **THEN** `PlaneCard`'s back face renders the XP count and tier name as plain values with no progress bar, rather than fabricating a percentage for an unknown tier

#### Scenario: rarityTier styling is unaffected by the real tier name or its progress bar
- **WHEN** a successful card result is rendered, including its own tier name and any progress bar
- **THEN** `PlaneCard`'s frame/border styling and rarity badge (shown on both faces) continue to reflect `rarityTier` exactly as before this requirement's change, unaffected by the card result's tier name or progress bar

## ADDED Requirements

### Requirement: PlaneCard is a two-face flip card that opens adsb.win on click
`PlaneCard` SHALL render as a two-face card (front and back) sharing one tier-styled frame, flipping via a pure CSS 3D transform triggered by hover. Which face rests forward (is shown without hover/interaction) SHALL be controlled by a `showBack` flag on `PlaneCard`, which SHALL default to `true` (back face resting forward) when a view mounting `PlaneCard` does not pass it explicitly. The back face shows the selected aircraft's identity header and the fleet-wide stat region described in "PlaneCard shows optional fleet-wide stats when available, never fabricated"; the front face shows the identity header, rarity/tier pills, the aircraft's 3D-model or silhouette art (per "PlaneCard's front face shows a 3D model of the aircraft" below), and an XP summary panel. Every view in this app that mounts `PlaneCard` SHALL use `showBack`'s enabled (`true`) default, so the back face is what's shown at rest everywhere `PlaneCard` currently appears. Clicking anywhere on either face, other than the feeder-UUID form's input/button or any rendered link, SHALL open `https://adsb.win/dashboard/aircraft/{TYPE_DESIGNATOR}` (the selected aircraft's ICAO type designator, uppercased) in a new browser tab, when a type designator is known; when no type designator is known, the card SHALL NOT be clickable.

#### Scenario: Back face is shown by default
- **WHEN** the overlay is open for a selected aircraft, `PlaneCard` is mounted without an explicit `showBack` value, and the user is not hovering `PlaneCard`
- **THEN** `PlaneCard` displays its back face (identity header and stat region)

#### Scenario: Every current view mounting PlaneCard shows the back face at rest
- **WHEN** any view in this app that renders `PlaneCard` (currently `AircraftOverlay`) is mounted for a selected aircraft, with no hover interaction
- **THEN** that view's `PlaneCard` instance shows its back face at rest, per `showBack`'s enabled-by-default value

#### Scenario: Hovering reveals the front face
- **WHEN** the user hovers `PlaneCard` while `showBack` is at its default (`true`)
- **THEN** `PlaneCard` flips via its CSS 3D transform to display its front face (identity header, rarity/tier pills, 3D-model/silhouette art, and XP panel)

#### Scenario: Ending hover returns to the back face
- **WHEN** the user was hovering `PlaneCard` (front face visible, `showBack` at its default) and stops hovering it
- **THEN** `PlaneCard` flips back to display its back face

#### Scenario: Clicking the card opens the aircraft's adsb.win dashboard page
- **WHEN** the user clicks anywhere on `PlaneCard` (either face) for an aircraft with a known type designator, outside of the feeder-UUID form's input/button or any rendered link
- **THEN** a new browser tab opens to `https://adsb.win/dashboard/aircraft/{TYPE_DESIGNATOR}` for that aircraft's uppercased type designator

#### Scenario: Card is not clickable when the type designator is unknown
- **WHEN** the selected aircraft has no known type designator
- **THEN** clicking `PlaneCard` does not open any adsb.win page

#### Scenario: Clicking the feeder-UUID form or a link does not trigger navigation
- **WHEN** the user clicks the feeder-UUID form's input or submit button, or any rendered link, on `PlaneCard`'s back face
- **THEN** no adsb.win dashboard tab opens, and the form/link's own behavior proceeds normally

### Requirement: PlaneCard's front face shows a 3D model of the aircraft
`PlaneCard`'s front face SHALL render a live 3D wireframe of the selected aircraft's model, tinted to the aircraft's rarity-tier color, when a vendored 3D model exists for that aircraft's type designator (or, absent that, its emitter category's fallback type — the same resolution the map's own 3D aircraft rendering uses). When no vendored 3D model exists for the aircraft (by either resolution), or loading it fails, the front face SHALL instead render the same flat 2D top-view silhouette used elsewhere in this app (per "PlaneCard shows aircraft identity and rarity tier"'s silhouette), tinted to the same rarity-tier color, rather than an empty or broken art region.

#### Scenario: Modeled aircraft type renders a 3D wireframe
- **WHEN** the selected aircraft's type designator (or its emitter category's fallback type) has a vendored 3D model
- **THEN** `PlaneCard`'s front face renders a live 3D wireframe render of that model, tinted to the aircraft's rarity-tier color

#### Scenario: Unmodeled aircraft type renders the flat silhouette fallback
- **WHEN** the selected aircraft's type designator has no vendored 3D model and its emitter category has no fallback modeled type either
- **THEN** `PlaneCard`'s front face renders the flat 2D top-view silhouette, tinted to the aircraft's rarity-tier color, rather than a blank art region

#### Scenario: A failed model load falls back to the flat silhouette
- **WHEN** the selected aircraft's type designator has a vendored 3D model, but loading or parsing that model fails
- **THEN** `PlaneCard`'s front face renders the flat 2D top-view silhouette fallback rather than a blank or broken art region

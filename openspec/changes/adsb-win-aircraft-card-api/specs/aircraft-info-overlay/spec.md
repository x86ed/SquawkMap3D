## MODIFIED Requirements

### Requirement: PlaneCard shows optional fleet-wide stats when available, never fabricated
`PlaneCard` SHALL render its stat region using the `adsb-win-aircraft-stats` capability's aircraft-model-card result for the selected aircraft's type, distinguishing the following states, and SHALL NEVER fabricate a value not present in that result:
- **No aircraft type known** (the feeder hasn't loaded tar1090-db for this aircraft) or **the account hasn't captured this type** (`404 not_found`): an explicit "not tracked yet" empty state — no fabricated numbers, no collapsed/blank gap.
- **No feeder UUID configured**: an inline prompt to enter one, with a way to save it.
- **Feeder UUID not recognized** (`401 invalid_token`): a message indicating the configured feeder UUID isn't recognized, with a way to update it.
- **Request failed for another reason**: a generic "unable to load stats right now" message.
- **Successful card result**: a stat grid showing unique registrations, flights captured, observed flight time, and highest altitude observed (rendering an explicit placeholder for highest altitude when the API reports it as `null`), plus the account's current XP count and current adsb.win tier name for that aircraft type — shown as plain values, not a fabricated percent-progress bar (no documented data exists to compute one; see `adsb-win-aircraft-card-api`'s design.md Decision 4). This tier name is adsb.win's own account-progression tier and is displayed separately from, and does not affect, `PlaneCard`'s existing `rarityTier`-driven frame/badge styling (`aircraft-rarity` capability), which continues to be sourced independently and is unaffected by this requirement.

#### Scenario: No aircraft type known renders the empty state
- **WHEN** the selected aircraft has no known type designator
- **THEN** `PlaneCard` renders the "not tracked yet" empty state for the stat region, with no fabricated numbers

#### Scenario: Account hasn't captured this aircraft type renders the same empty state
- **WHEN** the selected aircraft's type is known, a feeder UUID is configured, and adsb.win reports `404 not_found` for that type
- **THEN** `PlaneCard` renders the same "not tracked yet" empty state, with no wording implying whether another account has captured it

#### Scenario: No feeder UUID configured shows a configuration prompt
- **WHEN** the selected aircraft's type is known and no feeder UUID has been saved in this browser
- **THEN** `PlaneCard`'s stat region shows a prompt to enter a feeder UUID, with a way to save it, and does not render a "not tracked yet" or fabricated-stats state instead

#### Scenario: Invalid or unclaimed feeder UUID shows a distinct message
- **WHEN** a feeder UUID is configured and adsb.win reports `401 invalid_token` for it
- **THEN** `PlaneCard`'s stat region shows a message indicating the feeder UUID isn't recognized, with a way to update it, distinct from the "not tracked yet" empty state

#### Scenario: Other request failures show a generic error state
- **WHEN** a feeder UUID is configured, the aircraft type is known, and the request fails for a reason other than `401`/`404`
- **THEN** `PlaneCard`'s stat region shows a generic "unable to load stats right now" message, not a fabricated value and not the "not tracked yet" empty state

#### Scenario: Successful card result renders real stats, XP, and tier name
- **WHEN** a feeder UUID is configured and adsb.win returns a successful aircraft-model card for the selected aircraft's type
- **THEN** `PlaneCard` renders the unique registrations, flights captured, observed flight time, and highest altitude values from that response (an explicit placeholder for highest altitude if it is `null`), plus the response's XP count and tier name, using only values present in the response — never a fabricated percent-progress bar

#### Scenario: rarityTier styling is unaffected by the real tier name
- **WHEN** a successful card result is rendered, including its own tier name
- **THEN** `PlaneCard`'s frame/border styling and bottom-edge rarity badge continue to reflect `rarityTier` exactly as before this requirement's change, unaffected by the card result's tier name

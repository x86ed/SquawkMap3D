## MODIFIED Requirements

### Requirement: PlaneCard shows optional fleet-wide stats when available, never fabricated
`PlaneCard` SHALL render its stat region using the `adsb-win-aircraft-stats` capability's aircraft-model-card result for the selected aircraft's type, distinguishing the following states, and SHALL NEVER fabricate a value not present in that result:
- **No aircraft type known** (the feeder hasn't loaded tar1090-db for this aircraft) or **the account hasn't captured this type** (`404 not_found`): an explicit "not tracked yet" empty state — no fabricated numbers, no collapsed/blank gap.
- **No feeder UUID configured**: an inline prompt to enter one, with a way to save it.
- **Feeder UUID not recognized** (`401 invalid_token`): a message indicating the configured feeder UUID isn't recognized, with a way to update it.
- **Request failed for another reason**: a generic "unable to load stats right now" message.
- **Successful card result**: a stat grid showing unique registrations, flights captured, observed flight time, and highest altitude observed (rendering an explicit placeholder for highest altitude when the API reports it as `null`), plus the account's current XP count, current adsb.win tier name, and a progress-to-next-tier bar computed from a confirmed, tester-sourced default XP threshold table (no per-tier threshold is documented by adsb.win's API itself, but the tester has supplied the real values directly; see `adsb-win-aircraft-card-api`'s design.md Decision 4/4a) — never claiming 100%/promotion on a non-max tier ahead of what the API's own `tier` field reports, and rendering no bar at all (XP count and tier name only) if the reported tier name isn't one this table recognizes (e.g. a future tier adsb.win adds above the current max). This tier name and progress bar are adsb.win's own account-progression tier and are displayed separately from, and do not affect, `PlaneCard`'s existing `rarityTier`-driven frame/badge styling (`aircraft-rarity` capability), which continues to be sourced independently and is unaffected by this requirement.

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

#### Scenario: Successful card result renders real stats, XP, tier name, and a confirmed progress bar
- **WHEN** a feeder UUID is configured, adsb.win returns a successful aircraft-model card for the selected aircraft's type, and the response's `tier` name is one the app's confirmed threshold table recognizes
- **THEN** `PlaneCard` renders the unique registrations, flights captured, observed flight time, and highest altitude values from that response (an explicit placeholder for highest altitude if it is `null`), plus the response's XP count, tier name, and a progress-to-next-tier bar computed from the confirmed threshold table, never showing 100%/a completed bar unless the tier is the table's max tier

#### Scenario: An unrecognized tier name renders XP and tier name with no progress bar
- **WHEN** a successful card result's `tier` name is not one the confirmed threshold table recognizes
- **THEN** `PlaneCard` renders the XP count and tier name as plain values with no progress bar, rather than fabricating a percentage for an unknown tier

#### Scenario: rarityTier styling is unaffected by the real tier name or its progress bar
- **WHEN** a successful card result is rendered, including its own tier name and any progress bar
- **THEN** `PlaneCard`'s frame/border styling and bottom-edge rarity badge continue to reflect `rarityTier` exactly as before this requirement's change, unaffected by the card result's tier name or progress bar

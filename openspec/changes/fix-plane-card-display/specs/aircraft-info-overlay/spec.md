## MODIFIED Requirements

### Requirement: PlaneCard shows aircraft identity and rarity tier
`PlaneCard` SHALL display the selected aircraft's registration and manufacturer/model when known, and SHALL display its computed rarity tier — one of the nine real tier values defined by the `aircraft-rarity` capability (`unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, `apex`) — as a labeled tag, with the card's frame/accent styling driven by that tier's `{ color, highlight, glow }` style (per the `aircraft-rarity` capability), including the `mythic`/`apex` gradient frame overrides and their animated diagonal sheen highlight. Fields with no known value SHALL render an explicit placeholder rather than blank space or the literal string "undefined"/"null". Operator is intentionally not shown here — adsb.win's own real card has no operator field (confirmed on its live authenticated dashboard); it's shown instead by `RecordPanelHero`'s spec grid.

#### Scenario: Full identity data known
- **WHEN** the selected aircraft has a known registration and manufacturer/model description
- **THEN** `PlaneCard` displays both, alongside a tag showing the aircraft's rarity tier name (one of the nine real tier values) styled with that tier's accent style

#### Scenario: Identity data unknown
- **WHEN** the selected aircraft is missing its registration and/or manufacturer/model (e.g. the feeder has no tar1090-db loaded)
- **THEN** `PlaneCard` renders an explicit "unknown" placeholder for each missing field, with no literal "undefined"/"null" text and no blank/missing row

#### Scenario: Aircraft with no rarity classification renders the unidentified tier honestly
- **WHEN** the selected aircraft's computed rarity tier is `unidentified` (no type designator, or no matching entry in the vendored rareness dataset)
- **THEN** `PlaneCard` displays the `unidentified` tier's own tag/style rather than substituting the `standard` tier's style or omitting the tag entirely

#### Scenario: Mythic and apex tiers show an animated sheen highlight
- **WHEN** the selected aircraft's computed rarity tier is `mythic` or `apex`
- **THEN** `PlaneCard`'s frame renders a continuously animated diagonal highlight sweep across it, in addition to that tier's already-distinct gradient background, matching adsb.win's own reference styling for those two tiers

### Requirement: PlaneCard shows optional fleet-wide stats when available, never fabricated
`PlaneCard` SHALL render its stat region using the `adsb-win-aircraft-stats` capability's aircraft-model-card result for the selected aircraft's type, distinguishing the following states, and SHALL NEVER fabricate a value not present in that result:
- **No aircraft type known** (the feeder hasn't loaded tar1090-db for this aircraft) or **the account hasn't captured this type** (`404 not_found`): an explicit "not tracked yet" empty state — no fabricated numbers, no collapsed/blank gap.
- **No feeder UUID configured**: an inline prompt to enter one, with a way to save it.
- **Feeder UUID not recognized** (`401 invalid_token`): a message indicating the configured feeder UUID isn't recognized, with a way to update it.
- **Request failed for another reason**: a generic "unable to load stats right now" message.
- **Successful card result**: a stat grid showing unique registrations, flights captured, observed flight time, and highest altitude observed (rendering an explicit placeholder for highest altitude when the API reports it as `null`), plus the account's current XP count, current adsb.win tier name, and a progress-to-next-tier bar computed from a confirmed, tester-sourced default XP threshold table (no per-tier threshold is documented by adsb.win's API itself, but the tester has supplied the real values directly; see `adsb-win-aircraft-card-api`'s design.md Decision 4/4a) — never claiming 100%/promotion on a non-max tier ahead of what the API's own `tier` field reports, and rendering no bar at all (XP count and tier name only) if the reported tier name isn't one this table recognizes (e.g. a future tier adsb.win adds above the current max). This tier name and progress bar are adsb.win's own account-progression tier and are displayed separately from, and do not affect, `PlaneCard`'s existing `rarityTier`-driven frame/badge styling (`aircraft-rarity` capability), which continues to be sourced independently and is unaffected by this requirement.

When the reported tier name is one the confirmed threshold table recognizes (`carbon`/`alloy`/`titanium`/`iridium`/`plasma`/`quantum`), the tier name's own badge, its XP progress bar, and the card's body background/decorative surface treatment SHALL each render using that specific tier's own real accent colors and (where the reference defines one) animated decoration — matching adsb.win's own per-material-tier styling — rather than a single flat/neutral style shared by every tier. When the reported tier name is not one this table recognizes, or when there is no successful card result at all, the tier badge, progress-bar-area (if rendered), and card body SHALL render using today's existing flat/neutral styling, never a guessed or partial tier-specific style.

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

#### Scenario: A recognized material tier renders that tier's own badge, progress-bar, and card-body accent colors
- **WHEN** a successful card result's `tier` name is one the confirmed threshold table recognizes (`carbon`/`alloy`/`titanium`/`iridium`/`plasma`/`quantum`)
- **THEN** the tier badge, the XP progress bar's fill, and the card body's background/decorative overlay all render using that specific tier's own real accent colors (not a single shared flat style), and, for tiers the reference defines an animation for, that animation plays

#### Scenario: An unrecognized or absent material tier keeps today's neutral styling
- **WHEN** there is no successful card result, or a successful result's `tier` name is not one the confirmed threshold table recognizes
- **THEN** the tier badge (if rendered at all) and the card body render using today's existing flat/neutral styling, with no tier-specific accent color or animation applied

## ADDED Requirements

### Requirement: PlaneCard's shrink-to-fit preserves the proportions of its content
When `PlaneCard`'s own measured content (its header plus stat region) is taller than the space available inside the card, `PlaneCard` SHALL shrink that content uniformly — preserving the width-to-height proportions of every element within it (badges, headings, the aircraft silhouette, stat numbers) — rather than compressing only one axis and distorting those proportions. `PlaneCard` SHALL NOT shrink its content below the point where it already fits (a scale factor greater than 1 SHALL NOT be applied).

#### Scenario: Overflowing content shrinks without distorting proportions
- **WHEN** `PlaneCard`'s measured content is taller than the card's available height
- **THEN** the content shrinks uniformly on both axes until it fits, so that every badge, heading, and the aircraft silhouette retain their original width-to-height proportions rather than appearing flattened or stretched on one axis only

#### Scenario: Content that already fits is not scaled up
- **WHEN** `PlaneCard`'s measured content is not taller than the card's available height
- **THEN** the content renders at its natural, unscaled size

#### Scenario: Resizing the card recomputes the shrink factor
- **WHEN** the card's available height changes (e.g. the overlay drawer is resized) while an aircraft is selected
- **THEN** `PlaneCard` recomputes and reapplies its uniform shrink factor to match the new available height, still without distorting proportions

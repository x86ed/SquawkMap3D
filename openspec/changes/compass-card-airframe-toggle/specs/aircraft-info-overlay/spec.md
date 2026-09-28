## MODIFIED Requirements

### Requirement: PlaneCard shows aircraft identity and rarity tier
`PlaneCard` SHALL render as a two-face flip card (a back face shown by default and a front face revealed on hover, per the "PlaneCard is a two-face flip card" behavior below), and SHALL display the selected aircraft's registration and manufacturer/model (its "type") when known, with an adjacent "Edit" control on the type display (per the `aircraft-record-edit-links` capability) whenever a type designator is known, and SHALL display its computed rarity tier — one of the nine real tier values defined by the `aircraft-rarity` capability (`unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, `apex`) — as a labeled tag on both faces, with the card's frame/accent styling driven by that tier's `{ color, highlight, glow }` style (per the `aircraft-rarity` capability), including the `mythic`/`apex` gradient frame overrides. Fields with no known value SHALL render an explicit placeholder rather than blank space or the literal string "undefined"/"null". Operator is intentionally not shown here — adsb.win's own real card has no operator field (confirmed on its live authenticated dashboard); it's shown instead by `RecordPanelHero`'s spec grid.

#### Scenario: Full identity data known
- **WHEN** the selected aircraft has a known registration and manufacturer/model description
- **THEN** `PlaneCard` displays both, alongside a tag showing the aircraft's rarity tier name (one of the nine real tier values) styled with that tier's accent style

#### Scenario: Identity data unknown
- **WHEN** the selected aircraft is missing its registration and/or manufacturer/model (e.g. the feeder has no tar1090-db loaded)
- **THEN** `PlaneCard` renders an explicit "unknown" placeholder for each missing field, with no literal "undefined"/"null" text and no blank/missing row

#### Scenario: Aircraft with no rarity classification renders the unidentified tier honestly
- **WHEN** the selected aircraft's computed rarity tier is `unidentified` (no type designator, or no matching entry in the vendored rareness dataset)
- **THEN** `PlaneCard` displays the `unidentified` tier's own tag/style rather than substituting the `standard` tier's style or omitting the tag entirely

#### Scenario: Type edit control shown when a type designator is known
- **WHEN** the selected aircraft has a known ICAO type designator
- **THEN** `PlaneCard`'s type display shows an adjacent "Edit" control alongside the manufacturer/model text

#### Scenario: No type edit control when the type designator is unknown
- **WHEN** the selected aircraft has no known ICAO type designator
- **THEN** `PlaneCard`'s type display renders its "unknown" placeholder with no "Edit" control shown

### Requirement: RecordPanelHero shows identity and specs with aspect-driven reflow
`RecordPanelHero` SHALL display the selected aircraft's registration (as its primary heading, with an adjacent "Edit" control per the `aircraft-record-edit-links` capability), callsign, ICAO hex, and a spec grid of manufacturer, model, operator, and age (when known). Its internal layout SHALL reflow between a portrait and landscape arrangement based on its own measured container aspect ratio, not the browser viewport's aspect ratio. Its image area SHALL show either the selected aircraft's Planespotters photo or the live compass card (per the `airframe-compass-card` capability), never the bare "✈" placeholder glyph that this requirement previously specified for the no-photo case.

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

#### Scenario: No-photo case shows the compass card, not the old blank placeholder
- **WHEN** the selected aircraft has no Planespotters photo available
- **THEN** `RecordPanelHero`'s image area shows the live compass card (per the `airframe-compass-card` capability) rather than a bare placeholder glyph

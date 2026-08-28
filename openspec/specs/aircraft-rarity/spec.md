# aircraft-rarity Specification

## Purpose
TBD - created by archiving change aircraft-info-overlay. Update Purpose after archive.

## Requirements

### Requirement: Rarity value computed from a vendored per-type rareness dataset
The system SHALL compute a numeric rarity value for any given aircraft by looking up its normalized type designator against a build-time-vendored snapshot of a real per-aircraft-type rareness dataset (`components/map/data/aircraftRareness.json`, trimmed from the `taildragger` project's `aircraft-data.json`), never fetching that snapshot's source repository at runtime, and never erroring for an aircraft with no type designator or an unrecognized one.

#### Scenario: Known type designator resolves a dataset-backed rarity value
- **WHEN** an aircraft's type designator matches an entry in the vendored rareness snapshot
- **THEN** its computed rarity value is that entry's `rareness` field divided by 100

#### Scenario: Unknown or missing type designator resolves no numeric value
- **WHEN** an aircraft has no type designator, or a type designator with no matching entry in the vendored rareness snapshot
- **THEN** its computed rarity value is undefined — there is no fixed numeric fallback, since such an aircraft is not placed on the numeric scale at all (see the `unidentified` tier requirement below)

### Requirement: Rarity tier taxonomy matches adsb.win's real, verified 9-value taxonomy
The system SHALL classify every aircraft into exactly one of adsb.win's own nine rarity tiers, in this confirmed low-to-high order: `unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, `apex`. These tier names are adsb.win's own real, verified values (independently confirmed against `https://adsb.win/assets/tailwind-255296c3.css`) — not an invented or approximated taxonomy.

#### Scenario: Every computed tier is one of the nine real values
- **WHEN** `computeRarityTier` is called for any aircraft, known or unknown
- **THEN** the returned tier is exactly one of `unidentified`, `standard`, `prime`, `remarkable`, `exceptional`, `epic`, `legendary`, `mythic`, or `apex` — no other value is ever returned

### Requirement: Unidentified is a distinct no-classification case, not a numeric bucket
The `unidentified` tier SHALL be returned directly for any aircraft with no computed rarity value (no type designator, or a type designator absent from the vendored rareness snapshot) — it SHALL NOT be reached by bucketing a numeric rarity value against a threshold, mirroring adsb.win's own behavior of showing no rarity classification at all for a type it doesn't recognize.

#### Scenario: No type designator yields the unidentified tier
- **WHEN** an aircraft has no type designator
- **THEN** its computed rarity tier is `unidentified`

#### Scenario: Unrecognized type designator yields the unidentified tier
- **WHEN** an aircraft has a type designator with no matching entry in the vendored rareness snapshot
- **THEN** its computed rarity tier is `unidentified`

### Requirement: The other eight tiers bucket via fixed, data-derived octile thresholds
For any aircraft with a defined computed rarity value, the system SHALL bucket that value into one of the eight named tiers (`standard` through `apex`) using seven fixed threshold cutpoints derived from the vendored rareness dataset's own distribution (equal-population octiles: the 12.5th/25th/37.5th/50th/62.5th/75th/87.5th percentiles of the 1679 scored rows), rather than arbitrarily chosen cutpoints. These thresholds are pinned constants, not recomputed at runtime.

#### Scenario: Rarity value below the first threshold yields standard tier
- **WHEN** an aircraft's computed rarity value is less than `5.84`
- **THEN** its computed rarity tier is `standard`

#### Scenario: Rarity value in the second band yields prime tier
- **WHEN** an aircraft's computed rarity value is at least `5.84` and less than `7.55`
- **THEN** its computed rarity tier is `prime`

#### Scenario: Rarity value in the third band yields remarkable tier
- **WHEN** an aircraft's computed rarity value is at least `7.55` and less than `8.98`
- **THEN** its computed rarity tier is `remarkable`

#### Scenario: Rarity value in the fourth band yields exceptional tier
- **WHEN** an aircraft's computed rarity value is at least `8.98` and less than `10.26`
- **THEN** its computed rarity tier is `exceptional`

#### Scenario: Rarity value in the fifth band yields epic tier
- **WHEN** an aircraft's computed rarity value is at least `10.26` and less than `11.45`
- **THEN** its computed rarity tier is `epic`

#### Scenario: Rarity value in the sixth band yields legendary tier
- **WHEN** an aircraft's computed rarity value is at least `11.45` and less than `12.66`
- **THEN** its computed rarity tier is `legendary`

#### Scenario: Rarity value in the seventh band yields mythic tier
- **WHEN** an aircraft's computed rarity value is at least `12.66` and less than `14.00`
- **THEN** its computed rarity tier is `mythic`

#### Scenario: Rarity value at or above the last threshold yields apex tier
- **WHEN** an aircraft's computed rarity value is `14.00` or greater
- **THEN** its computed rarity tier is `apex`

### Requirement: Rarity tier maps to adsb.win's real, verified-exact accent style
Each of the nine rarity tiers SHALL map to a distinct `{ color, highlight, glow }` accent style, exactly matching adsb.win's own real, verified CSS custom-property values for that tier's `.aircraft-rarity--<tier>` rule (or, for `unidentified`, the base `.aircraft-rarity` rule's own defaults) — not approximated or hand-picked. `mythic` and `apex` additionally use a fully-overridden gradient `background` (a rainbow conic-gradient for `mythic`, a pearlescent linear-gradient for `apex`) instead of the shared gradient formula the other seven tiers use, matching adsb.win's own CSS exactly.

#### Scenario: Every tier resolves to a defined style
- **WHEN** any of the nine rarity tiers is looked up for its accent style
- **THEN** a defined, non-empty `color`, `highlight`, and `glow` value is returned for that tier

#### Scenario: Unidentified and standard have distinct styles despite similar colors
- **WHEN** the `unidentified` and `standard` tiers' accent styles are compared
- **THEN** both share the same `color` (`#64748b`) and `highlight` (`#cbd5e1`), but their `glow` values differ (`unidentified` is `#64748b33`, `standard` is `#94a3b83d`) — `unidentified` is never treated as an alias for `standard`

#### Scenario: Mythic and apex use gradient frame overrides, not the shared formula
- **WHEN** the `mythic` or `apex` tier's frame styling is applied
- **THEN** the frame's `background` is that tier's own literal gradient (a conic rainbow gradient for `mythic`, a pearlescent linear gradient for `apex`) rather than the shared `linear-gradient(135deg, highlight, color 35%, color)` formula used by the other seven tiers

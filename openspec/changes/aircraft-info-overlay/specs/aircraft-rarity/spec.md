## ADDED Requirements

### Requirement: Rarity value computed from a vendored per-type rareness dataset
The system SHALL compute a numeric rarity value for any given aircraft by looking up its normalized type designator against a build-time-vendored snapshot of a real per-aircraft-type rareness dataset (`components/map/data/aircraftRareness.json`, trimmed from the `taildragger` project's `aircraft-data.json`), never fetching that snapshot's source repository at runtime, and never erroring for an aircraft with no type designator or an unrecognized one.

#### Scenario: Known type designator resolves a dataset-backed rarity value
- **WHEN** an aircraft's type designator matches an entry in the vendored rareness snapshot
- **THEN** its computed rarity value is that entry's `rareness` field divided by 100

#### Scenario: Unknown or missing type designator resolves the fixed default
- **WHEN** an aircraft has no type designator, or a type designator with no matching entry in the vendored rareness snapshot
- **THEN** its computed rarity value is the fixed default of `15`

### Requirement: Rarity value buckets into one of five tiers via fixed, data-derived thresholds
The system SHALL bucket a computed rarity value into one of five tiers — `common`, `uncommon`, `rare`, `epic`, or `legendary` — using four fixed threshold cutpoints derived from the vendored rareness dataset's own distribution (equal-population quintiles: `6.91`, `9.19`, `11.18`, `13.15`), rather than arbitrarily chosen cutpoints. These thresholds are pinned constants, not recomputed at runtime.

#### Scenario: Rarity value below the first threshold yields common tier
- **WHEN** an aircraft's computed rarity value is less than `6.91`
- **THEN** its computed rarity tier is `common`

#### Scenario: Rarity value in the second band yields uncommon tier
- **WHEN** an aircraft's computed rarity value is at least `6.91` and less than `9.19`
- **THEN** its computed rarity tier is `uncommon`

#### Scenario: Rarity value in the third band yields rare tier
- **WHEN** an aircraft's computed rarity value is at least `9.19` and less than `11.18`
- **THEN** its computed rarity tier is `rare`

#### Scenario: Rarity value in the fourth band yields epic tier
- **WHEN** an aircraft's computed rarity value is at least `11.18` and less than `13.15`
- **THEN** its computed rarity tier is `epic`

#### Scenario: Rarity value at or above the last threshold yields legendary tier
- **WHEN** an aircraft's computed rarity value is `13.15` or greater
- **THEN** its computed rarity tier is `legendary`

#### Scenario: Unrecognized type designator yields legendary tier by default
- **WHEN** an aircraft's computed rarity value is the fixed default (`15`, per the unknown-type-designator scenario above)
- **THEN** its computed rarity tier is `legendary`, since `15` falls at or above the `13.15` threshold

### Requirement: Rarity tier maps to a distinct accent color
Each rarity tier SHALL map to a distinct accent color usable consistently anywhere a tier is displayed (map highlight, drawer components): `common` = slate, `uncommon` = green, `rare` = cyan, `epic` = violet, `legendary` = yellow.

#### Scenario: Every tier resolves to a color
- **WHEN** any of the five rarity tiers is looked up for its accent color
- **THEN** a defined, non-empty color value is returned for that tier

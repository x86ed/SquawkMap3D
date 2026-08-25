## ADDED Requirements

### Requirement: Rarity tier computed per aircraft
The system SHALL compute a rarity tier for any given aircraft, one of `common`, `uncommon`, `rare`, `epic`, or `legendary`, derived from fields already present on that aircraft's normalized data (ADS-B emitter category, whether its type designator resolves to a vendored icon shape, and its reported squawk code) — never requiring a field this app does not already collect, and never erroring for an aircraft with sparse data.

#### Scenario: Emergency squawk yields legendary tier
- **WHEN** an aircraft's squawk is `7500`, `7600`, or `7700`
- **THEN** its computed rarity tier is `legendary`

#### Scenario: Uncommon category yields epic tier
- **WHEN** an aircraft's squawk is not an emergency code and its ADS-B emitter category is one of the categories designated uncommon (glider/sailplane, lighter-than-air, parachutist/skydiver, ultralight/hang-glider/paraglider, unmanned aerial vehicle, space/transatmospheric vehicle, or high-performance)
- **THEN** its computed rarity tier is `epic`

#### Scenario: Known type designator without a vendored icon yields rare tier
- **WHEN** an aircraft has neither an emergency squawk nor an uncommon category, and reports a non-empty type designator that has no matching vendored icon shape
- **THEN** its computed rarity tier is `rare`

#### Scenario: Type designator with a vendored icon yields uncommon tier
- **WHEN** an aircraft has neither an emergency squawk nor an uncommon category, and its type designator resolves to a vendored icon shape
- **THEN** its computed rarity tier is `uncommon`

#### Scenario: No usable signal yields common tier
- **WHEN** an aircraft has no emergency squawk, no uncommon category, and no type designator (or a type designator this app has no icon-resolution information for beyond the category fallback)
- **THEN** its computed rarity tier is `common`

### Requirement: Rarity tier maps to a distinct accent color
Each rarity tier SHALL map to a distinct accent color usable consistently anywhere a tier is displayed (map highlight, drawer components): `common` = slate, `uncommon` = green, `rare` = cyan, `epic` = violet, `legendary` = yellow.

#### Scenario: Every tier resolves to a color
- **WHEN** any of the five rarity tiers is looked up for its accent color
- **THEN** a defined, non-empty color value is returned for that tier

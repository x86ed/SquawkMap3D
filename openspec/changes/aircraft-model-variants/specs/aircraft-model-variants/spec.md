## ADDED Requirements

### Requirement: Aircraft variant resolution from registration
The system SHALL resolve an `Aircraft`'s `variant` field by looking up its `registration` (case-insensitive) in a local registration→variant dataset. Aircraft with no `registration`, or whose `registration` has no entry in the dataset, SHALL have `variant` left unset.

#### Scenario: Registration matches a known variant
- **WHEN** an aircraft's `registration` matches an entry in the registration→variant dataset
- **THEN** the aircraft's `variant` is set to that entry's variant key

#### Scenario: Registration has no known variant
- **WHEN** an aircraft's `registration` is missing, or does not match any entry in the registration→variant dataset
- **THEN** the aircraft's `variant` is left unset, and downstream model/shape resolution behaves exactly as it did before this change

### Requirement: Variant-aware 3D model resolution with default fallback
The system SHALL resolve an aircraft's 3D model by first computing the model key it would use today (exact type designator, or emitter-category fallback). If the aircraft has a `variant` set and the vendored-model manifest lists that variant as available for the resolved model key, the system SHALL load and render that variant's `.glb`. Otherwise it SHALL load and render the resolved model key's default `.glb`, unchanged from current behavior.

#### Scenario: Variant model is vendored
- **WHEN** an aircraft's resolved model key has a vendored variant `.glb` matching the aircraft's `variant`
- **THEN** the aircraft renders using that variant's 3D model

#### Scenario: Variant model is not vendored
- **WHEN** an aircraft has a `variant` set, but no vendored `.glb` exists for that variant under the aircraft's resolved model key
- **THEN** the aircraft renders using the resolved model key's default 3D model

#### Scenario: No variant set
- **WHEN** an aircraft has no `variant` set
- **THEN** the aircraft renders using the resolved model key's default 3D model, identical to pre-change behavior

### Requirement: Variant-aware SVG shape resolution with default fallback
The system SHALL resolve an aircraft's top-view SVG shape by first computing the shape key it would use today (exact type designator, or emitter-category fallback). If the aircraft has a `variant` set and a vendored SVG entry exists for that variant under the resolved shape key, the system SHALL return that variant's shape. Otherwise it SHALL return the resolved shape key's default shape, unchanged from current behavior.

#### Scenario: Variant shape is vendored
- **WHEN** an aircraft's resolved shape key has a vendored variant SVG matching the aircraft's `variant`
- **THEN** `getAircraftShape` returns that variant's shape

#### Scenario: Variant shape is not vendored
- **WHEN** an aircraft has a `variant` set, but no vendored SVG exists for that variant under the aircraft's resolved shape key
- **THEN** `getAircraftShape` returns the resolved shape key's default shape

#### Scenario: No variant set
- **WHEN** an aircraft has no `variant` set
- **THEN** `getAircraftShape` returns the resolved shape key's default shape, identical to pre-change behavior

### Requirement: Independent GLB/SVG variant fallback
The system SHALL resolve the variant 3D model and the variant SVG shape independently of each other. A type/variant combination vendoring one asset kind but not the other SHALL NOT block resolution of the vendored kind, nor force the other kind to fall back.

#### Scenario: Variant vendored for GLB only
- **WHEN** a variant has a vendored `.glb` but no vendored SVG under the same resolved key
- **THEN** the aircraft renders the variant 3D model and the default SVG shape

#### Scenario: Variant vendored for SVG only
- **WHEN** a variant has a vendored SVG but no vendored `.glb` under the same resolved key
- **THEN** the aircraft renders the default 3D model and the variant SVG shape

## MODIFIED Requirements

### Requirement: Aircraft rendered with per-type or fallback icons
Each rendered aircraft SHALL use a 2D icon resolved, in order, from: its ICAO type designator's shape where one exists in this app's own shape set (authored in-repo or generated from the type's `.glb` model); else its ADS-B emitter category's representative modeled type's shape (including the special categories for parachutists, ultralights, UAVs, space vehicles, emergency/service vehicles and point obstacles); else the unknown-aircraft special type's shape when the aircraft reports neither a matching type nor a recognized category; falling back to a generic marker only when no shape resolves — so an aircraft is never rendered invisible for lack of a matching icon. The shape set SHALL contain no third-party GPL or non-commercially licensed assets.

#### Scenario: Icon resolved by type designator
- **WHEN** an aircraft reports a type designator that has a shape in this app's shape set
- **THEN** that aircraft is rendered using the matching type-specific icon, oriented to the aircraft's reported track/heading

#### Scenario: Icon falls back to category's representative shape
- **WHEN** an aircraft reports a type designator with no shape, but reports a recognized ADS-B emitter category with a representative modeled type
- **THEN** that aircraft is rendered using the shape of that category's representative modeled type

#### Scenario: Special emitter categories resolve to special types
- **WHEN** an aircraft reports no type designator with a shape and emitter category B3 (parachutist), B4 (ultralight), B6 (UAV), B7 (space vehicle), C1 (emergency vehicle), C2 (service vehicle) or C3 (point obstacle)
- **THEN** it is rendered as `PARA`, `ULAC`, `VFHC`, `FALH`, `FIRE`, `PTUG` or `TURB` respectively, in 3D where the model layer is active and as that type's shape in 2D

#### Scenario: Unknown aircraft resolves to the unknown special type
- **WHEN** an aircraft reports neither a type designator with a shape nor a recognized emitter category
- **THEN** it is rendered as the unknown special type `UNKN` (flying-saucer model, spinning body, and its shape), oriented to its reported track/heading

#### Scenario: Icon falls back to generic marker
- **WHEN** no shape resolves for an aircraft (e.g. the shape set failed to load)
- **THEN** that aircraft is still rendered, using a generic marker oriented to its reported track/heading

#### Scenario: Only authored or generated shapes are shipped
- **WHEN** the files in the served `aircraft-shapes` directory are inspected
- **THEN** each carries either an `data-author` attribute (authored in-repo) or `data-generated="true"` (derived from a `.glb`), and no `aircraft-silhouettes` directory is served

## MODIFIED Requirements

### Requirement: Aircraft rendered with per-type or fallback icons
Each rendered aircraft SHALL use a 2D icon resolved, in order, from: its ICAO type designator where a vendored 3D model exists for it (the icon being that model's generated top-down silhouette); else its ADS-B emitter category's representative modeled type's silhouette (including the special categories for parachutists and surface vehicles); else the unknown-aircraft special type's silhouette when the aircraft reports neither a matching type nor a recognized category; falling back to a generic marker only when no silhouette resolves — so an aircraft is never rendered invisible for lack of a matching icon. Silhouettes SHALL be derived from this app's own `.glb` models, not from third-party shape sets.

#### Scenario: Icon resolved by type designator
- **WHEN** an aircraft reports a type designator that has a vendored 3D model
- **THEN** that aircraft is rendered using that model's silhouette, oriented to the aircraft's reported track/heading

#### Scenario: Icon falls back to category silhouette
- **WHEN** an aircraft reports a type designator with no vendored model, but reports a recognized ADS-B emitter category with a representative modeled type
- **THEN** that aircraft is rendered using the silhouette of that category's representative modeled type

#### Scenario: Parachutist and ground vehicle categories resolve to special types
- **WHEN** an aircraft reports emitter category B3 (parachutist) or C1/C2 (surface vehicle) and no type designator with a model
- **THEN** it is rendered as the parachutist or ground-vehicle special type respectively, in 3D where the model layer is active and as that type's silhouette in 2D

#### Scenario: Unknown aircraft resolves to the unknown special type
- **WHEN** an aircraft reports neither a type designator with a model nor a recognized emitter category
- **THEN** it is rendered as the unknown special type (3D model and silhouette), oriented to its reported track/heading

#### Scenario: Icon falls back to generic marker
- **WHEN** no silhouette resolves for an aircraft (e.g. the silhouette set failed to load)
- **THEN** that aircraft is still rendered, using a generic marker oriented to its reported track/heading

#### Scenario: No third-party silhouette assets are served
- **WHEN** the app's static assets are inspected
- **THEN** no GPL-3.0 or non-commercial-licensed aircraft shape/silhouette files are present, and no `aircraft-shapes` directory is served

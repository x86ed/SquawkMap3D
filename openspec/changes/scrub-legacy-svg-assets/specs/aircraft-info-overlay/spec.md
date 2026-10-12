## MODIFIED Requirements

### Requirement: PlaneCard's front face shows a 3D model of the aircraft
`PlaneCard`'s front face SHALL render a live 3D wireframe of the selected aircraft's model, tinted to the aircraft's rarity-tier color, when a vendored 3D model exists for that aircraft's type designator (or, absent that, its emitter category's fallback type — the same resolution the map's own 3D aircraft rendering uses). When no vendored 3D model exists for the aircraft (by either resolution), or loading it fails, the front face SHALL instead render the flat 2D top-view shape from this app's shape set (the aircraft's exact type shape if present, else its category's fallback shape, else the unknown special type's), tinted to the same rarity-tier color, rather than an empty or broken art region. Beneath this art, the front face SHALL show a credit line for whichever asset actually rendered, crediting an author only when that asset is the selected aircraft's own exact type designator's vendored asset (never a category fallback, the unknown special type, or a generated shape): when that exact-match asset (the `.glb` model or, on fallback, the authored SVG) has embedded author metadata, the credit line SHALL show that author's handle linking to their `https://adsb.win/operators/{handle}` page; when it has no embedded author metadata (including generated shapes), OR when the rendered asset is a category-fallback/unknown substitute (regardless of whether that substitute itself has embedded author metadata), the credit line SHALL instead show a "create a model" call-to-action linking to the configured model CRUD endpoint (per the `aircraft-record-edit-links` capability) for that type, omitted entirely when that endpoint is not configured.

#### Scenario: Modeled aircraft type renders a 3D wireframe
- **WHEN** the selected aircraft's type designator (or its emitter category's fallback type) has a vendored 3D model
- **THEN** `PlaneCard`'s front face renders a live 3D wireframe render of that model, tinted to the aircraft's rarity-tier color

#### Scenario: Unmodeled aircraft type renders the flat shape fallback
- **WHEN** the selected aircraft's type designator has no vendored 3D model and its emitter category has no fallback modeled type either
- **THEN** `PlaneCard`'s front face renders the `UNKN` model, or its flat 2D shape if that can't load, tinted to the aircraft's rarity-tier color, rather than a blank art region

#### Scenario: A failed model load falls back to the flat shape
- **WHEN** the selected aircraft's type designator has a vendored 3D model, but loading or parsing that model fails
- **THEN** `PlaneCard`'s front face renders that type's flat 2D shape rather than a blank or broken art region

#### Scenario: Rendered 3D model with embedded author shows a real credit
- **WHEN** the rendered 3D wireframe is the selected aircraft's own exact type designator's vendored `.glb` model, and it has embedded author metadata
- **THEN** the front face's credit line shows that author's handle, linking to their `https://adsb.win/operators/{handle}` page

#### Scenario: Rendered flat shape with embedded author shows a real credit
- **WHEN** the front face fell back to the flat 2D shape, that shape is the selected aircraft's own exact type designator's authored SVG, and it has `data-author`
- **THEN** the front face's credit line shows that author's handle, linking to their `https://adsb.win/operators/{handle}` page

#### Scenario: Rendered asset with no embedded author shows the create-a-model CTA
- **WHEN** whichever exact-match asset actually rendered (3D model or flat shape, including a generated shape) has no embedded author metadata, and the model CRUD endpoint is configured
- **THEN** the front face's credit line shows a "create a model" call-to-action linking to the configured model CRUD endpoint for that type, instead of a credit link

#### Scenario: Category-fallback 3D model is never credited, even when it has its own embedded author
- **WHEN** the selected aircraft's own type designator has no vendored 3D model, its emitter category's fallback type does have one, and that fallback model has embedded author metadata
- **THEN** the front face's credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), not that fallback model's own author

#### Scenario: Category-fallback/unknown flat shape is never credited, even when it has its own embedded author
- **WHEN** the front face fell back to the flat 2D shape, and the rendered shape is a category-fallback or `UNKN` substitute (not the selected aircraft's own exact type designator's shape) that itself has embedded author metadata
- **THEN** the front face's credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), not that substitute shape's own author

#### Scenario: CTA omitted when the model CRUD endpoint is not configured
- **WHEN** the front face would otherwise show the create-a-model CTA, and no model CRUD endpoint URL is configured
- **THEN** no credit line or CTA is rendered, rather than a link to nowhere

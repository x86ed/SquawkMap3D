## MODIFIED Requirements

### Requirement: PlaneCard's front face shows a 3D model of the aircraft
`PlaneCard`'s front face SHALL render a live 3D wireframe of the selected aircraft's model, tinted to the aircraft's rarity-tier color, when a vendored 3D model exists for that aircraft's type designator (or, absent that, its emitter category's fallback type — the same resolution the map's own 3D aircraft rendering uses). When no vendored 3D model exists for the aircraft (by either resolution), or loading it fails, the front face SHALL instead render that type's (or fallback type's) model-derived flat 2D top-view silhouette, tinted to the same rarity-tier color, rather than an empty or broken art region. Beneath this art, the front face SHALL show a credit line for whichever model actually rendered, crediting an author only when that model is the selected aircraft's own exact type designator's vendored `.glb` (never a category fallback or the unknown/special-type stand-in): when that exact-match model has embedded author metadata, the credit line SHALL show that author's handle linking to their `https://adsb.win/operators/{handle}` page; when it has no embedded author metadata, OR when the rendered asset is a fallback/stand-in (regardless of whether that substitute itself has embedded author metadata), the credit line SHALL instead show a "create a model" call-to-action linking to the configured model CRUD endpoint (per the `aircraft-record-edit-links` capability) for that type, omitted entirely when that endpoint is not configured. Flat silhouettes are derived from `.glb` models and SHALL NOT carry or display their own author metadata.

#### Scenario: Unmodeled aircraft type renders the flat silhouette fallback
- **WHEN** the selected aircraft's type designator has no vendored 3D model and its emitter category has no fallback modeled type either
- **THEN** `PlaneCard`'s front face renders the unknown special type's model, or its flat silhouette if the model can't load, tinted to the aircraft's rarity-tier color, rather than a blank art region

#### Scenario: A failed model load falls back to the model-derived silhouette
- **WHEN** the selected aircraft's type designator has a vendored 3D model, but loading or parsing that model fails
- **THEN** `PlaneCard`'s front face renders that type's generated flat silhouette rather than a blank or broken art region

#### Scenario: Modeled aircraft type renders a 3D wireframe
- **WHEN** the selected aircraft's type designator (or its emitter category's fallback type) has a vendored 3D model
- **THEN** `PlaneCard`'s front face renders a live 3D wireframe render of that model, tinted to the aircraft's rarity-tier color

#### Scenario: Rendered 3D model with embedded author shows a real credit
- **WHEN** the rendered 3D wireframe is the selected aircraft's own exact type designator's vendored `.glb` model, and it has embedded author metadata
- **THEN** the front face's credit line shows that author's handle, linking to their `https://adsb.win/operators/{handle}` page

#### Scenario: Rendered model with no embedded author shows the create-a-model CTA
- **WHEN** the exact-match model has no embedded author metadata, and the model CRUD endpoint is configured
- **THEN** the front face's credit line shows a "create a model" call-to-action linking to the configured model CRUD endpoint for that type, instead of a credit link

#### Scenario: Category-fallback or special-type model is never credited, even when it has its own embedded author
- **WHEN** the selected aircraft's own type designator has no vendored 3D model, a category-fallback or special-type model renders, and that model has embedded author metadata
- **THEN** the front face's credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), not that fallback model's own author

#### Scenario: Flat silhouette fallback is never credited
- **WHEN** the front face fell back to a flat silhouette
- **THEN** the credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), never an author

#### Scenario: CTA omitted when the model CRUD endpoint is not configured
- **WHEN** the front face would otherwise show the create-a-model CTA, and no model CRUD endpoint URL is configured
- **THEN** no credit line or CTA is rendered, rather than a link to nowhere

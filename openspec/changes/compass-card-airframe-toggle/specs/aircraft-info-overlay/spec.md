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

### Requirement: PlaneCard's front face shows a 3D model of the aircraft
`PlaneCard`'s front face SHALL render a live 3D wireframe of the selected aircraft's model, tinted to the aircraft's rarity-tier color, when a vendored 3D model exists for that aircraft's type designator (or, absent that, its emitter category's fallback type — the same resolution the map's own 3D aircraft rendering uses). When no vendored 3D model exists for the aircraft (by either resolution), or loading it fails, the front face SHALL instead render the same flat 2D top-view silhouette used elsewhere in this app (per "PlaneCard shows aircraft identity and rarity tier"'s silhouette), tinted to the same rarity-tier color, rather than an empty or broken art region. Beneath this art, the front face SHALL show a credit line for whichever asset actually rendered, crediting an author only when that asset is the selected aircraft's own exact type designator's vendored asset (never a category/wake-class fallback or the "Unidentified" shape): when that exact-match asset (the `.glb` model or, on fallback, the SVG silhouette) has embedded author metadata, the credit line SHALL show that author's handle linking to their `https://adsb.win/operators/{handle}` page; when it has no embedded author metadata, OR when the rendered asset is instead a category-fallback/"Unidentified" substitute (regardless of whether that substitute itself has embedded author metadata — crediting it would misattribute someone else's asset to this aircraft), the credit line SHALL instead show a "create a model" call-to-action linking to the configured model CRUD endpoint (per the `aircraft-record-edit-links` capability) for that type, omitted entirely when that endpoint is not configured.

#### Scenario: Modeled aircraft type renders a 3D wireframe
- **WHEN** the selected aircraft's type designator (or its emitter category's fallback type) has a vendored 3D model
- **THEN** `PlaneCard`'s front face renders a live 3D wireframe render of that model, tinted to the aircraft's rarity-tier color

#### Scenario: Unmodeled aircraft type renders the flat silhouette fallback
- **WHEN** the selected aircraft's type designator has no vendored 3D model and its emitter category has no fallback modeled type either
- **THEN** `PlaneCard`'s front face renders the flat 2D top-view silhouette, tinted to the aircraft's rarity-tier color, rather than a blank art region

#### Scenario: A failed model load falls back to the flat silhouette
- **WHEN** the selected aircraft's type designator has a vendored 3D model, but loading or parsing that model fails
- **THEN** `PlaneCard`'s front face renders the flat 2D top-view silhouette fallback rather than a blank or broken art region

#### Scenario: Rendered 3D model with embedded author shows a real credit
- **WHEN** the rendered 3D wireframe is the selected aircraft's own exact type designator's vendored `.glb` model, and it has embedded author metadata
- **THEN** the front face's credit line shows that author's handle, linking to their `https://adsb.win/operators/{handle}` page

#### Scenario: Rendered flat silhouette with embedded author shows a real credit
- **WHEN** the front face fell back to the flat 2D silhouette, that silhouette is the selected aircraft's own exact type designator's vendored SVG, and it has embedded author metadata
- **THEN** the front face's credit line shows that author's handle, linking to their `https://adsb.win/operators/{handle}` page

#### Scenario: Rendered asset with no embedded author shows the create-a-model CTA
- **WHEN** whichever exact-match asset actually rendered (3D model or flat silhouette) has no embedded author metadata, and the model CRUD endpoint is configured
- **THEN** the front face's credit line shows a "create a model" call-to-action linking to the configured model CRUD endpoint for that type, instead of a credit link

#### Scenario: Category-fallback 3D model is never credited, even when it has its own embedded author
- **WHEN** the selected aircraft's own type designator has no vendored 3D model, its emitter category's fallback type does have one, and that fallback model has embedded author metadata
- **THEN** the front face's credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), not that fallback model's own author

#### Scenario: Category-fallback/"Unidentified" flat silhouette is never credited, even when it has its own embedded author
- **WHEN** the front face fell back to the flat 2D silhouette, and the rendered shape is a category-fallback or "Unidentified" substitute (not the selected aircraft's own exact type designator's shape) that itself has embedded author metadata
- **THEN** the front face's credit line shows the "create a model" call-to-action (when the model CRUD endpoint is configured), not that substitute shape's own author

#### Scenario: CTA omitted when the model CRUD endpoint is not configured
- **WHEN** the front face would otherwise show the create-a-model CTA, and no model CRUD endpoint URL is configured
- **THEN** no credit line or CTA is rendered, rather than a link to nowhere

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

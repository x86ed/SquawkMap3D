## ADDED Requirements

### Requirement: RecordPanelHero's image area defaults to compass card when no photo is available
`RecordPanelHero`'s image area SHALL show the live compass card (`plens-win/Card`'s `compass-track` card kind) as its default view whenever the selected aircraft has no Planespotters photo, replacing the bare placeholder glyph previously shown in that case.

#### Scenario: No photo defaults to compass card
- **WHEN** the selected aircraft has no Planespotters photo available
- **THEN** `RecordPanelHero`'s image area renders the live compass card by default

#### Scenario: A photo defaults to the photo view
- **WHEN** the selected aircraft has a Planespotters photo available
- **THEN** `RecordPanelHero`'s image area renders that photo by default, not the compass card

### Requirement: Photo/compass toggle switches the image area's view
`RecordPanelHero`'s image area SHALL provide a toggle control that switches between the photo view and the compass-card view, and back, for the currently selected aircraft. The toggle SHALL only be rendered when both a photo and the compass card are available to switch between for the current selection; when no photo exists, the compass card is shown with no toggle since there is nothing to switch to.

#### Scenario: Toggling from photo to compass card
- **WHEN** the selected aircraft has a photo (shown by default) and the user activates the toggle
- **THEN** the image area switches to showing the live compass card

#### Scenario: Toggling back from compass card to photo
- **WHEN** the selected aircraft has a photo, the image area is currently showing the compass card (via a prior toggle), and the user activates the toggle again
- **THEN** the image area switches back to showing the photo

#### Scenario: No toggle rendered when there is no photo to switch to
- **WHEN** the selected aircraft has no Planespotters photo
- **THEN** `RecordPanelHero`'s image area shows only the compass card, with no toggle control rendered

#### Scenario: Switching the selected aircraft resets the view to its default
- **WHEN** the user has toggled the image area's view for one selected aircraft, then a different aircraft becomes selected
- **THEN** the image area shows the newly-selected aircraft's own default view (photo if it has one, otherwise compass card), not whichever view was left showing for the previous aircraft

### Requirement: Compass card renders the selected aircraft's live telemetry
The compass-card view SHALL render `plens-win/Card`'s `compass-track` card kind (`@card/core`'s static shell plus `@card/compass-track-three`'s live Three.js scene), driven by the selected aircraft's live heading, an estimated pitch, altitude, position, and ground speed, updating continuously as new telemetry arrives for the selected aircraft — without requiring the overlay to be closed/reopened.

#### Scenario: Compass card renders with live telemetry
- **WHEN** the compass-card view is showing for a selected aircraft with known position and heading
- **THEN** the rendered card's 3D scene and HUD reflect that aircraft's current heading, altitude, position, and ground speed

#### Scenario: Compass card updates as telemetry changes
- **WHEN** the compass-card view is showing and the selected aircraft's telemetry (e.g. heading, altitude) changes on a later poll
- **THEN** the rendered card updates to reflect the new values without the overlay being closed/reopened or the compass card being remounted from scratch

#### Scenario: Compass card is disposed when no longer shown
- **WHEN** the image area switches away from the compass-card view (toggled to photo, or the selected aircraft changes), or the overlay closes
- **THEN** the compass card's live 3D scene/animation loop is torn down rather than continuing to run invisibly

### Requirement: Compass card's 3D model resolves from this app's existing vendored model pipeline, falling back to a default stand-in
The compass card's 3D model input SHALL resolve using this app's existing per-type/category vendored `.glb` model resolution (the same resolution the map's own aircraft rendering and `PlaneCard`'s front-face art already use), keyed by the selected aircraft's ICAO type designator or its emitter category's fallback type, optionally refined by variant. When neither the exact type nor its category fallback has a vendored model, the compass card SHALL render using one shared default/generic stand-in model (a pinned, always-vendored model) rather than failing to render or showing a blank scene.

#### Scenario: Exact-type model renders
- **WHEN** the selected aircraft's ICAO type designator has a vendored model
- **THEN** the compass card renders that model

#### Scenario: Category-fallback model renders when the exact type isn't vendored
- **WHEN** the selected aircraft's ICAO type designator has no vendored model, but its emitter category's fallback type does
- **THEN** the compass card renders that category-fallback model

#### Scenario: Fully unmodeled type renders the default stand-in model
- **WHEN** the selected aircraft's ICAO type designator has no vendored model and its emitter category has no fallback modeled type either
- **THEN** the compass card renders the shared default/generic stand-in model rather than a blank or broken scene

### Requirement: Compass card's built-in credit HUD shows a "create a model" call-to-action for unauthored models
The compass card kind's own built-in bottom-right credit HUD SHALL show a "+ Add a model"-style call-to-action linking to the configured model CRUD endpoint (per the `aircraft-record-edit-links` capability) whenever the resolved model — the default/generic stand-in, or a registered model with no recorded modeler credit — has no modeler name/profile URL, by supplying that CRUD URL as the model input's call-to-action URL rather than by modifying the card's rendered output after the fact. When the resolved model has a recorded modeler credit, the card's built-in credit HUD SHALL show that credit (modeler name/profile link) instead.

#### Scenario: Authored model shows its own credit
- **WHEN** the compass card's resolved model has a recorded modeler name and profile URL
- **THEN** the card's bottom-right HUD shows that modeler's credit link

#### Scenario: Default stand-in model shows the create-a-model CTA
- **WHEN** the compass card is rendering the default/generic stand-in model (no registry entry for the type) and the model CRUD endpoint is configured
- **THEN** the card's bottom-right HUD area shows a "create a model" call-to-action linking to the configured model CRUD endpoint, instead of a credit link

#### Scenario: Registered model with no recorded credit shows the create-a-model CTA
- **WHEN** the compass card's resolved model is a registry entry that has no recorded modeler name or profile URL, and the model CRUD endpoint is configured
- **THEN** the card's bottom-right HUD area shows the same "create a model" call-to-action, instead of a blank or broken credit link

#### Scenario: CTA is omitted when the model CRUD endpoint is not configured
- **WHEN** the compass card would otherwise show the "create a model" call-to-action, and no model CRUD endpoint URL is configured
- **THEN** the HUD area renders an unlinked placeholder, with no call-to-action link to nowhere

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

### Requirement: Compass card's 3D model resolves from a per-type registry, falling back to a default stand-in
The compass card's 3D model input SHALL resolve from a registry keyed by the selected aircraft's ICAO type designator (optionally refined by variant), analogous to this app's existing vendored aircraft-silhouette manifest. Types with no registry entry SHALL render using one shared default/generic stand-in model rather than failing to render or showing a blank scene.

#### Scenario: Registered type renders its specific model
- **WHEN** the selected aircraft's ICAO type designator (and variant, if the registry distinguishes it) has a registered compass-card model
- **THEN** the compass card renders that registered model

#### Scenario: Unregistered type renders the default stand-in model
- **WHEN** the selected aircraft's ICAO type designator has no registered compass-card model
- **THEN** the compass card renders the shared default/generic stand-in model rather than a blank or broken scene

### Requirement: Compass card's credit HUD is replaced by a "create a model" call-to-action for unauthored models
When the compass card's resolved model is the default/generic stand-in, or a registered model with no recorded modeler credit, the card's built-in bottom-right credit HUD SHALL be replaced with a "Create a model for this aircraft?" call-to-action linking out to the configured model CRUD endpoint (per the `aircraft-record-edit-links` capability) for that type. When the resolved model has a recorded modeler credit, the card's own built-in credit HUD (modeler name/profile link) SHALL be shown unmodified.

#### Scenario: Authored model shows its own credit
- **WHEN** the compass card's resolved model has a recorded modeler name and profile URL
- **THEN** the card's bottom-right HUD shows that modeler's credit link, unmodified from the card's own default rendering

#### Scenario: Default stand-in model shows the create-a-model CTA
- **WHEN** the compass card is rendering the default/generic stand-in model (no registry entry for the type)
- **THEN** the card's bottom-right HUD area shows a "Create a model for this aircraft?" call-to-action linking to the configured model CRUD endpoint, instead of a credit link

#### Scenario: Registered model with no recorded credit shows the create-a-model CTA
- **WHEN** the compass card's resolved model is a registry entry that has no recorded modeler name or profile URL
- **THEN** the card's bottom-right HUD area shows the same "Create a model for this aircraft?" call-to-action, instead of a blank or broken credit link

#### Scenario: CTA is omitted when the model CRUD endpoint is not configured
- **WHEN** the compass card would otherwise show the "create a model" call-to-action, and no model CRUD endpoint URL is configured
- **THEN** the HUD area renders with no credit link and no call-to-action, rather than a link to nowhere

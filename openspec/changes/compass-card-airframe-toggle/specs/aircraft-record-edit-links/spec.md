## ADDED Requirements

### Requirement: Three configurable CRUD endpoint URL templates
The app SHALL support three independently configurable external URL templates, each optional (unset by default): a model CRUD endpoint (accepting the ICAO type designator and variant), a type CRUD endpoint (accepting the ICAO type designator), and an aircraft CRUD endpoint (accepting the transponder hex code). Any UI element that links to one of these endpoints SHALL only render when its corresponding endpoint is configured, and SHALL NOT render (rather than link to a broken or empty URL) when it is not.

#### Scenario: All three endpoints configured
- **WHEN** all three CRUD endpoint URLs are configured
- **THEN** the registration "Edit" control, the type "Edit" control, and the compass card's "create a model" call-to-action (per the `airframe-compass-card` capability) all render and link to their respective configured endpoints

#### Scenario: An endpoint left unconfigured hides only its own control
- **WHEN** the aircraft CRUD endpoint URL is not configured, while the type and model CRUD endpoint URLs are configured
- **THEN** the registration "Edit" control does not render, while the type "Edit" control and the "create a model" call-to-action continue to render normally

#### Scenario: No endpoints configured
- **WHEN** none of the three CRUD endpoint URLs are configured
- **THEN** no "Edit" controls or "create a model" call-to-action render anywhere in the overlay, and the rest of the overlay renders normally

### Requirement: Registration "Edit" control links to the aircraft CRUD endpoint with the transponder hex
`RecordPanelHero` SHALL show an "Edit" control adjacent to the registration heading, which, when the aircraft CRUD endpoint is configured, opens that endpoint with the selected aircraft's transponder hex code substituted into the URL template.

#### Scenario: Activating the edit control opens the aircraft CRUD page with the hex
- **WHEN** the aircraft CRUD endpoint is configured and the user activates the registration "Edit" control
- **THEN** a new browser tab opens to the configured aircraft CRUD URL with the selected aircraft's transponder hex code substituted into the template

### Requirement: Type "Edit" control links to the type CRUD endpoint with the ICAO designator
`PlaneCard` SHALL show an "Edit" control adjacent to its type (manufacturer/model) display, which, when the type CRUD endpoint is configured and the selected aircraft's ICAO type designator is known, opens that endpoint with the type designator substituted into the URL template.

#### Scenario: Activating the edit control opens the type CRUD page with the ICAO designator
- **WHEN** the type CRUD endpoint is configured, the selected aircraft's ICAO type designator is known, and the user activates the type "Edit" control
- **THEN** a new browser tab opens to the configured type CRUD URL with that ICAO type designator substituted into the template

#### Scenario: No edit control when the type designator is unknown
- **WHEN** the selected aircraft has no known ICAO type designator
- **THEN** `PlaneCard`'s type display shows no "Edit" control, regardless of whether the type CRUD endpoint is configured

### Requirement: "Create a model" call-to-action links to the model CRUD endpoint with ICAO designator and variant
The compass card's built-in "create a model" call-to-action (per the `airframe-compass-card` capability, shown by the card's own credit HUD for a default/unauthored model) SHALL, when the model CRUD endpoint is configured, open that endpoint with the selected aircraft's ICAO type designator and variant substituted into the URL template — supplied to the card as its model input's call-to-action URL, not activated via a separately-built control.

#### Scenario: Activating the call-to-action opens the model CRUD page with ICAO and variant
- **WHEN** the model CRUD endpoint is configured, the compass card is showing the "create a model" call-to-action for a selected aircraft with a known ICAO type designator, and the user activates the call-to-action
- **THEN** a new browser tab opens to the configured model CRUD URL with that aircraft's ICAO type designator (and variant, when known) substituted into the template

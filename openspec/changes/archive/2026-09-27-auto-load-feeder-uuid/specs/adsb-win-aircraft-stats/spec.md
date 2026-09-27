## MODIFIED Requirements

### Requirement: Feeder UUID is configured locally in the browser, not built into the app bundle
The app SHALL let the user enter an adsb.win feeder UUID and SHALL persist it only in the browser's local storage, never in a build-time environment variable, a committed file, or any value baked into the distributed static bundle. The app SHALL let the user update or clear a previously-entered feeder UUID. In addition, when no feeder UUID is yet stored, the app SHALL attempt to automatically populate it from the `feeder-uuid-autodiscovery` capability on load, storing any UUID it returns exactly as if the user had entered it; the manual entry path SHALL remain available and unchanged as a fallback whenever autodiscovery does not yield a UUID.

#### Scenario: Entering a feeder UUID persists it locally
- **WHEN** the user enters a feeder UUID and saves it
- **THEN** the value is stored in the browser's local storage and is available on subsequent page loads in that same browser, without being present anywhere in the app's compiled JavaScript

#### Scenario: No feeder UUID configured and autodiscovery finds none
- **WHEN** no feeder UUID has ever been saved in this browser, and the automatic discovery attempt does not yield a UUID
- **THEN** the app treats aircraft-model-card data as unavailable, does not attempt a request to adsb.win's API, and still lets the user enter a UUID manually exactly as before

#### Scenario: Updating a previously-saved feeder UUID
- **WHEN** the user saves a new feeder UUID value over a previously-saved one
- **THEN** subsequent aircraft-model-card requests use the new value, and no data fetched using the old value is presented as current

#### Scenario: Feeder UUID is populated automatically on load
- **WHEN** no feeder UUID has ever been saved in this browser, and the `feeder-uuid-autodiscovery` endpoint returns a UUID
- **THEN** the app stores that UUID the same way a manually-entered one is stored, without showing a prompt or requiring any user input, and subsequent aircraft-model-card requests use it

#### Scenario: Autodiscovery never overwrites an existing stored value
- **WHEN** a feeder UUID is already stored (whether entered manually or previously autodiscovered)
- **THEN** the app does not call `feeder-uuid-autodiscovery` or otherwise overwrite the stored value on load

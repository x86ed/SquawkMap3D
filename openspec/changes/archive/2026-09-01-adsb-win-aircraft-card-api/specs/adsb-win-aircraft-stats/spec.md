## ADDED Requirements

### Requirement: Feeder UUID is configured locally in the browser, not built into the app bundle
The app SHALL let the user enter an adsb.win feeder UUID and SHALL persist it only in the browser's local storage, never in a build-time environment variable, a committed file, or any value baked into the distributed static bundle. The app SHALL let the user update or clear a previously-entered feeder UUID.

#### Scenario: Entering a feeder UUID persists it locally
- **WHEN** the user enters a feeder UUID and saves it
- **THEN** the value is stored in the browser's local storage and is available on subsequent page loads in that same browser, without being present anywhere in the app's compiled JavaScript

#### Scenario: No feeder UUID configured
- **WHEN** no feeder UUID has ever been saved in this browser
- **THEN** the app treats aircraft-model-card data as unavailable and does not attempt a request to adsb.win's API

#### Scenario: Updating a previously-saved feeder UUID
- **WHEN** the user saves a new feeder UUID value over a previously-saved one
- **THEN** subsequent aircraft-model-card requests use the new value, and no data fetched using the old value is presented as current

### Requirement: Aircraft-model card is fetched from adsb.win's JSON API, hydrated directly, never via iframe/embed
When a feeder UUID is configured and the aircraft type to look up is known, the app SHALL fetch `GET https://app-api.adsb.win/api/v1/aircraft-models/{ICAO_TYPE}` with the feeder UUID sent only as an `Authorization: Bearer` header, and SHALL use only the response body's `data.attributes` fields to populate the UI. The app SHALL NOT render the response's `meta.embed_url` in an iframe or any other embed mechanism, and SHALL NOT place the feeder UUID in the request URL or query string.

#### Scenario: Successful lookup uses the JSON body's attributes
- **WHEN** a feeder UUID is configured, the aircraft type is known, and the API responds with a successful card for that type
- **THEN** the app reads `data.attributes` fields directly from the JSON response body and does not fetch or render `meta.embed_url`

#### Scenario: Feeder UUID is never sent in the URL
- **WHEN** the app makes a request to adsb.win's Aircraft Card API
- **THEN** the request URL and query string contain only the ICAO aircraft type designator, and the feeder UUID appears only in the request's `Authorization` header

### Requirement: Each documented API outcome is handled distinctly and generically
The app SHALL distinguish between: a successful card response; a `401 invalid_token` response; a `404 not_found` response; and any other failure (network error, non-2xx/non-404/non-401 status, or an unparseable response body). Error messaging for `404 not_found` SHALL be generic and SHALL NOT imply whether another account has captured that aircraft type, matching the API's own intentionally non-revealing design.

#### Scenario: 401 invalid_token reports an invalid/unclaimed feeder
- **WHEN** the API responds `401` with `{"error":{"code":"invalid_token"}}`
- **THEN** the app shows a message indicating the feeder UUID isn't recognized (missing, malformed, unknown, unclaimed, or no longer associated with an account), without asserting which specific sub-case applies

#### Scenario: 404 not_found reports a generic not-captured message
- **WHEN** the API responds `404` with `{"error":{"code":"not_found"}}`
- **THEN** the app shows a generic message indicating this account hasn't captured that aircraft type, without any wording that would reveal whether a different account has captured it

#### Scenario: Other failures show a generic error state
- **WHEN** the request fails for a reason other than a `401`/`404` response (e.g. network failure, unexpected response shape, timeout)
- **THEN** the app shows a generic "unable to load" state rather than surfacing a raw error, a stack trace, or treating the failure as a successful empty result

### Requirement: Feeder UUID is never logged, exposed in analytics, or leaked into error output
The app SHALL NOT write the feeder UUID's value to `console.*` output, error messages, analytics events, or any other diagnostic surface, at any point in the request/response handling for the Aircraft Card API.

#### Scenario: A failed request does not leak the feeder UUID
- **WHEN** a request to the Aircraft Card API fails for any reason (network error, 401, 404, or other)
- **THEN** no console output, thrown error message, or rendered UI text generated as a result contains the configured feeder UUID's value

### Requirement: Aircraft-model card responses are cached per aircraft type and feeder UUID for the session
The app SHALL cache a fetched or attempted aircraft-model card result per `(feeder UUID, aircraft type)` pair for the duration of the browser session, and SHALL NOT issue a new request for the same pair while a cached successful, not-found, or invalid-token result exists. A result caused by a transient failure (not a definitive 401/404 outcome) SHALL NOT be cached, so it can be retried.

#### Scenario: Repeated lookups of the same type reuse the cached result
- **WHEN** the same aircraft type is looked up more than once with the same feeder UUID within a session (e.g. the aircraft remains selected across multiple polling cycles)
- **THEN** only the first lookup issues a network request; subsequent lookups reuse the cached result without a new request

#### Scenario: A transient failure is retried on a later lookup
- **WHEN** a lookup for a given type fails for a reason other than a definitive `401`/`404` response, and the same type is looked up again later in the session
- **THEN** the app attempts a new request rather than reusing the failed result

#### Scenario: A different feeder UUID does not reuse another UUID's cached results
- **WHEN** the user changes the configured feeder UUID and an aircraft type that was already cached under the previous UUID is looked up again
- **THEN** the app issues a new request under the new UUID rather than presenting the previous UUID's cached result

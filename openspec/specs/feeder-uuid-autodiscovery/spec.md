# feeder-uuid-autodiscovery Specification

## Purpose
TBD - created by archiving change auto-load-feeder-uuid. Update Purpose after archive.
## Requirements
### Requirement: A same-origin path proxies to the local feeder's admin UI so the adsb.win UUID can be read without CORS
Since this app is served as a static export with no server-side runtime, the deployed app SHALL expose a same-origin path (served by the deployment's own reverse proxy, not application code) that proxies to the local ADS-B feeder box's own admin web UI (the stock `adsb-feeder-image` `/aggregators` page). The proxy SHALL forward that page's response back to the browser under the app's own origin, so no cross-origin request from the browser to the admin UI is ever required.

#### Scenario: Same-origin path returns the admin UI's page
- **WHEN** the browser requests the deployed app's same-origin discovery path
- **THEN** the response body is the local feeder box's `/aggregators` page content, delivered from the app's own origin, with no cross-origin request having been made by the browser

#### Scenario: Admin UI unreachable or returns an unexpected response
- **WHEN** the proxy's request to the admin UI fails (network error, non-2xx status, login redirect) or the admin UI is not running
- **THEN** the same-origin path returns a non-2xx or empty response rather than the browser needing to make a direct cross-origin request to find out

### Requirement: Client-side code extracts the adsb.win UUID from the proxied response, without a UUID match treated as failure
The app SHALL parse the adsb.win UUID from the proxied response by locating the `adsbwin--ultrafeeder--uuid` field's value, entirely in client-side code, and SHALL treat an unreachable proxy, a non-2xx response, or an absent/empty field value identically as "no UUID discovered" — never as a thrown error surfaced to the user.

#### Scenario: UUID found in the proxied response
- **WHEN** the proxied response contains a populated `adsbwin--ultrafeeder--uuid` field
- **THEN** the app extracts that value as the discovered UUID

#### Scenario: Admin UI reachable but no adsb.win UUID configured
- **WHEN** the proxied response is successful but the `adsbwin--ultrafeeder--uuid` field is empty or absent
- **THEN** the app treats this as no UUID discovered, without error

#### Scenario: Proxy or admin UI failure
- **WHEN** the same-origin discovery path returns a non-2xx response or the request fails outright
- **THEN** the app treats this as no UUID discovered, without throwing an unhandled error or showing a raw failure message

### Requirement: Discovery targets the box's own admin UI generically, not one hardcoded feeder
The reverse-proxy target SHALL be the deploying box's own local admin UI (reached via the container runtime's host-gateway mechanism), not a value tied to one specific feeder's hostname, IP address, or account. The same deployed build and configuration SHALL work unmodified on any box running the stock `adsb-feeder-image` software.

#### Scenario: Works across different feeder boxes without configuration
- **WHEN** the same app build and deploy configuration is used on a different physical feeder box running the stock `adsb-feeder-image` software
- **THEN** discovery succeeds against that box's own admin UI without any code change, environment variable, or user-entered configuration identifying the box

#### Scenario: Independent of how the browser addressed the app
- **WHEN** the app is loaded from a feeder box reachable at a LAN IP, a custom hostname, or `adsb-feeder.local`
- **THEN** discovery succeeds identically in all cases, since the proxy target does not depend on the hostname the browser used to reach the app

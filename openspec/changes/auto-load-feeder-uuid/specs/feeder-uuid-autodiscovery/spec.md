## ADDED Requirements

### Requirement: Server-side endpoint discovers the adsb.win UUID from the local feeder's admin UI
The app SHALL expose a same-origin server route that attempts to read the adsb.win feeder UUID already configured on the local ADS-B feeder box's own admin web UI (the stock `adsb-feeder-image` `/aggregators` page), and returns it in a JSON response. The route SHALL perform this request from the server, never instructing the browser to fetch the admin UI's URL directly.

#### Scenario: UUID found on the feeder's admin UI
- **WHEN** the server route is called and the local feeder box's admin UI responds to `GET /aggregators` with HTML containing a populated `adsbwin--ultrafeeder--uuid` field
- **THEN** the route returns a JSON response containing that UUID value

#### Scenario: Admin UI reachable but no adsb.win UUID configured
- **WHEN** the admin UI responds successfully but the `adsbwin--ultrafeeder--uuid` field is empty or absent
- **THEN** the route returns a JSON response indicating no UUID was found, without error

#### Scenario: Admin UI unreachable or returns an unexpected response
- **WHEN** the request to the admin UI fails (network error, non-2xx status, login redirect, or unparseable body)
- **THEN** the route returns a JSON response indicating no UUID was found, without throwing or returning a 5xx status to the client

### Requirement: Discovery targets the requesting box generically, not one hardcoded feeder
The server route SHALL attempt the admin UI at the hostname the client's own request arrived on (so it targets whichever physical feeder box is serving the app), and SHALL additionally try the well-known `adsb-feeder.local` hostname as a fallback if the first attempt fails. The route SHALL NOT depend on a hardcoded IP address or a single specific box's identity.

#### Scenario: App reached via the feeder's own LAN address
- **WHEN** the app is loaded from a feeder box reachable at a LAN IP or custom hostname (not `adsb-feeder.local`)
- **THEN** the discovery request targets that same hostname on the admin UI's port before falling back to `adsb-feeder.local`

#### Scenario: Works across different feeder boxes without configuration
- **WHEN** the same app build is deployed to a different physical feeder box running the stock `adsb-feeder-image` software
- **THEN** discovery succeeds against that box's own admin UI without any code change, environment variable, or user-entered configuration identifying the box

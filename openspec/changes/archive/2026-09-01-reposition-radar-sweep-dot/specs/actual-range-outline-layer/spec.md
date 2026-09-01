## MODIFIED Requirements

### Requirement: Tracked aircraft shown as hex-labeled dots on the sweep
While the actual range outline layer is enabled, each currently-tracked aircraft with a known position SHALL be rendered as a dot at its current lat/lon **on the ground plane** on the sweep overlay, labeled with its ICAO 24-bit hex address, independent of whether the separate aircraft-icons layer is enabled. The dot and its hex label SHALL be rendered at ground level regardless of the aircraft's reported altitude — not floating at the aircraft's real altitude.

#### Scenario: Aircraft dot rendered with hex label
- **WHEN** the actual range outline layer is enabled and the feeder reports a tracked aircraft with a known position and hex address
- **THEN** a dot is rendered at that aircraft's current lat/lon, labeled with its hex address (not its callsign or flight number)

#### Scenario: Aircraft dot and label render at ground level, not at aircraft altitude
- **WHEN** the actual range outline layer is enabled and the feeder reports a tracked aircraft with a known position, hex address, and a nonzero reported altitude
- **THEN** the aircraft's dot and hex label are rendered at ground level (the same elevation as the sweep wedge and outline polygon), not elevated to the aircraft's reported altitude, so the dot reads as a ground-plane radar contact rather than a marker floating at cruise altitude

#### Scenario: Aircraft dots update as positions change
- **WHEN** a tracked aircraft's reported position changes between feeder polls
- **THEN** its dot's rendered position updates to match, and its hex label remains attached to the updated position

#### Scenario: Aircraft dot independent of the aircraft-icons layer toggle
- **WHEN** the actual range outline layer is enabled and the separate aircraft-icons layer (`aircraft-tracks-layer`) is hidden
- **THEN** hex-labeled aircraft dots still render on the actual range outline layer's sweep overlay

#### Scenario: Aircraft no longer reported
- **WHEN** an aircraft that previously had a rendered dot stops appearing in the feeder's reported aircraft
- **THEN** its dot and hex label stop being rendered, without erroring or affecting other aircraft's dots

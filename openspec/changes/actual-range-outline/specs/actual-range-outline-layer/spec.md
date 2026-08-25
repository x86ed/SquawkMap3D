## ADDED Requirements

### Requirement: Actual range outline loaded from the feeder's outline.json
The map SHALL load the feeder's server-generated actual-range-outline data (readsb's `data/outline.json`, fetched same-origin at `/data/outline.json` via the app's own proxy) and render it as a filled polygon layer, refetched periodically so the displayed shape stays current with the feeder's own accumulated data.

#### Scenario: Range outline loads successfully
- **WHEN** the actual range outline layer is enabled, a feeder is configured, and `/data/outline.json` responds successfully with ring data in any of the supported shapes (`points`, `actualRange.last24h.points`, or `multiRange`)
- **THEN** the ring(s) are parsed into polygon geometry and rendered as the actual range outline layer

#### Scenario: Periodic refetch
- **WHEN** the actual range outline layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches `/data/outline.json` and updates the rendered polygon to reflect the latest response

#### Scenario: Outline data unavailable or unconfigured
- **WHEN** the actual range outline layer is enabled but no feeder is configured, the configured feeder's decoder never generates `outline.json` (e.g. a non-readsb decoder), or the request otherwise fails
- **THEN** the map does not error or break other layers; the actual range outline layer renders no polygon (or continues showing the last successfully fetched shape) until a subsequent successful refetch

### Requirement: Actual range outline rendered as a solid fill
The actual range outline polygon SHALL be rendered as a solid-filled shape, distinguishable by color from every other filled layer in the app (military bases, TFR, special use airspace).

#### Scenario: Outline renders filled
- **WHEN** the actual range outline layer is enabled and outline data has been successfully loaded
- **THEN** the polygon area is rendered with a solid fill color, not merely an outline/stroke

### Requirement: Actual range outline layer is toggleable
The user SHALL be able to show or hide the actual range outline layer (fill, sweep animation, and aircraft dots together, as one layer) independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer, following this app's existing layer-toggle pattern, and the layer SHALL remain correctly rendered across theme and pilot-mode switches.

#### Scenario: Toggle available in the layer menu
- **WHEN** the map's layer toggle controls are shown
- **THEN** a toggle for the actual range outline layer is present, following the same toggle-button pattern as every other layer

#### Scenario: Hiding the layer stops everything it owns
- **WHEN** the user turns the actual range outline layer off
- **THEN** the filled polygon, the radar-sweep animation, and the aircraft dots/labels are no longer rendered, and the sweep's animation loop stops running, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the actual range outline layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the layer remains hidden until the user explicitly turns it back on

#### Scenario: Layer survives style swap while visible
- **WHEN** the actual range outline layer is visible and the user switches theme (light/dark) or toggles pilot mode
- **THEN** the filled polygon and the sweep animation remain correctly rendered after the map style finishes reloading, without requiring the user to manually re-enable the layer

### Requirement: Animated radar sweep over the outline
While the actual range outline layer is enabled, the map SHALL display a continuously rotating radar-sweep beam animation centered on the feeder's site position, visually confined to the actual range outline polygon, matching the sweep/persistence/leading-edge technique of the provided reference implementation.

#### Scenario: Sweep rotates continuously
- **WHEN** the actual range outline layer is enabled and outline data is available
- **THEN** a beam animates rotating around the site position continuously (not a one-shot animation), without requiring further user interaction

#### Scenario: Sweep stays confined to the outline shape
- **WHEN** the sweep beam is rotating
- **THEN** the beam and its trailing fade are only ever drawn within the actual range outline polygon's boundary, not extending beyond it

#### Scenario: Sweep tracks map pan/zoom
- **WHEN** the user pans or zooms the map while the actual range outline layer is enabled
- **THEN** the sweep beam's on-screen position and the polygon it's confined to stay correctly aligned with the map's current view, without visible desync or requiring a manual refresh

#### Scenario: Sweep and aircraft dots remain correctly positioned under this app's default 3D pitch and terrain
- **WHEN** the actual range outline layer is enabled while the map is at a pitched camera angle over real terrain (this app's default view — not a flat top-down view) and the user changes pitch or bearing
- **THEN** the sweep beam, the filled polygon, and any rendered aircraft dots all remain correctly positioned relative to the map's real 3D geometry (not rendered as a flat, screen-space decal that ignores the camera's pitch/rotation)

### Requirement: Tracked aircraft shown as hex-labeled dots on the sweep
While the actual range outline layer is enabled, each currently-tracked aircraft with a known position SHALL be rendered as a dot at its current lat/lon on the sweep overlay, labeled with its ICAO 24-bit hex address, independent of whether the separate aircraft-icons layer is enabled.

#### Scenario: Aircraft dot rendered with hex label
- **WHEN** the actual range outline layer is enabled and the feeder reports a tracked aircraft with a known position and hex address
- **THEN** a dot is rendered at that aircraft's current lat/lon, labeled with its hex address (not its callsign or flight number)

#### Scenario: Aircraft dots update as positions change
- **WHEN** a tracked aircraft's reported position changes between feeder polls
- **THEN** its dot's rendered position updates to match, and its hex label remains attached to the updated position

#### Scenario: Aircraft dot independent of the aircraft-icons layer toggle
- **WHEN** the actual range outline layer is enabled and the separate aircraft-icons layer (`aircraft-tracks-layer`) is hidden
- **THEN** hex-labeled aircraft dots still render on the actual range outline layer's sweep overlay

#### Scenario: Aircraft no longer reported
- **WHEN** an aircraft that previously had a rendered dot stops appearing in the feeder's reported aircraft
- **THEN** its dot and hex label stop being rendered, without erroring or affecting other aircraft's dots

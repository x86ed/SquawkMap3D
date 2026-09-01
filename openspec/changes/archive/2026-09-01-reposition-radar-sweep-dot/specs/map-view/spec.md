## MODIFIED Requirements

### Requirement: Center on user location
On load, the map SHALL attempt to center its initial view on the user's current geolocation, zoomed to show approximately 60 nautical miles around that center. If geolocation permission is denied, unavailable, or times out, the map SHALL fall back to a fixed default view, also zoomed to show approximately 60 nautical miles around the default center, instead of failing to render.

#### Scenario: Geolocation permission granted
- **WHEN** the user grants geolocation permission and their position is successfully retrieved
- **THEN** the map's initial center moves to (or flies to) the user's coordinates, zoomed to show approximately 60 nautical miles around that center

#### Scenario: Geolocation permission denied
- **WHEN** the user denies geolocation permission, or geolocation is unavailable/unsupported, or the request times out
- **THEN** the map renders centered on a fixed default location, zoomed to show approximately 60 nautical miles around that default center, and remains fully interactive

#### Scenario: Initial zoom is not the wider range-ring or continental default
- **WHEN** the map first loads, regardless of whether geolocation succeeds or falls back to the default location
- **THEN** the initial view is zoomed to approximately 60 nautical miles around its center, not the continental-scale fallback zoom or the wider ~200 nautical mile view used by the separate "jump to my location" control and the satellite-icon recenter action

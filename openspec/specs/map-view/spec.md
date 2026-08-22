# map-view Specification

## Purpose
TBD - created by archiving change install-maplibre. Update Purpose after archive.

## Requirements

### Requirement: Map is the main view on load
The application's root page SHALL render a MapLibre GL map as its primary, full-viewport content when the page loads. No placeholder/starter content SHALL be shown instead of or before the map shell.

#### Scenario: Loading the app root
- **WHEN** a user navigates to the application's root URL
- **THEN** the page renders a full-viewport MapLibre map as the main content, not the Next.js starter template

### Requirement: 3D perspective
The map SHALL render with a 3D perspective by default and SHALL allow the user to change pitch and bearing through standard map interactions (drag-rotate, scroll/pinch).

#### Scenario: Initial 3D view
- **WHEN** the map finishes loading
- **THEN** the map's initial pitch is greater than 0 degrees, showing a tilted 3D perspective rather than a flat top-down view

#### Scenario: User rotates and tilts the map
- **WHEN** a user performs a drag-rotate gesture (e.g., right-click-drag or two-finger drag)
- **THEN** the map's bearing and/or pitch updates in response to the gesture, up to the configured maximum pitch

### Requirement: Topographic terrain
The map SHALL display real-world topographic terrain (3D elevation) using a raster-DEM terrain source, visible globally wherever elevation data exists for the source.

#### Scenario: Terrain visible on load
- **WHEN** the map finishes loading over an area with significant elevation change (e.g., a mountain range)
- **THEN** the map surface is visibly extruded/elevated to reflect that terrain, not flat

### Requirement: Light and dark theme support
The map SHALL support both a light and a dark visual style. The initial style SHALL follow the operating system's `prefers-color-scheme` setting, and the user SHALL be able to switch themes manually at runtime without losing custom layers (airports, military bases).

#### Scenario: OS prefers dark mode
- **WHEN** the user's OS/browser reports a preference for dark color scheme and the user has not manually chosen a theme
- **THEN** the map loads using its dark style

#### Scenario: OS prefers light mode
- **WHEN** the user's OS/browser reports a preference for light color scheme and the user has not manually chosen a theme
- **THEN** the map loads using its light style

#### Scenario: User manually switches theme
- **WHEN** a user toggles the theme control from light to dark (or vice versa)
- **THEN** the map's base style switches accordingly, and previously visible custom layers (airports, military bases) remain visible after the switch

### Requirement: Center on user location
On load, the map SHALL attempt to center its initial view on the user's current geolocation. If geolocation permission is denied, unavailable, or times out, the map SHALL fall back to a fixed default view instead of failing to render.

#### Scenario: Geolocation permission granted
- **WHEN** the user grants geolocation permission and their position is successfully retrieved
- **THEN** the map's initial center moves to (or flies to) the user's coordinates

#### Scenario: Geolocation permission denied
- **WHEN** the user denies geolocation permission, or geolocation is unavailable/unsupported, or the request times out
- **THEN** the map renders centered on a fixed default location and remains fully interactive

# rainviewer-radar-layer Specification

## Purpose
TBD - created by archiving change add-missing-map-layers. Update Purpose after archive.
## Requirements
### Requirement: RainViewer radar layer rendered as raster tiles
The map SHALL support a RainViewer-sourced raster tile overlay showing global precipitation radar when the layer is enabled.

#### Scenario: Layer loads current radar frame
- **WHEN** the RainViewer layer is enabled
- **THEN** the map fetches RainViewer's current available frame timestamp and renders the corresponding radar tiles as an overlay

#### Scenario: Frame timestamp fetch fails
- **WHEN** the RainViewer layer is enabled but the frame-timestamp lookup fails (network error or malformed response)
- **THEN** the map does not request radar tiles for an invalid frame and does not error or break other layers; the layer remains visually empty until a subsequent successful fetch

### Requirement: RainViewer layer refreshes to the current frame
The RainViewer layer SHALL periodically re-check for a newer available radar frame while enabled, so the displayed radar reflects recent precipitation rather than a frame frozen at layer-enable time.

#### Scenario: Newer frame becomes available
- **WHEN** the RainViewer layer has been enabled long enough for at least one refresh interval to elapse and a newer frame is available upstream
- **THEN** the map updates the radar tile source to the newer frame

### Requirement: RainViewer layer is toggleable
The user SHALL be able to show or hide the RainViewer radar layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the RainViewer layer
- **WHEN** the user turns the RainViewer layer off
- **THEN** radar tiles are no longer rendered, and periodic frame refresh stops, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the RainViewer layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the RainViewer layer remains hidden until the user explicitly turns it back on


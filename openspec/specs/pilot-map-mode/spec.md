# pilot-map-mode Specification

## Purpose
TBD - created by archiving change install-maplibre. Update Purpose after archive.

## Requirements

### Requirement: Pilot map mode option
The application SHALL offer a user-selectable "pilot map" mode, in addition to the default topographic light/dark styles, that presents an aviation-chart-inspired styling of the map.

#### Scenario: Pilot mode control is available
- **WHEN** the map has loaded
- **THEN** a control is available that lets the user switch into pilot map mode

### Requirement: Pilot mode changes map styling
When pilot map mode is active, the map SHALL apply an aviation-chart-inspired visual style while preserving the airports and military bases layers.

#### Scenario: User enables pilot mode
- **WHEN** a user activates pilot map mode
- **THEN** the map's visual style changes to the aviation-chart-inspired presentation, and the airports and military bases layers remain visible

#### Scenario: User disables pilot mode
- **WHEN** a user switches pilot map mode off
- **THEN** the map returns to the current light/dark topographic style, and the airports and military bases layers remain visible

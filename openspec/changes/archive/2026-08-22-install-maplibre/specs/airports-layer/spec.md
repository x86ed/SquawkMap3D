## ADDED Requirements

### Requirement: Airports shown as a map layer
The map SHALL display airports as a distinct point layer, sourced from a bundled airports dataset, visible at appropriate zoom levels.

#### Scenario: Airports visible on the map
- **WHEN** the map has finished loading its style and data
- **THEN** airport locations from the bundled dataset are rendered as points on the map

### Requirement: Airports use a contrasting color
Airport markers SHALL be styled in a color that remains visually distinguishable from the map surface in both the light and dark base styles.

#### Scenario: Airports visible against light style
- **WHEN** the map is showing its light style with the airports layer enabled
- **THEN** airport markers render in a color that is clearly distinguishable from the light basemap surface

#### Scenario: Airports visible against dark style
- **WHEN** the map is showing its dark style with the airports layer enabled
- **THEN** airport markers render in a color that is clearly distinguishable from the dark basemap surface

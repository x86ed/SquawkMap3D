## ADDED Requirements

### Requirement: Overlay chrome, RecordPanelHero, TelemetryMarquee, and FlightInfoPane reflect the active light/dark theme; PlaneCard does not
The overlay's own drawer chrome, and three of its four components — `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` — SHALL render using the map's currently active light/dark theme's panel, border, and text colors, rather than a fixed palette independent of the active theme. `PlaneCard`'s appearance SHALL continue to be driven entirely by the selected aircraft's rarity tier and SHALL NOT change when the active theme changes.

#### Scenario: Overlay chrome and its three theme-reactive components use dark-theme colors when dark theme is active
- **WHEN** the active theme is dark and the overlay is open
- **THEN** the overlay's drawer background/border, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all render using the dark theme's palette

#### Scenario: Overlay chrome and its three theme-reactive components use light-theme colors when light theme is active
- **WHEN** the active theme is light and the overlay is open
- **THEN** the overlay's drawer background/border, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all render using the light theme's palette

#### Scenario: Theme-reactive components update immediately when the theme is toggled
- **WHEN** the overlay is open and the user toggles the theme
- **THEN** the overlay's chrome, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all update to the newly active theme's colors without the overlay needing to be closed/reopened or the selected aircraft to change

#### Scenario: PlaneCard's colors are unaffected by a theme toggle
- **WHEN** the overlay is open for a given selected aircraft and the user toggles the theme
- **THEN** `PlaneCard`'s rendered colors (background, border, rarity-tier accent) remain unchanged, driven only by that aircraft's rarity tier, not by the newly active theme

#### Scenario: PlaneCard renders identically for the same aircraft regardless of active theme
- **WHEN** the same selected aircraft's overlay is viewed once under the dark theme and once under the light theme
- **THEN** `PlaneCard`'s rendered colors are identical between the two views

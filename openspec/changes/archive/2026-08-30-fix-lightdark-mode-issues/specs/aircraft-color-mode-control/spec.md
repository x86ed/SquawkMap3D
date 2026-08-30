## ADDED Requirements

### Requirement: Color-mode legend reflects the active light/dark theme
The bottom-right color-mode legend (all three variants: the rarity tier row, the altitude gradient bar, and the airspeed speedometer gauge) SHALL render using the map's currently active light/dark theme's panel, border, and text colors (per the theme mechanism defined for the top controls cluster and the right-hand layer-control drawer), rather than a fixed palette independent of the active theme.

#### Scenario: Legend uses dark-theme colors when dark theme is active
- **WHEN** the active theme is dark
- **THEN** the color-mode legend's background, border, and text render using the dark theme's palette

#### Scenario: Legend uses light-theme colors when light theme is active
- **WHEN** the active theme is light
- **THEN** the color-mode legend's background, border, and text render using the light theme's palette

#### Scenario: Legend updates immediately when the theme is toggled
- **WHEN** the color-mode legend is visible and the user toggles the theme
- **THEN** the legend's background, border, and text colors update to the newly active theme without requiring the legend to be closed/reopened or the active color mode to change

#### Scenario: Legend theming is consistent across all three variants
- **WHEN** the active theme changes while the rarity row, altitude bar, or airspeed gauge variant is showing
- **THEN** whichever variant is currently shown reflects the newly active theme's palette

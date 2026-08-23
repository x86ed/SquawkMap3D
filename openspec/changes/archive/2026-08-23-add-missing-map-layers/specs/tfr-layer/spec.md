## ADDED Requirements

### Requirement: US TFR layer loaded from a live feed
The map SHALL load current US Temporary Flight Restriction (TFR) boundaries from an FAA-published feed and render them as a distinct polygon layer, refetched periodically so displayed TFRs stay current.

#### Scenario: TFR layer loads successfully
- **WHEN** the TFR layer is enabled and the upstream feed responds successfully
- **THEN** current TFR polygons are parsed and rendered as a layer on the map

#### Scenario: TFR feed refetch
- **WHEN** the TFR layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches the TFR feed and updates the rendered polygons to reflect any TFRs that were added or expired

#### Scenario: TFR feed unavailable
- **WHEN** the TFR layer is enabled but the upstream feed request fails
- **THEN** the map does not error or break other layers; previously loaded TFR polygons (if any) remain displayed until the next successful refetch

### Requirement: TFR layer visually distinct
The TFR layer SHALL use a color/style clearly distinguishable from other airspace/boundary layers (military bases, special use airspace) and from the base map.

#### Scenario: TFR and special use airspace both visible
- **WHEN** both the TFR layer and the special use airspace layer are enabled on the map at the same time
- **THEN** a user can visually distinguish TFR polygons from special use airspace polygons by color or style alone

### Requirement: TFR layer is toggleable
The user SHALL be able to show or hide the TFR layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the TFR layer
- **WHEN** the user turns the TFR layer off
- **THEN** TFR polygons are no longer rendered, and periodic refetch stops, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the TFR layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the TFR layer remains hidden until the user explicitly turns it back on

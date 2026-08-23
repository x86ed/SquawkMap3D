## ADDED Requirements

### Requirement: US Special Use Airspace layer loaded from a live feed
The map SHALL load current US Special Use Airspace (restricted, prohibited, warning, alert, and MOA areas) from an FAA-published feed and render them as a distinct polygon layer, refetched periodically so displayed areas stay current.

#### Scenario: Special use airspace layer loads successfully
- **WHEN** the special use airspace layer is enabled and the upstream feed responds successfully
- **THEN** current special use airspace polygons are parsed and rendered as a layer on the map

#### Scenario: Feed refetch
- **WHEN** the special use airspace layer has been enabled long enough for at least one refresh interval to elapse
- **THEN** the map refetches the feed and updates the rendered polygons to reflect any changes

#### Scenario: Feed unavailable
- **WHEN** the special use airspace layer is enabled but the upstream feed request fails
- **THEN** the map does not error or break other layers; previously loaded polygons (if any) remain displayed until the next successful refetch

### Requirement: Special use airspace layer visually distinct
The special use airspace layer SHALL use a color/style clearly distinguishable from other airspace/boundary layers (military bases, TFRs) and from the base map.

#### Scenario: Special use airspace and military bases both visible
- **WHEN** both the special use airspace layer and the military bases layer are enabled on the map at the same time
- **THEN** a user can visually distinguish special use airspace polygons from military base shapes by color or style alone

### Requirement: Special use airspace layer is toggleable
The user SHALL be able to show or hide the special use airspace layer independently of any other map mode (light/dark theme, pilot mode) or other toggleable layer.

#### Scenario: Hiding the special use airspace layer
- **WHEN** the user turns the special use airspace layer off
- **THEN** special use airspace polygons are no longer rendered, and periodic refetch stops, while other layers and the base map remain visible

#### Scenario: Toggle persists across mode switches
- **WHEN** the user hides the special use airspace layer and then switches theme (light/dark) or toggles pilot mode
- **THEN** the special use airspace layer remains hidden until the user explicitly turns it back on

## ADDED Requirements

### Requirement: Day/night slider control in the top-right corner
The map SHALL display a slider-style control in the top-right corner, showing day/night (sun/moon) symbols, that selects between light and dark map theme. The slider's initial position SHALL reflect the same theme resolution behavior as today's theme control (operating system `prefers-color-scheme` unless the user has manually chosen a theme before).

#### Scenario: Slider reflects current theme
- **WHEN** the map has loaded
- **THEN** the day/night slider control is visible in the top-right corner and its position (day/light or night/dark side) matches the map's current theme

#### Scenario: User drags/clicks the slider to switch theme
- **WHEN** the user activates the slider to the opposite position
- **THEN** the map's theme switches to the corresponding light or dark style, the same way today's theme toggle button does

#### Scenario: Slider defaults to system preference
- **WHEN** the map loads for the first time and the user has never manually chosen a theme
- **THEN** the slider's initial position matches the operating system's reported color-scheme preference

### Requirement: Drawer-toggle button next to the theme slider
The map SHALL display a button immediately next to the day/night slider, in the same top-right corner cluster, that opens and closes the right-hand layer/plane-listing drawer.

#### Scenario: Button opens the drawer
- **WHEN** the drawer is closed and the user activates the drawer-toggle button
- **THEN** the right-hand drawer slides open

#### Scenario: Button closes the drawer
- **WHEN** the drawer is open and the user activates the drawer-toggle button again
- **THEN** the right-hand drawer slides closed

### Requirement: Right-hand slide-out drawer
The map SHALL provide a drawer that slides in from the right edge of the viewport, containing the layer-control accordion and the plane-listing panel as two separate top-level tabs, and that can be dismissed via the drawer-toggle button or an explicit close control inside the drawer.

#### Scenario: Drawer has its own close control
- **WHEN** the drawer is open
- **THEN** a close control inside the drawer is available that closes the drawer when activated, in addition to the top-right toggle button

#### Scenario: Opening/closing the drawer does not affect map or layer state
- **WHEN** the user opens or closes the drawer
- **THEN** the map's current view (center, zoom, pitch, bearing) and every layer's current visibility state remain unchanged

### Requirement: Top-level Layers/Aircraft tab navigation
The drawer body SHALL present two top-level, mutually-exclusive tabs — **Layers** and **Aircraft** — directly below the drawer header, so the layer-control accordion and the plane-listing panel never compete for the same vertical space. The Layers tab SHALL contain the view-controls row and the layer-control accordion (Aviation/Location/Environmental groups); the Aircraft tab SHALL contain the entire plane-listing panel (its own Search/Filters/Columns sub-tabs, the table, and the pinned source legend). Only one top-level tab's content is visible at a time.

#### Scenario: Layers tab shows view controls and the accordion
- **WHEN** the drawer is open and the Layers tab is active
- **THEN** the view-controls row and the Aviation/Location/Environmental accordion groups are visible, and the plane-listing panel is not

#### Scenario: Aircraft tab shows the plane listing panel
- **WHEN** the drawer is open and the Aircraft tab is active
- **THEN** the plane-listing panel (search/filters/columns and the table) is visible, and the layer-control accordion and view-controls row are not

#### Scenario: Switching top-level tabs preserves each tab's own state
- **WHEN** the user switches from Layers to Aircraft and back
- **THEN** the accordion's expanded/collapsed groups and the plane-listing panel's search/filter/column state are unchanged from before the switch

#### Scenario: Aircraft-tab polling only runs while that tab is active
- **WHEN** the drawer is open but the Layers tab is active (not Aircraft)
- **THEN** the plane-listing panel's aircraft-feed poll is not running, the same as when the drawer is fully closed

### Requirement: Accordion-grouped layer controls
The drawer SHALL present layer-visibility toggles grouped into collapsible accordion sections, each independently expandable/collapsible, organized as follows:
- **Aviation**: Airports, OpenAIP TMS, TFRs, Special Use Airspace, Airspace Boundaries, Military Bases, Aircraft (on-map aircraft icons)
- **Location**: Transponder Location, Actual Range Outline, Terrain-Based Range Outline, Range Rings
- **Environmental**: a nested "Weather" disclosure containing RainViewer, NEXRAD, NOAA Radar, DWD RADOLAN, and NOAA Infrared toggles; Day/Night Terminator; a disabled "Wildfires" placeholder row with no functioning toggle

Every toggle in this accordion SHALL control the exact same underlying layer-visibility behavior already documented by that layer's own capability spec (e.g. `airports-layer`, `openaip-airspace-layer`, `tfr-layer`, `special-use-airspace-layer`, `airspace-boundaries-layer`, `military-bases-layer`, `aircraft-tracks-layer`, `actual-range-outline-layer`, `terrain-based-outline-layer`, `day-night-terminator`, `rainviewer-radar-layer`, `nexrad-layer`, `noaa-radar-layer`, `dwd-radolan-layer`, `noaa-infrared-satellite-layer`) — this drawer only relocates each toggle's control, it does not alter any layer's visibility logic, refresh behavior, or default state.

#### Scenario: Accordion group expands and collapses independently
- **WHEN** the user activates an accordion group's header (e.g. "Aviation")
- **THEN** that group's rows expand or collapse, without affecting the expanded/collapsed state of the other groups

#### Scenario: Toggling a layer row shows or hides that layer
- **WHEN** the user activates a layer row's switch inside any accordion group
- **THEN** the corresponding map layer's visibility changes exactly as it would have via that layer's pre-existing toggle control, and the switch's visual state reflects the layer's current visibility

#### Scenario: Weather row nests the 5 existing weather layers
- **WHEN** the user expands the Environmental group's "Weather" row
- **THEN** RainViewer, NEXRAD, NOAA Radar, DWD RADOLAN, and NOAA Infrared each appear as their own independently-switchable row, and toggling one does not change any of the others' state

#### Scenario: Wildfires row is present but disabled
- **WHEN** the Environmental group is expanded
- **THEN** a "Wildfires" row is visible, styled as disabled/not-yet-available, and does not toggle any layer when activated

#### Scenario: Layer toggle state persists across drawer open/close and theme/pilot-mode switches
- **WHEN** a layer is toggled to a given visibility state and the drawer is subsequently closed and reopened, or the theme/pilot mode is switched
- **THEN** the accordion row's switch still reflects that layer's actual current visibility state

### Requirement: View controls row for non-layer map controls
The drawer SHALL display a small row of non-layer view controls (Follow Selected Aircraft, My Location) above the layer-control accordion, preserving their existing behavior.

#### Scenario: Follow-selected-aircraft control available in the drawer
- **WHEN** the drawer is open
- **THEN** a control for toggling "follow selected aircraft" is visible above the layer-control accordion, and activating it behaves exactly as it did before this change

#### Scenario: My-location control available in the drawer
- **WHEN** the drawer is open
- **THEN** a control for jumping the map to the user's current location is visible above the layer-control accordion, and activating it behaves exactly as it did before this change

### Requirement: Pilot mode control relocated to the top-right cluster
The top-right cluster (day/night slider and drawer-toggle button) SHALL also include the existing pilot-mode control, preserving its existing behavior, rather than placing it inside the drawer's layer accordion.

#### Scenario: Pilot mode control visible alongside slider and drawer button
- **WHEN** the map has loaded
- **THEN** a pilot-mode control is visible in the same top-right cluster as the day/night slider and drawer-toggle button, and activating it behaves exactly as it did before this change

### Requirement: Drawer covers the full viewport on narrow/mobile screens
Below a mobile viewport-width breakpoint, the drawer SHALL expand to cover the entire viewport width while open, and the top-right cluster (day/night slider, pilot-mode control, drawer-toggle button) SHALL be hidden while the drawer is open at that breakpoint.

#### Scenario: Drawer is full-width on a narrow viewport
- **WHEN** the viewport width is below the mobile breakpoint and the user opens the drawer
- **THEN** the drawer expands to cover the full viewport width, rather than a fixed-width panel over part of the map

#### Scenario: Top-right cluster hides while the full-screen drawer is open
- **WHEN** the viewport width is below the mobile breakpoint and the drawer is open
- **THEN** the top-right cluster is not visible, and the drawer's own close control is the way to close it

#### Scenario: Top-right cluster reappears once the drawer closes
- **WHEN** the viewport width is below the mobile breakpoint and the user closes the full-screen drawer
- **THEN** the top-right cluster becomes visible again

#### Scenario: Cluster stays visible above the mobile breakpoint
- **WHEN** the viewport width is at or above the mobile breakpoint
- **THEN** the top-right cluster remains visible regardless of whether the drawer is open or closed

### Requirement: Drawer width is resizable via a drag handle, and persists
At or above the mobile breakpoint, the drawer SHALL display a drag handle on its left edge that lets the user resize its width by dragging. The resulting width SHALL persist across drawer close/reopen and page reloads, within a minimum and maximum bound.

#### Scenario: Dragging the handle resizes the drawer
- **WHEN** the user drags the left-edge handle
- **THEN** the drawer's width changes to follow the drag, staying within its minimum and maximum bounds

#### Scenario: Resized width persists across reopen and reload
- **WHEN** the user resizes the drawer, then closes and reopens it, or reloads the page and reopens it
- **THEN** the drawer opens at the previously resized width

#### Scenario: Resize handle is absent on the mobile full-screen breakpoint
- **WHEN** the viewport width is below the mobile breakpoint
- **THEN** no resize handle is shown, since the drawer is already forced to full viewport width

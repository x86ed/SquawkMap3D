## ADDED Requirements

### Requirement: 2D/3D view mode toggle
The map SHALL provide a 2D/3D view-mode toggle, defaulting to 3D, implemented as the compass (reset-north) button of the existing top-left navigation control group. Clicking it SHALL reset the map bearing to north and switch between the two modes. In 2D mode the map SHALL be viewed from a dead-on top-down perspective (pitch 0) and the user SHALL NOT be able to change pitch; 3D terrain SHALL be disabled. Switching back to 3D SHALL restore the 3D pitch range and terrain.

#### Scenario: Toggle control placement
- **WHEN** the map has loaded
- **THEN** the top-left navigation control group (zoom buttons and compass) shows the compass button labeled with the current mode ("3D" initially)

#### Scenario: Switch to 2D
- **WHEN** the map is in 3D mode and the user clicks the compass/reset-north button
- **THEN** the bearing returns to 0 (north up), the pitch becomes 0, the button label changes to "2D", and 3D terrain is no longer applied

#### Scenario: No pitch in 2D
- **WHEN** the map is in 2D mode and the user performs a pitch gesture (e.g. right-click drag vertically, two-finger tilt)
- **THEN** the map pitch remains 0 (bearing may still change)

#### Scenario: Switch back to 3D
- **WHEN** the map is in 2D mode and the user clicks the compass button
- **THEN** the bearing is 0, the map pitch returns to its pre-2D value (or the default initial pitch), terrain is re-applied, and the label shows "3D"

#### Scenario: Mode survives style swap
- **WHEN** the map is in 2D mode and the user switches theme or pilot mode
- **THEN** the map remains in 2D mode at pitch 0 without terrain

## MODIFIED Requirements

### Requirement: 3D perspective
The map SHALL render with a 3D perspective by default and, while in 3D view mode, SHALL allow the user to change pitch and bearing through standard map interactions (drag-rotate, scroll/pinch). In 2D view mode (see "2D/3D view mode toggle") pitch SHALL be fixed at 0.

#### Scenario: Initial 3D view
- **WHEN** the map finishes loading
- **THEN** the map is in 3D mode and its initial pitch is greater than 0 degrees, showing a tilted 3D perspective rather than a flat top-down view

#### Scenario: User rotates and tilts the map
- **WHEN** the map is in 3D mode and a user performs a drag-rotate gesture (e.g., right-click-drag or two-finger drag)
- **THEN** the map's bearing and/or pitch updates in response to the gesture, up to the configured maximum pitch

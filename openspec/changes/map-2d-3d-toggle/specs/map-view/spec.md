## ADDED Requirements

### Requirement: 2D/3D view mode toggle
The map SHALL provide a 2D/3D view-mode toggle, defaulting to 3D, implemented as an additional button in the existing top-left navigation control group, styled to match it. The button SHALL be labeled with the current mode ("2D" or "3D"). The compass (reset-north) button SHALL keep its normal reset-north behavior in both modes and SHALL NOT act as the toggle. In 2D mode the map SHALL be viewed dead-on top-down (pitch 0) and the user SHALL NOT be able to change pitch; 3D terrain SHALL be disabled, and aircraft SHALL be drawn as inline SVG DOM markers (see aircraft-tracks-layer). Switching back to 3D SHALL restore the 3D pitch range and terrain and remove the 2D markers.

#### Scenario: Toggle control placement
- **WHEN** the map has loaded
- **THEN** the top-left control group shows the zoom buttons, the compass, and a separate 2D/3D button labeled with the current mode ("3D" initially)

#### Scenario: Switch to 2D
- **WHEN** the map is in 3D mode and the user clicks the 2D/3D button
- **THEN** the pitch becomes 0, the button label changes to "2D", and 3D terrain is no longer applied

#### Scenario: Compass still resets north
- **WHEN** the user clicks the compass button in either 2D or 3D mode
- **THEN** the bearing returns to 0 and the view mode does not change

#### Scenario: No pitch in 2D
- **WHEN** the map is in 2D mode and the user performs a pitch gesture (e.g. right-click drag vertically, two-finger tilt)
- **THEN** the map pitch remains 0 (bearing may still change)

#### Scenario: Switch back to 3D
- **WHEN** the map is in 2D mode and the user clicks the 2D/3D button
- **THEN** the map pitch returns to its pre-2D value (or the default initial pitch), terrain is re-applied, and the label shows "3D"

#### Scenario: 2D aircraft are inline SVG markers
- **WHEN** the map is in 2D mode with aircraft in view
- **THEN** the aircraft are displayed as inline SVG markers positioned and rotated on the map (up to the marker cap, with static icon fallback beyond it), and switching back to 3D removes those markers

#### Scenario: Mode survives style swap
- **WHEN** the map is in 2D mode and the user switches theme or pilot mode
- **THEN** the map remains in 2D mode at pitch 0 without terrain

### Requirement: View mode is persisted
The selected view mode SHALL be persisted in browser `localStorage` (key `squawkmap3d:viewMode`) using the same convention as the theme and drawer-width preferences, SHALL default to 3D when nothing valid is stored, and SHALL be restored on load.

#### Scenario: Default
- **WHEN** the app loads with no stored view mode
- **THEN** the map is in 3D mode

#### Scenario: Restored on reload
- **WHEN** the user switches to 2D and reloads the page
- **THEN** the map loads in 2D mode (pitch 0, no terrain, label "2D")

#### Scenario: Invalid or unavailable storage
- **WHEN** the stored value is not "2d" or "3d", or `localStorage` is unavailable
- **THEN** the map loads in 3D mode without error

## MODIFIED Requirements

### Requirement: 3D perspective
The map SHALL render with a 3D perspective by default and, while in 3D view mode, SHALL allow the user to change pitch and bearing through standard map interactions (drag-rotate, scroll/pinch). In 2D view mode (see "2D/3D view mode toggle") pitch SHALL be fixed at 0.

#### Scenario: Initial 3D view
- **WHEN** the map finishes loading
- **THEN** the map is in 3D mode and its initial pitch is greater than 0 degrees, showing a tilted 3D perspective rather than a flat top-down view

#### Scenario: User rotates and tilts the map
- **WHEN** the map is in 3D mode and a user performs a drag-rotate gesture (e.g., right-click-drag or two-finger drag)
- **THEN** the map's bearing and/or pitch updates in response to the gesture, up to the configured maximum pitch

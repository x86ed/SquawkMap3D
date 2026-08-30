## MODIFIED Requirements

### Requirement: Toggle to hide/show user location marker and range rings
The map SHALL provide two independent on-screen controls: one that toggles visibility of the satellite icon marker alone (the "Transponder Location" control), and one that toggles visibility of all 4 range rings (with labels) alone (the "Range Rings" control). Each control SHALL only affect visibility of its own already-rendered layer(s) and SHALL NOT clear the underlying resolved location, and SHALL NOT affect the other control's layer(s).

#### Scenario: User hides the transponder-location marker independently of range rings
- **WHEN** the satellite icon marker is visible and the user activates the Transponder Location toggle
- **THEN** the satellite icon marker is hidden from the map, and the range rings and their labels remain in whatever visibility state the Range Rings toggle was already in

#### Scenario: User hides range rings independently of the transponder-location marker
- **WHEN** the range rings are visible and the user activates the Range Rings toggle
- **THEN** all 4 range rings and their labels are hidden from the map, and the satellite icon marker remains in whatever visibility state the Transponder Location toggle was already in

#### Scenario: User re-shows the transponder-location marker
- **WHEN** the satellite icon marker is hidden and the user activates the Transponder Location toggle again
- **THEN** the satellite icon marker reappears at the user's last-resolved coordinates

#### Scenario: User re-shows range rings
- **WHEN** the range rings are hidden and the user activates the Range Rings toggle again
- **THEN** all 4 range rings and their labels reappear centered on the user's last-resolved coordinates

#### Scenario: Both toggle states persist independently across a theme switch
- **WHEN** the user switches the map's light/dark theme while the Transponder Location and Range Rings toggles are in different visibility states from each other
- **THEN** each layer remains in its own independent visibility state after the theme's style finishes reloading, rather than the two layers becoming coupled or either one reappearing unexpectedly

#### Scenario: Toggling either control while no location has been resolved yet
- **WHEN** the user activates either the Transponder Location or Range Rings toggle before any location has ever been resolved
- **THEN** that control's state changes but no marker or rings appear, since none have been rendered yet

#### Scenario: Both marker and rings can be shown simultaneously
- **WHEN** both the Transponder Location and Range Rings toggles are set to visible
- **THEN** the satellite icon marker and all 4 range rings and their labels are all visible at the same time, matching this requirement's pre-existing combined-visibility behavior when both controls happen to agree

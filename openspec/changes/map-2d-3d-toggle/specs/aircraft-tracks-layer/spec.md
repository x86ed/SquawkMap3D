## ADDED Requirements

### Requirement: Aircraft representation follows view mode
In 3D view mode, aircraft with a loaded 3D model SHALL render as that model (existing behavior). In 2D view mode, every aircraft SHALL render as its 2D icon (resolved per the existing icon-resolution order) and no 3D model SHALL be rendered.

#### Scenario: Models swap to icons in 2D
- **WHEN** a modeled aircraft is displayed as a 3D model and the user switches the map to 2D mode
- **THEN** that aircraft is rendered as its 2D icon, nose-up rotated to its track, and the 3D model is no longer shown, without waiting for the next data poll

#### Scenario: Icons swap back to models in 3D
- **WHEN** the user switches from 2D back to 3D mode
- **THEN** aircraft whose type has a loaded 3D model render as models again

#### Scenario: Selection and tracks unaffected
- **WHEN** the view mode changes
- **THEN** the selected aircraft, its highlight, tracks, and hover tooltip remain intact

### Requirement: Vertical rotors animate in 2D mode
In 2D view mode, every aircraft with vertical rotors (helicopters, i.e. the rotorcraft emitter category or an ICAO type designator classified as rotorcraft, and other vertical-rotor types such as tiltrotors, gyrocopters and multirotor UAVs where the type's shape defines rotors) SHALL render its 2D icon with its rotor element(s) visibly spinning, continuously and smoothly (animated per rendered frame, not stepped once per data poll), around the rotor's own hub, independent of the aircraft's track updates. Fuselage orientation SHALL remain fixed to the aircraft's track while rotors spin.

#### Scenario: Helicopter rotor spins in 2D
- **WHEN** the map is in 2D mode and a helicopter is displayed
- **THEN** its rotor blades rotate continuously and smoothly about the rotor hub while the fuselage stays aligned to track

#### Scenario: Non-rotor aircraft do not spin
- **WHEN** the map is in 2D mode and a fixed-wing aircraft is displayed
- **THEN** no rotor animation is shown on it

#### Scenario: Rotor spin continues between polls
- **WHEN** no new aircraft data has arrived for several frames in 2D mode
- **THEN** rotors on displayed rotorcraft continue spinning

#### Scenario: Spin stops when leaving 2D animation path
- **WHEN** the user switches to 3D mode
- **THEN** the 2D rotor animation loop stops and rotor motion is provided by the 3D models' own rotor animation

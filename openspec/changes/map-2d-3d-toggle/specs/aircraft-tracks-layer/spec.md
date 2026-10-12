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
In 2D view mode, every aircraft whose 2D icon SVG declares top-mounted rotors via rotor bindings (`<g data-rotor data-rotor-pivot data-rotor-direction data-rotor-rpm>` groups) SHALL render with each such rotor spinning continuously and smoothly (animated per rendered frame, not stepped once per data poll) about that rotor's pivot (hub). Each rotor SHALL spin in its declared direction (`cw`/`ccw` as seen looking at the nose-up icon), so contra-rotating rotors turn opposite ways. The display rate SHALL be `clamp(rpm / 600 * 2.5, 1, 4)` revolutions per second, with a missing rpm treated as 600; `data-rotor-pivot` SHALL be interpreted in the SVG's viewBox user units (accounting for a non-zero viewBox origin) and direction SHALL always be read per rotor from `data-rotor-direction`, never assumed. The fuselage (all non-rotor shapes) SHALL stay fixed to the aircraft's track while rotors spin, and the rotor blades SHALL NOT also be drawn statically in the fuselage. Aircraft whose SVG has no rotor bindings (fixed-wing, tail rotors, propellers) SHALL NOT show any rotor animation, and their icon SHALL be unchanged.

#### Scenario: Helicopter rotor spins in 2D
- **WHEN** the map is in 2D mode and an aircraft whose SVG has a `data-rotor` group is displayed
- **THEN** that rotor rotates continuously and smoothly about its `data-rotor-pivot` while the fuselage stays aligned to the aircraft's track

#### Scenario: Contra-rotating or multiple rotors
- **WHEN** the displayed SVG has several `data-rotor` groups with differing directions (e.g. a rotor and its `-mirror` copy)
- **THEN** each spins about its own pivot in its own declared direction

#### Scenario: Hub stays attached
- **WHEN** an aircraft with an off-center rotor pivot changes track or the map bearing changes
- **THEN** each rotor's hub remains at its pivot location on the fuselage

#### Scenario: Speed mapping
- **WHEN** a rotor declares `data-rotor-rpm` of 600 (or none), and another declares a much larger or smaller rpm
- **THEN** the first spins at 2.5 rev/s and the other at `clamp(rpm / 600 * 2.5, 1, 4)` rev/s

#### Scenario: No bindings, no spin
- **WHEN** the map is in 2D mode and a displayed aircraft's SVG has no `data-rotor` groups
- **THEN** no rotor animation is shown on it (a rotorcraft-category aircraft without bindings keeps only the existing generic rotor-disc accent)

#### Scenario: Rotor spin continues between polls
- **WHEN** no new aircraft data has arrived for several frames in 2D mode
- **THEN** rotors on displayed aircraft continue spinning

#### Scenario: Animation stops in 3D
- **WHEN** the user switches to 3D mode
- **THEN** the 2D rotor animation loop stops and rotor motion is provided by the 3D models' own rotor animation

## ADDED Requirements

### Requirement: Aircraft representation follows view mode
In 3D view mode, aircraft with a loaded 3D model SHALL render as that model (existing behavior). In 2D view mode, no 3D model SHALL be rendered and every aircraft SHALL render as its 2D icon (resolved per the existing icon-resolution order): primarily as an inline SVG DOM marker (see "Aircraft render as inline SVG markers in 2D"), and as a static `IconLayer` icon for aircraft beyond the marker cap.

#### Scenario: Models swap to icons in 2D
- **WHEN** a modeled aircraft is displayed as a 3D model and the user switches the map to 2D mode
- **THEN** that aircraft is rendered as its 2D icon (inline SVG marker, or static icon beyond the cap), nose-up rotated to its track, and the 3D model is no longer shown, without waiting for the next data poll

#### Scenario: Icons swap back to models in 3D
- **WHEN** the user switches from 2D back to 3D mode
- **THEN** aircraft whose type has a loaded 3D model render as models again

#### Scenario: Swap back to 3D removes markers
- **WHEN** the user switches from 2D to 3D mode
- **THEN** all 2D SVG DOM markers are removed from the page and the rotor animation loop stops

#### Scenario: Selection and tracks unaffected
- **WHEN** the view mode changes
- **THEN** the selected aircraft, its highlight, tracks, and hover tooltip remain intact

### Requirement: Aircraft render as inline SVG markers in 2D
In 2D view mode, each visible aircraft (up to the cap) SHALL be rendered as an inline SVG DOM element (a MapLibre `Marker`) built from its vendored per-type SVG in `public/aircraft-shapes`, positioned by the map projection at its lon/lat and rotated by its track. The SVG SHALL be the live element itself (not rasterized into the icon atlas), keeping its own geometry. The aircraft's colour (the same altitude/colour-mode tint the icons use) SHALL be applied to the whole SVG including any rotor groups as a single tint, with no separate rotor treatment. Only aircraft inside the map bounds plus padding SHALL receive markers; the number of markers SHALL NOT exceed a fixed cap (`MAX_2D_DOM_MARKERS`, 300), prioritising the selected and hovered aircraft then those nearest the map center; aircraft beyond the cap SHALL be drawn as the existing static deck.gl `IconLayer` icons (never both). Markers SHALL be reused (pooled) by aircraft id across polls, and updated for position, rotation and tint on each poll, with position following map movement. Altitude SHALL be flattened (no lift). In 3D mode no such markers SHALL exist.

#### Scenario: Aircraft drawn as its own SVG
- **WHEN** the map is in 2D mode and an aircraft is in view and under the cap
- **THEN** it is shown as an inline SVG element from its type's vendored SVG, rotated to its track, at its lon/lat

#### Scenario: Tint matches icon color
- **WHEN** an aircraft's altitude/colour-mode color is C and it is shown as a 2D marker
- **THEN** the entire SVG, including rotor groups, is tinted C as one tint, and the color updates when the aircraft's altitude or the colour mode changes

#### Scenario: Cap fallback
- **WHEN** more aircraft are in view than the marker cap
- **THEN** exactly the cap number have DOM markers (selected and hovered first, then nearest the center) and the remainder appear as static `IconLayer` icons, none drawn twice

#### Scenario: Culling
- **WHEN** an aircraft is outside the map bounds plus padding
- **THEN** it has no DOM marker, and it receives one when the map pans so it enters the padded bounds

#### Scenario: Marker reuse across polls
- **WHEN** a new poll arrives containing an aircraft that already has a marker
- **THEN** the same marker is moved and rotated rather than recreated

#### Scenario: Selection and hover work on markers
- **WHEN** the user clicks or hovers a 2D marker
- **THEN** that aircraft is selected / its hover tooltip shows, as with deck.gl picking, and its track, dropline and selection pulse continue to display

#### Scenario: Map move keeps markers aligned
- **WHEN** the user pans, zooms or rotates the map in 2D
- **THEN** markers stay at their aircraft's geographic position

### Requirement: Vertical rotors animate in 2D mode
In 2D view mode, every aircraft marker whose SVG declares top-mounted rotors via rotor bindings (`<g data-rotor data-rotor-pivot data-rotor-direction data-rotor-rpm>` groups) SHALL have those `[data-rotor]` groups animated by the SVG itself: a shared per-frame loop sets each group's `transform` attribute to `rotate(deg cx cy)` with the pivot taken from `data-rotor-pivot` in viewBox user units (equivalent to the iconizer `readRotorBindings`/`applyRotorSpin`). Rotation SHALL be smooth (per rendered frame, not stepped per poll). Direction SHALL be read per rotor from `data-rotor-direction` (`cw` => clockwise on screen, `ccw` => counter-clockwise, as seen on the nose-up icon), never assumed, so contra-rotating rotors turn opposite ways. The rate SHALL be a fixed 1 revolution per second for every rotor, independent of `data-rotor-rpm`. The fuselage SHALL stay fixed to the track while rotors spin. SVGs without rotor bindings (fixed-wing, tail rotors, propellers) SHALL render static, exactly as drawn, with no synthesized rotor. Aircraft drawn as fallback `IconLayer` icons beyond the cap SHALL be static.

#### Scenario: SVG animates itself
- **WHEN** the map is in 2D mode and a marker's SVG has a `data-rotor` group
- **THEN** that group's `transform` is repeatedly set to `rotate(deg cx cy)` using its `data-rotor-pivot`, and the rotor visibly turns while the rest of the SVG stays fixed

#### Scenario: Contra-rotating or multiple rotors
- **WHEN** the displayed SVG has several `data-rotor` groups with differing directions (e.g. a rotor and its `-mirror` copy)
- **THEN** each spins about its own pivot in its own declared direction

#### Scenario: Speed mapping
- **WHEN** one rotor declares `data-rotor-rpm` of 600 (or none) and another a much larger or smaller rpm
- **THEN** both spin at 1 rev/s; only the direction sign differs

#### Scenario: Rotor tinted with the SVG
- **WHEN** a rotorcraft marker is displayed with tint C
- **THEN** its rotor groups are tinted C like the rest of the SVG

#### Scenario: No bindings, static SVG
- **WHEN** the map is in 2D mode and an aircraft's SVG has no `data-rotor` groups
- **THEN** its marker shows the SVG static and nothing is added in place of a rotor (including rotorcraft-category aircraft without bindings)

#### Scenario: Rotor spin continues between polls
- **WHEN** no new aircraft data has arrived for several frames in 2D mode
- **THEN** rotors on displayed markers continue spinning

#### Scenario: Animation stops in 3D
- **WHEN** the user switches to 3D mode
- **THEN** the 2D rotor animation loop stops and rotor motion is provided by the 3D models' own rotor animation

### Requirement: Aircraft altitude is not lifted in 2D
In 2D view mode, aircraft markers and fallback icons, their glow, track paths and the selection pulse SHALL be positioned at ground level (no altitude-derived z offset), so aircraft stay at their true lon/lat across the whole top-down view including the screen edges. In 3D view mode, aircraft SHALL keep their altitude-based lift. Altitude-based coloring is unaffected.

#### Scenario: High aircraft not displaced in 2D
- **WHEN** the map is in 2D mode and an aircraft is at 35,000 ft
- **THEN** its marker/icon, track and highlight are drawn with zero altitude lift, at its ground position

#### Scenario: Lift restored in 3D
- **WHEN** the user switches from 2D to 3D mode
- **THEN** aircraft and tracks are lifted by altitude again without waiting for the next data poll

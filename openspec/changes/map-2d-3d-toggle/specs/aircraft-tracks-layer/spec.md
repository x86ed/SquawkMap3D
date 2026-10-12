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

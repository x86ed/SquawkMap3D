## MODIFIED Requirements

### Requirement: Recent flight track rendered per aircraft
The map SHALL accumulate and render a recent flight-track trail for each visible aircraft, built from successive position reports received while the layer is enabled, with the trail's color or shading reflecting the aircraft's value under the currently active aircraft color mode (per the `aircraft-color-mode-control` capability) along its path. The trail's most recent segment — connecting the aircraft's immediately-prior reported position to its current one — SHALL render fully solid/opaque. Older segments SHALL progressively fade toward a dimmer, but never fully invisible, opacity as they approach the track's retention cutoff.

#### Scenario: Track builds from successive polls
- **WHEN** an aircraft is observed across multiple successive feeder refreshes
- **THEN** the map renders a trail connecting its recent reported positions in 3D, positioned at each point's reported altitude

#### Scenario: Track colored by the active color mode
- **WHEN** an aircraft's track spans a meaningful change in the value driving the currently active color mode (altitude, airspeed, or rarity)
- **THEN** the rendered trail's color visibly varies along its length to reflect that change

#### Scenario: Most recent track segment renders solid
- **WHEN** an aircraft's track has at least two recorded points
- **THEN** the segment connecting its two most recent points renders at full opacity, regardless of how much time has passed since the aircraft's previous poll

#### Scenario: Older track segments fade with age
- **WHEN** a track segment other than the most recent one is rendered
- **THEN** its rendered opacity is visibly dimmer than the most recent segment's, decreasing further the older that segment is, down to a fixed minimum opacity rather than becoming fully invisible before it is pruned from the track history

#### Scenario: Aircraft no longer reported
- **WHEN** an aircraft that previously had a rendered track stops appearing in the feeder's reported aircraft
- **THEN** the map stops updating that aircraft's marker and track, without erroring or affecting other aircraft

## ADDED Requirements

### Requirement: Track points rendered with a dotted ground-reference line
Each rendered track SHALL show a thin, dotted vertical reference line dropping from a decimated subset of that track's recorded points straight down to the ground directly beneath each point's position, so the viewer can gauge how far above the terrain that point in the track was. The most recent point of every rendered track SHALL always be included in this subset, regardless of the decimation spacing. This reference line SHALL render in a fixed color independent of the currently active aircraft color mode.

#### Scenario: Dropline renders beneath a track point
- **WHEN** a track point is included in the decimated dropline subset
- **THEN** a dotted vertical line renders from that point's rendered altitude down to the ground at that point's lon/lat

#### Scenario: Most recent point always has a dropline
- **WHEN** a track has at least one recorded point
- **THEN** its most recent point is always included in the dropline subset, even if it falls short of the normal decimation spacing since the previously-included point

#### Scenario: Dropline color is independent of the active color mode
- **WHEN** the user switches the active aircraft color mode
- **THEN** the rendered dropline color does not change

### Requirement: Track trail rendered with a descending gradient curtain toward the ground
Each rendered track SHALL show a gradient "curtain" beneath its trail, fading from that portion of the trail's own current draw color (per the active color mode) near the trail down to fully transparent toward the ground, built from the same decimated point subset used for the dotted ground-reference line.

#### Scenario: Curtain fades from the trail color to transparent
- **WHEN** a segment of a track's curtain is rendered between two points
- **THEN** its color visibly fades from that segment's own draw color near the trail's altitude down to fully transparent near the ground

#### Scenario: Curtain color tracks the active color mode
- **WHEN** the user switches the active aircraft color mode
- **THEN** the rendered curtain's color updates to match the trail's newly-resolved color under the new mode

### Requirement: Aircraft track visibility is toggleable independently of aircraft icon visibility
The user SHALL be able to show or hide rendered flight tracks (trail, its glow, ground droplines, and ground curtain) independently of the aircraft icon layer's own visibility toggle. Hiding tracks SHALL NOT stop aircraft position polling, aircraft icon rendering, or track recording — track history SHALL continue to accumulate while hidden, so re-enabling tracks shows the full, uninterrupted trail rather than one that resumes empty.

#### Scenario: Hiding tracks leaves aircraft icons visible
- **WHEN** the user hides aircraft tracks while the aircraft icon layer remains visible
- **THEN** aircraft icons continue to render and update on each feeder refresh, while track trails, their glow, droplines, and curtains are no longer rendered

#### Scenario: Tracks continue recording while hidden
- **WHEN** aircraft tracks are hidden and the aircraft-feed refresh interval elapses one or more times
- **THEN** each aircraft's track history continues to accumulate new points in the background

#### Scenario: Re-showing tracks displays the full accumulated trail
- **WHEN** the user re-enables aircraft track visibility after having hidden it
- **THEN** the trail renders using the complete track history accumulated since it was last cleared, not only positions recorded after tracks were re-enabled

#### Scenario: Hiding tracks does not affect the aircraft icon toggle
- **WHEN** the user hides aircraft tracks
- **THEN** the aircraft icon layer's own visibility toggle remains unaffected and controllable independently

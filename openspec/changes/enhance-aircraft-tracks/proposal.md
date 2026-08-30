## Why

Aircraft flight tracks (`aircraft-tracks-layer`) currently render as a single uniform-opacity, 2px `PathLayer` line plus its always-on glow (`2026-08-30-aircraft-glow`) — every segment looks the same regardless of how old it is, there's no visual cue connecting a track point back down to the ground beneath it, and a busy trail reads as a flat ribbon rather than something with depth relative to the terrain. The user wants the trail to read more like a real 3D flight path: a clear "this segment is where the plane is right now" cue, a sense of height above the ground at each point, and the trail's own visibility decoupled from the aircraft icons themselves (so tracks can be decluttered without losing the aircraft positions).

## What Changes

- Each recorded track point gets a thin **dotted vertical line down to the ground** (deck.gl world z=0, directly below that point's lon/lat) — a decimated subset of a track's points (always including its most recent), not every raw ~1s-polled point, to bound the added draw cost against the existing unbounded-length track buffer (`AIRCRAFT_TRACK_RETENTION_MS`, 10 minutes).
- Beneath the horizontal 3D trail itself, add a **gradient "curtain"** that fades from each segment's own draw color down to transparent toward the ground — approximated as several stacked, decreasing-alpha `PathLayer` bands (no new deck.gl layer type or npm dependency), built from the same decimated point subset as the new droplines so the two visuals share one "how far apart are these markers" tuning knob.
- The **most recent track segment** (connecting an aircraft's previous reported position to its current one) renders fully solid/opaque, matching today's line, while **older segments progressively fade** in opacity as they recede toward the retention cutoff — a "comet tail" read, rather than every segment looking identical regardless of age.
- A new **"Aircraft tracks" toggle**, separate from the existing "Aircraft" (icon) toggle, lets the user hide/show the trail (line, glow, droplines, curtain) independently — aircraft icons, polling, and track *recording* are unaffected by this toggle; it only controls what `buildAircraftLayers()` renders for the trail.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-tracks-layer`: the recent-flight-track requirement gains age-based opacity fade (most-recent segment solid, older segments dimmer); two new requirements — a dotted ground-reference line under each recorded (decimated) track point, and a gradient ground curtain under the trail; a new requirement making track *visibility* independently toggleable from aircraft *icon* visibility.

## Impact

- `components/map/aircraftLayer.ts`: `buildAircraftLayers()` gains a `tracksVisible: boolean` param gating all track-related layers (line, its glow, new droplines, new curtain) — icon/rotor/icon-glow layers are unaffected by it. `TrackSegment` gains an age-derived alpha (most-recent segment pinned to full opacity) folded into `trackLayer`'s and `trackGlowLayer`'s existing `getColor`. Two new layers: a `ScatterplotLayer` for the dotted ground droplines, and a small set of stacked `PathLayer`s (or a single `PathLayer` built from repeated banded data) for the ground curtain — both built from a new decimated "track markers" subset (always including the most recent point), not the full raw per-poll point list.
- `components/map/constants.ts`: new constants for the fade-alpha floor, the marker decimation interval, dropline dot count/radius/color/alpha, and curtain band count/top-alpha.
- `components/map/MapView.tsx`: new `tracksVisible`/`tracksVisibleRef` state pair, `handleTracksToggle`, a new `LayerToggleRow` ("Aircraft tracks") in the drawer next to the existing "Aircraft" row, and the new param threaded into every `buildAircraftLayers()` call site.
- No changes to `components/map/aircraft.ts` (feeder polling/track recording), `aircraft-color-mode-control`, aircraft selection/hover/click behavior, or icon rendering.

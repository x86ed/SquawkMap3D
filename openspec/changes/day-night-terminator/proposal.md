## Why

The map currently shows no indication of where it's day or night on Earth right now. For a situational-awareness tool like this (pilots, ADS-B watchers), knowing which parts of the world are in daylight vs. darkness at a glance — e.g. for VFR/lighting conditions context — is useful and currently requires leaving the app.

## What Changes

- Add a day/night terminator overlay: the night hemisphere is shaded, with a soft twilight gradient (not a hard edge) fading into the day side, computed from the sun's current subsolar point.
- The overlay live-updates as time passes, recomputed periodically so it tracks the sun's actual position through the day and across seasons (the terminator's tilt/shape changes with the time of year).
- Add a dedicated toggle button (mirroring the existing military-bases/airports toggle pattern) to show/hide the terminator layer.
- The overlay reads correctly in both the light and dark map themes.

## Capabilities

### New Capabilities
- `day-night-terminator`: computes the current solar terminator and renders it as a live-updating, toggleable, twilight-graduated night-hemisphere overlay on the map.

### Modified Capabilities
(none — purely additive layer, same pattern as `military-bases-layer`; doesn't change `map-view`, `pilot-map-mode`, `airports-layer`, or `user-location-marker` behavior)

## Impact

- New `components/map/terminator.ts` (or similar): subsolar-point/terminator-curve calculation, GeoJSON polygon builder for the night region and twilight bands, source/layer add + periodic refresh + visibility toggle helpers (mirroring `layers.ts`'s existing patterns).
- `components/map/MapView.tsx`: mount a refresh interval (start on load, clear on unmount/style swap as needed), add terminator-visible toggle state/button.
- `components/map/constants.ts`: add any new constants (refresh interval, twilight angle thresholds).
- Likely new dependency for solar-position calculation (subsolar point / sun declination), unless implemented directly from standard astronomical approximation formulas — to be decided in design.md.
- No changes to the airports/military-bases/pilot-mode/user-location layers or their toggles; this is an additional, independent layer following their established conventions.

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

- New `components/map/terminator.ts`: subsolar-point/terminator-curve calculation (hand-rolled, no dependency), GeoJSON polygon builder for the day/night twilight bands, source/layer add + periodic refresh + visibility toggle helpers (mirroring `layers.ts`'s existing patterns). Both themes render through the same alpha-blended `fill`-layer mechanism — light theme darkens the night region, dark theme brightens the day region instead, with a much lower per-theme opacity (darkening has visual headroom against a light basemap that brightening doesn't have against a dark one). A custom WebGL "screen blend" layer (`terminatorGL.ts`, `earcut` dependency) was tried and reverted per explicit user request to keep both themes on the same simple mechanism — see design.md's addendum.
- `components/map/MapView.tsx`: mount a refresh interval (start on load, clear on unmount), add terminator-visible toggle state/button. Added before `addCustomLayers` in the style-setup sequence so it sits at the bottom of the custom-layer stack (MapLibre stacks in insertion order) — otherwise its tint sat on top of the sectional chart/military bases/airports, dimming them.
- `components/map/constants.ts`: refresh interval, twilight elevation thresholds.
- No new dependencies in the final version (the `earcut`/WebGL detour was reverted).
- No changes to the airports/military-bases/pilot-mode/user-location layers or their toggles; this is an additional, independent layer following their established conventions.

## 1. Solar position math

- [ ] 1.1 In `components/map/terminator.ts`, implement pure functions for: Julian day from a `Date`, Greenwich Mean Sidereal Time, the sun's ecliptic longitude, ecliptic obliquity, and the sun's equatorial position (right ascension + declination) — standard solar-position formulas, no dependency.
- [ ] 1.2 Implement `terminatorLatitudeAtLongitude(lng, sunPosition, gst, elevationDeg): number | null` solving `sin(elevationDeg) = sin(lat)sin(δ) + cos(lat)cos(δ)cos(H)` for latitude given the hour angle `H` at that longitude; return `null` where no real solution exists (that longitude is entirely inside/outside this elevation band at every latitude — i.e. polar day/night).
- [ ] 1.3 Add a few sanity-check unit tests (`node --test`, matching the project's existing `test/` convention) for the pure math: subsolar declination ≈ Earth's axial tilt (~23.44°) at a known solstice date, ≈ 0° at a known equinox date.

## 2. Terminator geometry

- [ ] 2.1 Implement `buildTerminatorBand(date, elevationDeg): GeoJSON.Polygon` that walks longitude from -180° to 180° at a fixed step (e.g. 2°), calling `terminatorLatitudeAtLongitude` per step, and closes the ring toward whichever pole is on the night side of that elevation threshold (based on the sign of the subsolar declination), correctly covering full polar-day/polar-night cases where the curve has no solution at some longitudes.
- [ ] 2.2 Implement `buildTerminatorBands(date): GeoJSON.FeatureCollection` calling `buildTerminatorBand` at a series of elevation thresholds (e.g. 8 steps from a light dusk threshold down to -18°), each feature tagged with its band index/opacity in `properties`.

## 3. Layer wiring

- [ ] 3.1 In `components/map/constants.ts`, add `TERMINATOR_REFRESH_INTERVAL_MS` (e.g. 60000) and the elevation-threshold list used by `buildTerminatorBands`.
- [ ] 3.2 In `components/map/terminator.ts`, add `addTerminatorLayers(map)` (idempotent add of one GeoJSON source + one `fill` layer per band, stacked bottom-to-top from lightest to darkest, each with a small fixed opacity and a shared dark fill color) and `setTerminatorVisibility(map, visible)`, mirroring `layers.ts`'s `setMilitaryBasesVisibility`/`setAirportsVisibility` pattern.
- [ ] 3.3 Add `refreshTerminator(map, date)` that calls `buildTerminatorBands` and `source.setData(...)` on the existing source (no-ops safely if the source doesn't exist yet, e.g. mid-style-swap).

## 4. MapView integration

- [ ] 4.1 In `components/map/MapView.tsx`'s mount effect, call `addTerminatorLayers`/`refreshTerminator` alongside the other `setupStyleDependentState` calls (on `load` and `style.load`), passing the initial `terminatorVisibleRef.current`.
- [ ] 4.2 Start a `setInterval` (using `TERMINATOR_REFRESH_INTERVAL_MS`) that calls `refreshTerminator` on tick; store the handle in a ref and clear it on unmount, mirroring the existing dish-rotation cleanup pattern (`dishRotationStopRef`).
- [ ] 4.3 Add `terminatorVisibleRef`/`terminatorVisible` state (default `true`), a `handleTerminatorToggle`, and a "Hide/Show day-night terminator" button in the controls panel, matching the existing airports/military-bases toggle button pattern.

## 5. Verification

- [ ] 5.1 Manually verify the terminator renders over the currently-dark side of the Earth and matches expectations for the current real-world time (spot-check against a known reference, e.g. a public day/night map).
- [ ] 5.2 Manually verify the day/night boundary reads as a gradient (multiple visible shading steps) rather than one hard edge.
- [ ] 5.3 Manually verify the toggle hides/shows the overlay and persists across a theme switch and a pilot-mode toggle while hidden.
- [ ] 5.4 Manually verify the overlay is legible in both the light and dark map themes.
- [ ] 5.5 Manually verify no leaked interval: toggle theme repeatedly and confirm the terminator still updates/looks correct afterward (no stacked duplicate intervals, no stopped updates).

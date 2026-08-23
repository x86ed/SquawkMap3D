## Context

`components/map/layers.ts` already establishes the pattern this change follows: a GeoJSON source + fill layer(s), a `setXVisibility(map, visible)` helper, and a ref+state toggle wired in `MapView.tsx` (see the military-bases and airports layers). Unlike those, this layer's data isn't static — it depends on the current time and must be recomputed periodically while the map is mounted. There's no existing "periodic recompute" pattern in this codebase to reuse (the closest is `userLocation.ts`'s `startDishRotation`, which runs an animation loop via `requestAnimationFrame`, not a coarse interval).

## Goals / Non-Goals

**Goals:**
- Render the current solar terminator as a night-hemisphere overlay with a soft twilight gradient (not a hard day/night edge).
- Keep it live: recompute on an interval so the overlay visibly tracks the sun through the day and, over longer spans, the seasons.
- Toggleable, following the exact ref/state/`setXVisibility` pattern already used for military bases and airports.
- Correct-looking in both the light and dark base styles.

**Non-Goals:**
- No sunrise/sunset time lookups, no per-location "is it dark at X" API — purely a visual overlay.
- No per-pixel shader gradient (WebGL custom layer) — the gradient is achieved with a handful of stacked polygon bands, not a continuous shader blend.
- No timezone-aware "local time" display anywhere; all solar-position math is done in UTC, which is what the underlying astronomy requires regardless.

## Decisions

- **Solar position math: implement directly, no new dependency.** The subsolar declination/right-ascension and the terminator-latitude-per-longitude curve are standard, textbook astronomical formulas (the same ones behind every "day/night map" plugin, e.g. NOAA's solar position algorithm). Implementing them directly in a new `components/map/terminator.ts` (a few dozen lines, no external state, easily unit-testable as pure functions) avoids a new runtime dependency for what's ultimately ~30 lines of trigonometry.
  - Alternative considered: the `suncalc` npm package. Rejected — `deps: none` and tiny, but its npm registry metadata reports license `"Proprietary"` (its actual `LICENSE` file is BSD-2-Clause; this looks like a metadata omission by the author, not an actual license change, but it's not worth the ambiguity for math this small and standard). Revisit if the hand-rolled version turns out buggy in practice.
- **Terminator curve, not a buffered circle.** Compute the terminator as an explicit curve: for each longitude step from -180° to 180°, solve for the latitude at which the sun's elevation equals a given threshold angle (0° for the geometric terminator, negative angles for twilight — see next decision), using the standard `sin(elevation) = sin(lat)sin(δ) + cos(lat)cos(δ)cos(H)` relation solved for latitude given the subsolar declination `δ` and hour angle `H`. This is the same shape-generating approach used by established terminator-map plugins (e.g. Leaflet.Terminator), reimplemented here from the underlying formulas rather than copied from any specific project.
  - Alternative considered: `turf.circle` centered on the subsolar point with a ~90° geodesic radius (day/night boundary is a great circle 90° from the subsolar point). Rejected — turf's circle buffering is a polygon approximation that distorts badly at this scale (a quarter of Earth's circumference) and doesn't naturally extend to twilight bands (which aren't circles centered on the subsolar point in the same simple way) or handle the polar-day/polar-night edge cases the direct curve handles for free (the curve's latitude solution saturates/becomes undefined exactly where a pole is fully in that band, which is the correct boundary).
- **Twilight via stacked bands, not a shader gradient.** Generate the terminator curve at several solar-elevation thresholds (e.g. every 3° from a light dusk threshold down to -18°, the end of astronomical twilight — "full night" beyond that), each producing one filled polygon (the region at or below that elevation). Rendered as separate fill layers with the same base color and a small, cumulative opacity each, the overlap between bands reads as a smooth gradient from full daylight through dusk into full night — satisfying "shows twilight, not just a hard line" without a custom WebGL layer.
  - Alternative considered: 3 bands only, named after the canonical civil/nautical/astronomical twilight angles (-6°/-12°/-18°). Simpler, but visibly banded/steppy at typical zoom levels; more, smaller steps reads as smoother without materially more code (same curve function, just called more times with different thresholds).
- **Polygon construction per band.** For a given elevation threshold, the curve function returns one latitude per longitude (continuous across -180°→180°, no antimeridian handling needed since the ring is built by walking longitude in order — GeoJSON/MapLibre don't need dateline-splitting for a ring that simply spans the full range in one continuous sweep). Close the ring toward whichever pole is on the night side of that threshold (determined by the sign of the subsolar declination — the pole into which the current hemisphere's winter is tilted), so the filled area is the correct one even during the weeks around a solstice when an entire pole is inside a given band.
- **Live update via `setInterval`, not `requestAnimationFrame`.** The terminator moves ~0.25°/minute (360°/24h) — imperceptible over anything shorter than several minutes. A coarse interval (on the order of 1 minute) recomputing the bands and calling `source.setData(...)` is more than enough, unlike `userLocation.ts`'s per-frame rotation animation which needs to look like continuous motion.
- **Same color/opacity in both themes.** The night overlay represents something real (the actual Earth's night side), not a UI-theme-dependent accent — a consistent dark, semi-transparent fill (e.g. deep navy/black) reads correctly layered over both the light and dark base styles, the same way a real day/night map does regardless of who's looking at it. No `AIRPORT_FILL_COLOR`-style per-theme color split needed here.
- **Toggle defaults to visible**, matching the airports/military-bases precedent, and follows the identical ref + `useState` + `setXVisibility(map, visible)` + button wiring already established in `layers.ts`/`MapView.tsx`.

## Risks / Trade-offs

- [Hand-rolled solar-position math has more room for a subtle sign/quadrant error than a battle-tested library] → Mitigate with a couple of sanity-check unit tests on the pure calculation functions (e.g. subsolar latitude ≈ Earth's axial tilt at the solstices, ≈ 0° at the equinoxes; the terminator passes near local sunrise/sunset longitude for a known reference time) before wiring it into the map.
- [Recomputing and re-setting several polygon bands' GeoJSON on every interval tick could be needless CPU/GC churn if the interval is too aggressive] → A ~1-minute interval keeps this trivial (a few hundred trig calls per tick), far below any perceptible cost.
- [Stale interval/timer leaking across a theme swap (`setStyle` tears down layers) or component unmount, like the dish-rotation loop `MapView.tsx` already has to guard against] → Reuse the same guard pattern already in the codebase: track the interval handle in a ref, clear it on unmount, and re-add the source/layers (but not restart a duplicate interval) on `style.load`.
- [A single global opacity/color choice might read poorly against one of the two base styles at extreme zoom/lighting] → Flagged as an open question below rather than guessed at; cheap to tune post-implementation since it's just paint-property constants.

## Migration Plan

- No data migration. New, self-contained module (`components/map/terminator.ts`) plus the same small, established wiring additions to `layers.ts`/`MapView.tsx` used for every other toggleable layer. No feature flag — ships directly, opt-out via the new toggle.
- Rollback: revert the new module and the toggle wiring; no other layer or shared state is touched.

## Open Questions

None outstanding. Previously open, now confirmed by the user:
- Twilight band count/step and base color/opacity: **8 bands, 3° steps, dark navy ~55% max opacity** (tune visually during implementation, not pixel-specified here).
- Refresh interval: **60 seconds**.
- Hand-rolled solar-position math over `suncalc`: confirmed acceptable **as long as functionality is equivalent** (i.e. astronomically correct) — the sanity-check unit tests in tasks.md (1.3: declination ≈ 23.44° at solstice, ≈ 0° at equinox) exist specifically to verify that equivalence before this is wired into the map.

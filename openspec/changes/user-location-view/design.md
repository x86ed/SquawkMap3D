## Context

`map-view` (see `openspec/specs/map-view/spec.md`) already centers the map on the
user's geolocation once, at load, via `getCurrentLocation()`
(`components/map/geolocation.ts`) — a helper that **always resolves** (`null`
on denial/timeout/unsupported browser, coordinates otherwise) so callers never
need to handle a rejected promise. After that first `flyTo`, there is no way
to return to that location, no on-screen pan/tilt/zoom affordance, and no
persistent visual anchor there.

`components/map/layers.ts` already establishes the pattern this change
follows for adding map content that must survive a style swap: `addCustomLayers(map, ...)`
adds sources/layers idempotently (`if (!map.getSource/getLayer(...))`) and is
invoked from both `map.on("load", ...)` and `map.on("style.load", ...)` in
`MapView.tsx`, since MapLibre discards all custom sources/layers (and
`setTerrain`/`setSky`, per `components/map/terrain.ts`) on `setStyle`.

`@turf/turf` (`^7.4.0`) is already listed in `package.json` but currently
unused anywhere in the codebase — it was pulled in but never wired up. This
change is the first consumer.

## Goals / Non-Goals

**Goals:**
- Let the user jump back to their current location on demand, at any point
  after the initial load.
- Give the user on-screen pan/tilt/zoom controls without building custom UI.
- Render a persistent, glanceable 3D marker at the user's last-known location.
- Render 3 labeled, geodesically-accurate range rings (50/100/200 NM) around
  that location, so distances to landmarks on the horizon are estimable at a
  glance.
- Keep the same permission-denied/unavailable fallback semantics `map-view`
  already established: nothing breaks, nothing renders, the map stays fully
  interactive.

**Non-Goals:**
- No GLTF/three.js/external 3D model pipeline for the dish — `fill-extrusion`
  geometry only.
- No custom joystick/pan-tilt-zoom widget — MapLibre's built-in
  `NavigationControl`.
- No live-tracking "follow me" mode (MapLibre `GeolocateControl`'s
  `trackUserLocation`) — this is a one-shot "jump to where I am now," matching
  `getCurrentLocation()`'s one-shot semantics.
- No new npm dependency — `@turf/turf` is already installed, just previously
  unused.

## Decisions

### 1. Custom jump-to-location button (not `GeolocateControl`)

Use a plain button in the existing `styles.controls` stack (`MapView.tsx`),
wired to the existing `getCurrentLocation()` helper — the same pattern already
used for theme/pilot-mode/military-bases toggles — rather than MapLibre's
built-in `GeolocateControl`.

**Why:** `GeolocateControl` owns its own geolocation call, permission-error
handling, and `trackUserLocation` state machine, which would create a second,
parallel geolocation code path alongside `getCurrentLocation()` (whose
"always resolves, never rejects" contract the rest of `map-view` already
relies on). It also draws its own animated dot/accuracy-circle marker at the
user's position by default — which would visually double up with this
change's own dish marker at the same spot. A plain button that calls
`getCurrentLocation()` and `flyTo`s on success (no-ops on `null`, exactly like
the initial-load effect already does) reuses tested code, keeps one
geolocation code path, and avoids the marker collision. It costs a few lines
of glue instead of a config object, which is an acceptable trade for
consistency.

**Alternative considered:** `GeolocateControl` with `showUserLocation: false`
to suppress its own dot. Rejected — it still runs a second, independent
`navigator.geolocation` invocation with its own timeout/error semantics
diverging from `getCurrentLocation()`, and the codebase has no other MapLibre
`IControl` custom UI besides `NavigationControl`, so a button is the more
idiomatic fit here.

### 2. `NavigationControl`, mounted top-left

`map.addControl(new NavigationControl({ showZoom: true, showCompass: true, visualizePitch: true }), "top-left")`.
Built-in, no custom UI, matches the proposal directly. Mounted top-left
specifically to avoid overlapping the existing custom button stack, which is
absolutely positioned at `top: 12px; right: 12px` (`MapView.module.css`
`.controls`) — MapLibre's own control container is a separate positioning
system from that div, and both would default to the top-right corner if left
unconfigured.

### 3. Dish geometry: stacked, meters-accurate `fill-extrusion` prisms

A single `fill-extrusion` feature cannot literally taper to a cone/dish silhouette — the geometry
is a constant-footprint prism from `fill-extrusion-base` to `fill-extrusion-height`. To read as a
small dish/tower rather than a plain block, the marker is 3 stacked octagon-footprint features at
the same center, each shrinking in radius and rising in base/height, forming a stepped, tapering
silhouette:

| tier | radius (m) | base (m) | height (m) |
|------|-----------|----------|------------|
| 1 (bottom) | 12 | 0  | 8  |
| 2 (middle) | 7  | 8  | 14 |
| 3 (top)    | 3  | 14 | 18 |

Footprints are computed with `turf.circle([lon, lat], radiusMeters, { steps: 8, units: "meters" })`
(an 8-sided polygon, cheap and visually adequate at marker scale) around the user's coordinates —
i.e. **meters-accurate**, not a fixed degree-offset square. This matters because a fixed-degree
offset would visibly distort (stretch east-west) at high latitudes, and because the same helper
is reused for the range rings below, so one geodesic-math utility (turf) covers both features
rather than hand-rolling degree math twice.

**Alternative considered:** a single flat-topped extrusion (simplest possible "block" marker).
Rejected — reads as a generic building, not remotely dish-like, and the proposal explicitly asks
for a dish/cone-*resembling* shape.

**Alternative considered:** hand-rolled circle-point generation (`for` loop computing
`lat + r*cos(θ)/111320`-style offsets) instead of turf. Rejected now that turf is confirmed
already an installed (if previously unused) dependency — reimplementing geodesic circle math by
hand only to avoid "adding" a dependency that's already in `package.json` isn't a real savings,
and turf's `circle`/`destination` are better-tested than a hand-rolled version.

### 4. Range rings: turf geodesic circles + turf `destination` for labels

Each of the 3 rings is generated with
`turf.circle([lon, lat], radiusNM * METERS_PER_NM, { steps: 128, units: "meters" })`, rendered as
a `line` layer (not `fill`) so it reads as a ring outline, not a disc. `METERS_PER_NM = 1852`
(exact) is added to `components/map/constants.ts` alongside a
`RANGE_RING_RADII_NM = [50, 100, 200]` constant.

Each ring's label is a single point placed at the ring's north point —
`turf.destination([lon, lat], radiusNM, 0 /* bearing: due north */, { units: "nauticalmiles" })`
— rendered via a `symbol` layer with `text-field: ["get", "label"]` (e.g. `"50 NM"`), so the label
sits directly on the ring at its top, readable regardless of map bearing changes (it's map-plane
text, not fixed to the compass).

All 3 rings + labels are backed by one `GeoJSON` `FeatureCollection` source (3 `LineString`
features for the rings, 3 `Point` features for the labels) rather than 6 separate sources, mirroring
`layers.ts`'s pattern of one source per logical feature set (e.g. `MILITARY_SOURCE_ID` backs both
the fill and line layers).

**Alternative considered:** rendering rings as `fill-extrusion` walls (vertical "fence" cylinders)
for more 3D presence. Rejected — the proposal specifies rings, and a flat geodesic `line` ring is
the direct, unambiguous reading of "range ring" (compare: sectional chart rings), consistent with
existing 2D `line`/`circle` layers in `layers.ts`.

### 5. New module: `components/map/userLocation.ts`

New file, not an extension of `layers.ts`. `layers.ts`'s `addCustomLayers` sources are static
(remote/`public/data/*.geojson` URLs, theme-driven paint only) and unconditionally present from
first load. This change's sources are dynamic — their GeoJSON content is *computed* from a
runtime coordinate that may not exist yet (before geolocation resolves) — and conditionally
present (no-op entirely if location is never known). Keeping the turf-based geometry generation
and the conditional add/update/remove lifecycle in its own module keeps `layers.ts` focused on
static, always-on layers, and keeps this feature's geodesic-math code independently readable and
(if ever needed) testable in isolation.

`userLocation.ts` exports:
- `buildUserLocationFeatures(coords: GeoCoords): { dish: FeatureCollection; rings: FeatureCollection }`
  — pure function, no map dependency, computes the turf geometry described above.
- `addUserLocationLayers(map: MapLibreMap, coords: GeoCoords | null): void` — no-ops if
  `coords` is `null`; otherwise idempotently adds (`if (!map.getSource/getLayer(...))`) the dish
  and ring/label sources+layers, mirroring `addCustomLayers`'s idempotency, and (if the sources
  already exist — e.g. re-invoked after a `flyTo` from the jump-to-location button with a new
  coordinate) updates their data via `map.getSource(id).setData(...)` instead of re-adding.

### 6. State placement: `userLocationRef` in `MapView.tsx`

The last-known user coordinates live in a `useRef<GeoCoords | null>(null)` in `MapView.tsx`
(`userLocationRef`), following the existing pattern for `themeRef`/`pilotModeRef`/`militaryVisibleRef`
— i.e. imperative state that must be read inside the `style.load` handler (a closure that must
see the *current* value, not a stale one from when the effect first ran) without forcing a React
re-render on every geolocation resolution. No new React `useState` is introduced for this: nothing
in the JSX needs to reactively change based on the coordinate value itself (unlike `theme`, which
drives button label text).

Both the initial-load `getCurrentLocation().then(...)` effect and the new jump-to-location
button's click handler funnel through one local helper (`handleLocationResolved(coords)`) that:
sets `userLocationRef.current = coords`, and (if `coords` is non-null and `mapRef.current` exists)
calls `addUserLocationLayers(mapRef.current, coords)`. The existing `setupStyleDependentState`
function (already invoked on both `"load"` and `"style.load"`) additionally calls
`addUserLocationLayers(map, userLocationRef.current)` so the dish/rings survive a theme swap
exactly like `addCustomLayers`'s sources do (no-op if the ref is still `null`, i.e. location was
never resolved).

## Risks / Trade-offs

- **Turf bundle size** → `@turf/turf` is a large umbrella package, but it's already a declared
  dependency (installed, just unused), so this change adds no new install weight; if bundle size
  ever becomes a concern, a future change could switch to the scoped `@turf/circle` +
  `@turf/destination` packages instead of the `@turf/turf` umbrella import.
- **8-sided dish footprints look faceted at close zoom** → acceptable per proposal ("simple 3D...
  no external 3D model pipeline"); can be bumped to 16 steps later at negligible cost if it reads
  too blocky in practice.
- **Ring `line` layers can visually clutter dense areas at low zoom (e.g. 200 NM ring spanning
  multiple states)** → out of scope to address now (no zoom-based fade/declutter requested by
  proposal); flagged as a candidate follow-up, not blocking.
- **`GeolocateControl` not used → losing its native "locating..." spinner/permission-prompt UX
  affordance** → mitigated by the jump-to-location button showing no special loading state either
  (matches the existing initial-load behavior, which also has no loading indicator today); not a
  regression relative to current UX.

## Migration Plan

No migration — purely additive UI/rendering, no data model or existing-behavior changes. Nothing
to roll back beyond removing the new module/control mounts if reverted.

## Open Questions

None outstanding — dependency (turf), geometry approach, state placement, and file layout are
resolved above.

## Addendum: post-implementation fixes (scale mismatch + load race)

Two defects surfaced during manual verification, after the original implementation above was
already built and passing typecheck/lint/build. Both are fixed; documented here since they revise
decisions made above.

**1. Dish/ring visibility at the zoom `flyTo`/`fitBounds` lands on.** The original dish tiers (12m/7m/3m
radius) and the fixed `GEOLOCATION_ZOOM = 11` `flyTo` (decision 2/6 area) combined to make *both*
new features invisible in practice: at z11 the dish is sub-pixel, and the 50 NM ring (92.6km radius)
is far larger than what fits in view at that zoom. Fixed by:
- Scaling `DISH_TIERS` up roughly 40–50x (now 600m/350m/150m radius, up to 900m tall) — a deliberate
  stylized, non-literal scale, since a literally-scaled dish is unachievable-small at any zoom wide
  enough to show even the nearest range ring.
- Replacing the fixed-zoom `flyTo({zoom: GEOLOCATION_ZOOM})` calls (both the initial-load effect and
  `handleJumpToLocation`) with `map.fitBounds(getUserLocationBounds(coords), {padding: 40})`, a new
  `userLocation.ts` export that computes the outermost (200 NM) ring's bbox via `turf.bbox`. This is
  viewport-aware (correct regardless of window aspect ratio) where a hardcoded zoom wasn't.
  `GEOLOCATION_ZOOM` is now unused and was removed from `constants.ts`.
- Net effect: on arrival, all 3 labeled rings are immediately visible; the dish is present but reads
  as a small marker next to them (visible up close, not at the ring-fit zoom) — consistent with the
  dish being a "you are here" detail rather than the primary at-a-glance feature.

**2. `addSource`/`addLayer` thrown before the style is ready.** `getCurrentLocation()` can resolve
(especially with a cached/fast position) before the map's first `"load"`/`"style.load"` has run,
and MapLibre throws `Error: Style is not done loading.` if `addSource` is called before that. This
was an unhandled promise rejection (silent in production — no dish/rings, no visible error) hit via
manual testing. Fixed with a `styleReadyRef` (set `true` inside `setupStyleDependentState`, reset to
`false` right before `setStyle()` in `handleThemeToggle` since a style swap re-opens the same
window): `handleLocationResolved` only calls `addUserLocationLayers` directly when
`styleReadyRef.current` is true; otherwise it relies on `userLocationRef.current` already being set,
so the next `"load"`/`"style.load"` firing (which always calls `addUserLocationLayers` from
`setupStyleDependentState`) picks it up. `map.isStyleLoaded()` was tried first and rejected — it
reflects whether every currently-visible tile has finished loading (a much stricter, frequently-false
condition), not just whether the initial style parse completed, so it produced false negatives long
after the map was otherwise safe to add sources to.

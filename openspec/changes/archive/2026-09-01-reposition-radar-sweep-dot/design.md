## Context

Two independent, small fixes bundled into one change (per the originating issue's acceptance criteria):

1. **Radar-sweep dot/label altitude.** `components/map/radarSweep.ts`'s `buildRangeOutlineSweepLayers()` builds a `ScatterplotLayer` (`RANGE_OUTLINE_AIRCRAFT_DOT_LAYER_ID`) and a `TextLayer` (`RANGE_OUTLINE_AIRCRAFT_LABEL_LAYER_ID`) for every currently-tracked aircraft, both positioned via `getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)]` — the same real-altitude elevation the separate, always-on aircraft-icons layer (`aircraftLayer.ts`'s `IconLayer`) uses, deliberately reused per `actual-range-outline`'s design.md Decision 6 ("so a dot sits at the same 3D point in the pitched/terrain scene as that aircraft's own icon"). In practice, at this app's default steep pitch (`INITIAL_PITCH = 60`, up to `MAX_PITCH = 85`), a dot/label floating at cruise altitude (tens of thousands of feet, scaled by `TERRAIN_EXAGGERATION = 3`) renders far above the ground track it's meant to represent, which doesn't read as a "radar blip" the way a real ATC/marine radar scope does (contacts always painted at the scope's own flat plane, independent of the target's real altitude). The fix is narrowly scoped to these two layers — the sweep wedge (`SolidPolygonLayer`, already ground-level) and the separate aircraft-icons layer (`aircraftLayer.ts`, unaffected) keep their existing altitude handling.

2. **Initial-load zoom.** `components/map/MapView.tsx` constructs the MapLibre `Map` with `center: DEFAULT_VIEW.center` / `zoom: DEFAULT_VIEW.zoom` (`components/map/constants.ts`: continental-US center, zoom `4` — a whole-country view). Once `resolveUserLocation()` resolves (in the map-init effect, right after `map.on("click", ...)` wiring, around `MapView.tsx` line 832), the map calls `mapRef.current.fitBounds(getUserLocationBounds(coords), { padding: 40 })` — `getUserLocationBounds()` (`components/map/userLocation.ts`) sizes its bounding box to the **outermost** `RANGE_RING_RADII_NM` entry (`200` NM), so even the "successful geolocation" first-load view ends up showing a ~400 NM-wide box, not a locally-useful view. Neither of these two zoom levels is what a user wants to see first: the acceptance criterion asks for a consistent ~60 NM view around the map's center on first load, regardless of whether geolocation succeeds.

`getUserLocationBounds()` is also called from two other, deliberately-unchanged places: the satellite-icon click handler (`MapView.tsx` ~line 771, "center on my already-known location") and `handleJumpToLocation` (~line 1112, the "jump to my location" control, spec'd in `user-location-marker`'s "Jump to current location" requirement). Both are explicit user-initiated re-center actions, not part of "first load," and this change leaves their existing ~200 NM framing alone.

## Goals / Non-Goals

**Goals:**
- Move the radar-sweep aircraft dot and hex label to the ground plane (elevation 0), independent of the aircraft's real altitude.
- Make the map's first-load view — whether or not geolocation resolves — show approximately 60 NM around the map's center, replacing both the current zoom-4 continental fallback and the current ~200 NM post-geolocation `fitBounds`.

**Non-Goals:**
- Changing the separate aircraft-icons layer's (`aircraftLayer.ts`) altitude-based positioning, glow, or track rendering — those stay exactly as they are; only the radar-sweep's own dot/label copy moves.
- Changing the sweep wedge's own geometry/behavior (`buildWedgeSlices`) — it is already ground-plane (real lng/lat with no altitude component).
- Changing `handleJumpToLocation`'s or the satellite-icon click handler's zoom/framing behavior — both keep their existing ~200 NM (`getUserLocationBounds()`) framing; only the first-load path changes.
- Changing the range rings themselves (`RANGE_RING_RADII_NM = [50, 100, 150, 200]`) — those remain 4 rings at their existing radii; only how far the *camera* is zoomed out on first load changes.
- A user-facing "default zoom" setting/control — this is a fixed constant, consistent with how every other layout constant in `constants.ts` is fixed, not user-configurable.

## Decisions

### 1. Dot/label position: hardcode elevation to `0`
In `radarSweep.ts`'s `dotLayer`/`labelLayer`, change `getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)]` to `getPosition: (d) => [d.lon, d.lat, 0]`. No new helper needed — `altitudeToRenderMeters` (exported from `aircraftLayer.ts`) is simply no longer called from these two layers; the `PositionedAircraft` type and `isFlashing`/color/radius logic are untouched.
- **Alternative considered**: keep altitude-based positioning but flatten only visually (e.g. render at a fixed small height above ground). Rejected — "ground plane" per the acceptance criteria means elevation 0, not a stylized near-ground offset; `0` is simplest and matches the wedge's own existing elevation.
- **Alternative considered**: add a dropline from the ground dot up to the aircraft's real altitude (mirroring `aircraftLayer.ts`'s existing track droplines). Rejected — out of scope for this fix; the acceptance criteria asks for the dot/label to move, not for a new visual element, and the sweep overlay has no equivalent of the track-layer's per-point altitude context to anchor a dropline to.

### 2. Initial zoom: a reusable radius-to-bounds helper, applied only to the first-load path
Generalize `userLocation.ts`'s `getUserLocationBounds(coords)` (currently hardcoded to the outermost `RANGE_RING_RADII_NM` value) by extracting its radius-to-bbox math into a new exported helper, e.g. `getBoundsForRadiusNM(center: [number, number], radiusNM: number): [[number, number], [number, number]]`, with `getUserLocationBounds()` becoming a one-line wrapper calling `getBoundsForRadiusNM([coords.longitude, coords.latitude], Math.max(...RANGE_RING_RADII_NM))` — preserving its exact current behavior and all three of its existing call sites unchanged.

Add `INITIAL_ZOOM_RADIUS_NM = 60` to `constants.ts`, near `RANGE_RING_RADII_NM`.

Apply the new helper in exactly two places in `MapView.tsx`:
- **Map construction**: replace the `center`/`zoom` constructor options with a `bounds`/`fitBoundsOptions` pair (MapLibre's `MapOptions` supports `bounds` as a constructor-time alternative to `center`+`zoom`), computed as `getBoundsForRadiusNM(DEFAULT_VIEW.center, INITIAL_ZOOM_RADIUS_NM)`. This gives the transient pre-geolocation view (and the permanent fallback view if geolocation is denied/unavailable/times out) a ~60 NM span around the continental-US default center, instead of the current fixed `zoom: 4`.
- **Post-geolocation first-load `fitBounds`** (the `resolveUserLocation().then(...)` block right after map construction, ~line 832-838): replace `getUserLocationBounds(coords)` with `getBoundsForRadiusNM([coords.longitude, coords.latitude], INITIAL_ZOOM_RADIUS_NM)`, keeping the same `{ padding: 40 }` option.

`handleJumpToLocation` (~line 1112) and the satellite-icon click handler (~line 771) keep calling `getUserLocationBounds(coords)` unchanged (still ~200 NM), per this design's Non-Goals.

- **Alternative considered**: compute a single static `zoom` number (via a Web Mercator zoom-from-radius formula) instead of using MapLibre's `bounds` constructor option. Rejected — a fixed zoom number is latitude-dependent (a degree of longitude covers less real-world distance at higher latitudes), so a single hardcoded zoom would only be accurate at one latitude; `fitBounds`/`bounds` (a lng/lat bounding box) is exact everywhere and reuses the exact same technique this file already established for the range-ring-based views.
- **Alternative considered**: change `getUserLocationBounds()` itself to take a radius parameter and update all 3 of its call sites to pass `60`. Rejected — would also shrink the deliberately-wider "jump to my location" and "click satellite icon" recenter views, which the acceptance criteria doesn't ask to change and which arguably benefit from showing the full range-ring context (that's the point of those two actions, unlike first load).
- **Alternative considered**: leave the map constructor's `zoom: 4` alone and only fix the post-geolocation path. Rejected — the acceptance criterion says "when the map first loads," and the constructor's `zoom: 4` is also the map's *only* view whenever geolocation is denied/unavailable/times out (the `map-view` spec's existing "Geolocation permission denied" fallback scenario), so leaving it unchanged would mean the 60 NM default doesn't apply in that (common, e.g. running headless/CI or a browser without geolocation) case.

## Risks / Trade-offs

- **[Risk] `actual-range-outline-layer`'s canonical spec hasn't been archived into `openspec/specs/` yet** — its change folder (`openspec/changes/actual-range-outline/`) is still pending archive even though its code is already merged to `main` (confirmed via `git log main -- components/map/radarSweep.ts`). This change's own delta spec (`specs/actual-range-outline-layer/spec.md`) is written as a `MODIFIED Requirements` block against that not-yet-archived capability. → *Mitigation*: none needed for the code fix itself (it targets real, already-merged code), but archiving this change cleanly requires `actual-range-outline` to archive first (or the two to be reconciled together) so the "Tracked aircraft shown as hex-labeled dots on the sweep" requirement this change modifies actually exists in `openspec/specs/` first. Flagged here for whoever runs `/opsx:archive` on this change.
- **[Trade-off] `bounds` as a MapLibre constructor option vs. `center`+`zoom`**: functionally equivalent to constructing with `center`/`zoom` then immediately calling `fitBounds` on `"load"`, but avoids an extra visible pan/zoom jump on every first paint. No behavioral risk — `bounds` is a standard, documented `MapOptions` field (`maplibre-gl.d.ts`).
- **[Trade-off] Ground-plane dots lose their "same 3D point as the aircraft icon" property** that `actual-range-outline`'s original design deliberately chose (Decision 6 there). This is the explicit intent of this change (acceptance criteria), not an oversight — call this out in `radarSweep.ts`'s comments so it isn't "corrected" back toward altitude-matching later without re-reading this change's rationale.

## Migration Plan

Purely additive/corrective — no new files, no new dependencies, no data model changes. Both fixes are small, local edits to existing functions (`buildRangeOutlineSweepLayers()`'s `getPosition` callbacks; the map-init effect's constructor options and first-load `fitBounds` call) plus one small extraction (`getBoundsForRadiusNM()` out of `getUserLocationBounds()`, preserving its existing behavior/signature at all 3 of its current call sites). Rollback is reverting these edits; nothing else depends on the new elevation value or the new helper's existence.

## Open Questions

- None — both fixes are narrowly scoped, single-file-plus-one-shared-helper changes with no external dependencies or ambiguous requirements.

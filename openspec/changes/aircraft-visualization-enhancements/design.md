## Context

The aircraft layer (`components/map/aircraftLayer.ts`, `aircraftIcons.ts`, `aircraftRarity.ts`, `aircraftShapes.ts`) currently renders every aircraft as a single deck.gl `IconLayer` tinted by a fixed altitude-only color ramp, with a track `PathLayer` sharing the same ramp, plus a selection glow. Icon selection/click state, camera-follow, and the `AircraftOverlay` drawer (`components/map/overlay/AircraftOverlay.tsx`) already exist and are out of scope to restructure. This change reworks the icon layer's color model, altitude positioning, camera-responsive tilt, rotorcraft animation, hit-testing, and hover affordance — all still 2D/2.5D — as groundwork before a later, separate change adds true 3D aircraft meshes (per the proposal's framing: "prior to adding in the 3d").

Two reference images from the request were fetched and inspected directly:
- The altitude color legend is a single continuous gradient bar with labeled stops at 0 / 500 / 1,000 / 2,000 / 4,000 / 6,000 / 8,000 / 10,000 / 20,000 / 30,000 / 40,000+ ft, running orange → yellow → green → cyan → blue → magenta (a tar1090-style "color by altitude" ramp), not the app's current 2-stop cyan→gold ramp.
- The hover tooltip is a small dark rounded-rect popup, two lines: `{callsign} · {type}` bold on line one, `{altitude} ft · {speed} kt` on line two.

## Goals / Non-Goals

**Goals:**
- Three switchable icon/track color modes (rarity, altitude, airspeed) with a matching bottom-left legend and 2-button control, docked to the `AircraftOverlay` drawer.
- Aircraft altitude position visually consistent with the map's existing 3x terrain exaggeration.
- A camera-pitch-responsive tilt cue on icons, animated rotor blades for rotorcraft, a larger click/hit target, and a hover tooltip.

**Non-Goals:**
- True 3D aircraft meshes/models (explicitly deferred to a follow-up change).
- Changing the feeder data contract (`aircraft.ts`) — every mode/feature derives from fields already on `Aircraft`.
- Redesigning `AircraftOverlay`/`PlaneCard` internals — this change only makes the new control+legend dock to the drawer's existing open/close state.

## Decisions

### Decision 1: Color-mode state lives in `MapView`, resolution logic lives in `aircraftIcons.ts`
A new `colorMode: "rarity" | "altitude" | "airspeed"` state (default `"altitude"`, closest to current behavior) is added alongside `MapView`'s existing selection/visibility state, passed into `buildAircraftLayers`. A single `resolveAircraftColor(aircraft, mode)` function in `aircraftIcons.ts` dispatches to `rarityToColor` (new, wraps `RARITY_TIER_STYLES.color` — reused, not duplicated), `altitudeToColor` (rewritten, see Decision 2), or `airspeedToColor` (new, see Decision 3). `aircraftLayer.ts`'s `IconLayer.getColor`/track `getColor` call this instead of hardcoding `altitudeToColor`.

### Decision 2: Altitude ramp is rewritten to match the reference gradient's exact stops
`ALTITUDE_COLOR_LOW`/`ALTITUDE_COLOR_HIGH` (a flat 2-color lerp) are replaced with a multi-stop gradient function using fixed `[ft, rgb]` control points at 0/500/1,000/2,000/4,000/6,000/8,000/10,000/20,000/30,000/40,000ft (orange → yellow → green → cyan → blue → magenta, sampled from the reference image), linearly interpolated between adjacent stops and clamped beyond 40,000ft. This is a **BREAKING** visual change to the current default aircraft tint — acceptable since altitude was already the default color and is now one of three equally-weighted modes, not a regression. The same stop table drives the altitude legend bar's CSS gradient, so the legend and live icon colors can't drift apart.

### Decision 3: Airspeed color uses fixed knot thresholds; Mach 1 is approximated
`airspeedToColor(groundSpeedKt)` buckets: grey (stopped/undefined), green <100kt, yellow 100-200kt, orange 200-400kt, red 400-500kt, magenta >500kt, hot pink above a `MACH1_APPROX_KTS` constant (~660kt, sea-level speed of sound). True Mach depends on true airspeed, altitude, and outside air temperature, none of which the feeder provides (only ADS-B ground speed) — this is a documented simplification, not a physically exact Mach computation. Legend renders as a speedometer-style horizontal gradient bar with the same stops, matching the acceptance criteria's "look like a speedometer in the scale" ask via a rounded, tick-marked gradient rather than a literal gauge widget (simpler, consistent with the altitude/rarity legend bars).

### Decision 4: Rarity mode reuses `RARITY_TIER_STYLES`, legend reuses `PlaneCard`'s 9-tier styling
No new rarity color table — `aircraftRarity.ts`'s existing `RARITY_TIER_STYLES`/`computeRarityTier` are the single source of truth for both the icon tint and the legend's 9 tier cards, keeping the map layer and `PlaneCard` visually identical for the same aircraft.

### Decision 5: Control + legend dock to the drawer via CSS state, not JS geometry
The new bottom-left control/legend group's CSS reads the same open/closed signal `AircraftOverlay.module.css`'s `.drawer[data-open]` already exposes (a sibling `data-open` attribute or a shared CSS custom property set by `MapView.tsx`), and repositions/animates via a CSS transform keyed off it — matching the codebase's existing pattern of state-driven CSS attributes rather than introducing a second `ResizeObserver`-based measurement path.

### Decision 6: Terrain-exaggeration-aware altitude — full uniform scaling, not ground-relative-only
`aircraftLayer.ts`'s `getPosition` (icon layer, glow layer, and track `PathLayer`) and `radarSweep.ts`'s aircraft dots multiply their altitude-derived z term by `TERRAIN_EXAGGERATION` (already `3` in `constants.ts`), i.e. `altitude * FEET_TO_METERS * TERRAIN_EXAGGERATION`, so aircraft height reads consistently against the equally-stretched terrain mesh. Considered exaggerating only the ground-elevation component (leaving above-ground-level clearance unscaled, which is arguably more physically "correct" since only the terrain mesh itself is exaggerated) but rejected as more complexity than the acceptance criterion ("match terrain exaggeration with plane altitude") asks for; revisit if high-altitude cruise traffic reads as visually wrong (e.g., appearing implausibly high above flat terrain) once implemented.

### Decision 7: Camera-pitch tilt is a foreshortening approximation, not a 3D mesh
True per-aircraft 3D body tilt needs mesh geometry, which is explicitly out of scope (deferred to the follow-up 3D-aircraft-models change). Instead, the icon's `IconLayer` is drawn with `billboard: false` (lies flat in the aircraft's local ground plane, already rotated by `getAngle`/track) and a per-instance non-uniform scale along the track axis derived from `map.getPitch()` — read from the map's `pitch`/`rotate` events (not per aircraft poll) — approximating a "leaning into the camera" cue without true 3D rotation. Alternative considered: a `SimpleMeshLayer`-based quad with a real rotation matrix — rejected for now as unnecessary complexity ahead of the real 3D work, but the billboard-false + track-angle groundwork this requires is shared with that follow-up.

### Decision 8: Rotorcraft rotor blades render via a real inline-SVG `Marker`, not the icon atlas
The deck.gl icon atlas (`aircraftIcons.ts`) is a canvas rasterized once at layer-mount time — it cannot animate a sub-element. For ADS-B category `A7` (rotorcraft) aircraft only, a MapLibre `Marker` (already imported from `maplibre-gl` elsewhere in this codebase) renders the vendored top-view SVG shape (`aircraftShapes.ts`, same source `PlaneCard` uses) as live DOM/SVG, with the rotor-disc path/group carrying a CSS `@keyframes spin` animation — pure CSS, no per-frame JS cost. The marker's position/rotation is synced on the existing ~1s aircraft poll (`refreshAircraft`), same cadence as everything else; the spin itself runs independently via CSS regardless of poll timing. Alternatives rejected: re-rastering the atlas cell per frame (breaks the atlas's build-once design, expensive) and a second deck.gl layer with a JS-driven rotation angle (reintroduces a `requestAnimationFrame` loop the CSS approach avoids, mirroring the existing `radarSweep.ts` loop unnecessarily).

### Decision 9: Clickability via deck.gl's built-in `pickingRadius`, not a synthetic hit layer
The `MapboxOverlay`/`Deck` instance's `pickingRadius` (pixels) is bumped from its default (0) to a value comfortably larger than small/distant icons, giving every aircraft a bigger effective click radius with no new layer. This is deck.gl's own built-in mechanism for exactly this problem. Fallback considered — a second, larger, fully transparent `ScatterplotLayer` purely for picking — noted as a follow-up if `pickingRadius` alone proves ambiguous in dense traffic (overlapping aircraft), but not implemented up front to keep the change minimal.

### Decision 10: Hover tooltip via `IconLayer.onHover`, matching the captured reference exactly
A new `onHover` handler (parallel to the existing `onClick`) drives a small piece of React state (hovered aircraft or `null`) in `MapView.tsx`, rendered as a lightweight, absolutely-positioned tooltip (not reusing `AircraftOverlay` — that stays click-to-select-only) near the cursor: bold `{callsign ?? registration} · {typeDesignator}` on line one, `{altitude} ft · {groundSpeed} kt` on line two, styled as a small dark rounded-rect matching the captured reference image. State updates only on hovered-object identity change (not every pixel of pointer movement) to avoid excessive re-renders.

## Risks / Trade-offs

- [Foreshortening pitch cue isn't true 3D rotation] → Acceptable, explicitly scoped as a stand-in ahead of the separate 3D-aircraft-models change; documented in code as an intentional limitation.
- [Airspeed's Mach-1 threshold is a fixed-knots approximation, not true Mach] → Documented simplification; the feeder never exposes true airspeed/OAT needed for a real Mach computation.
- [Altitude gradient stops are hand-sampled from a reference image, not colorimetrically derived] → A close visual match is what was asked for; stops are pinned constants (like the existing rarity octile thresholds), not recomputed.
- [Rotor-blade `Marker` DOM layer adds a second aircraft-rendering path alongside the deck.gl atlas] → Scoped to category `A7` only (a small fraction of most feeds), keeping DOM node count low; animation itself is CSS-only, no added per-frame JS cost.
- [`pickingRadius` increase can create pick ambiguity when aircraft icons overlap in dense traffic] → deck.gl resolves overlapping picks to the nearest hit under the cursor; acceptable at this app's single-feeder traffic density, revisit with a dedicated hit layer if it proves confusing in practice.
- [New bottom-left control/legend group could collide with other UI at narrow viewports] → Follow `AircraftOverlay`'s existing responsive stacking pattern rather than inventing a new one.

## Migration Plan

Purely additive UI/rendering change with no data migration and no feeder contract change. Default color mode is `"altitude"` (closest to current behavior), so existing users see the same default coloring scheme (with the corrected gradient from Decision 2) until they explicitly switch modes. No feature flag — ships as a normal PR; rollback is a plain revert.

## Open Questions

- The proposal's "arrow icon and recenter the view" gang-box button doesn't pin down its recenter target. Defaulting to the existing `handleJumpToLocation` behavior (recenter to the feeder/browser-resolved location, same as the current "My location" control) as the closest existing analog — confirm during implementation if a different target (e.g., `DEFAULT_VIEW`, or the currently-selected aircraft) is actually intended.
- Whether `pickingRadius` alone resolves clickability sufficiently, or a secondary hit-testing layer (Decision 9's fallback) is also needed, is left to be settled by testing against real traffic during implementation.

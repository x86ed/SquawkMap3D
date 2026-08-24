## Context

`components/map/userLocation.ts` currently anchors the user's location with a 3D `fill-extrusion` "radar mast": an octagon pedestal plus a long rotating blade, animated every 80ms via `requestAnimationFrame` (`startDishRotation`, wired into `MapView.tsx`). It's deliberately oversized (see the file's own "Marker scale vs. ring scale" note) purely so a real-world-scaled mast doesn't vanish at the zoom level the map lands on. The range rings drawn around it use a fixed blue, `#00b8db` (`RING_LINE_COLOR` in `constants.ts`), which the mast doesn't match (`#e6e6e6` pedestal, `#00b8db` blade).

The codebase already has a working pattern for a themed, single-color SVG marker rendered as a MapLibre symbol icon: `airportIcon.ts` inlines an SVG, rasterizes it to a canvas, recolors it via `source-in` compositing, and registers it with `map.addImage` through a `missingStyleImageResolver` (required so the tile worker's icon-dependency resolution doesn't race a bare `addImage` call and permanently miss the image in an already-built symbol bucket).

Every other layer-visibility toggle in `MapView.tsx` follows the same shape: a `useState` boolean + a parallel `useRef` (so map event callbacks read the current value without stale closures), a `handleXToggle` function that flips both and calls a `setXVisibility(map, next)` helper, and a button in the `.controls` panel.

## Goals / Non-Goals

**Goals:**
- Replace the rotating 3D mast with a static `sat.svg` icon, colored to match the range rings.
- Add one combined toggle that hides/shows the icon and all 4 range rings + labels together.
- Remove the now-dead rotation/geometry code cleanly rather than leaving it disabled.

**Non-Goals:**
- No change to how/when the user's location is resolved (`geolocation.ts`, the existing "jump to my location" button, and initial-load centering are untouched — that capability already exists).
- No per-theme icon coloring — the icon uses one fixed color (`RING_LINE_COLOR`), independent of light/dark theme, matching the rings' own theme-independent color.
- No separate toggles for the icon vs. the rings — the acceptance criteria asks for one combined layer toggle.

## Decisions

**1. Symbol layer + static icon, not fill-extrusion.** A `symbol` layer's `icon-size` is constant in screen pixels at any zoom, so the marker stays visible without needing the mast's exaggerated real-world scale hack. This drops `PEDESTAL_TIER`/`BLADE_TIER`, `buildDishPedestal`/`buildDishBlade`, and their scale-justification comment entirely.

**2. Reuse `airportIcon.ts`'s rasterize-and-cache pattern, simplified to one fixed color.** New module `components/map/userLocationIcon.ts` mirrors `registerAirportIcon`/`registerAirportIconResolver`, but drops the per-theme `Record<MapTheme, string>` param — the icon has exactly one color (`RING_LINE_COLOR`), not light/dark variants. Same `missingStyleImageResolver` registration on `load`/`style.load` for the same tile-worker race reason documented in `airportIcon.ts`.

**3. `sat.svg` lives at `public/sat.svg`, loaded by URL (not inlined markup).** `airportIcon.ts` inlines its SVG because it lives under `app/` (not statically served); a new asset has no such constraint, so it goes in `public/` like the aircraft silhouettes and is fetched via `new Image(); img.src = "/sat.svg"` (same technique `aircraftIcons.ts`'s `loadImage` already uses for public-served SVGs) rather than the Blob-URL trick `airportIcon.ts` needs for inline markup.

**4. Recolor via canvas `source-in`, not MapLibre SDF icon-color.** `airportIcon.ts` already solved recoloring this way and also had to solidify enclosed holes in the source glyph's path; a hand-authored `sat.svg` can be drawn as a single non-overlapping silhouette so the hole-solidifying step isn't needed, but the same `drawImage` + `globalCompositeOperation = "source-in"` + `fillStyle` recolor is reused for consistency with the existing pattern (and because true SDF generation isn't a solved primitive already in this codebase).

**5. One shared visibility toggle for icon + rings.** The dish/icon layer and the two ring layers (line + label) already live in the same `addUserLocationLayers` call. A single `setUserLocationVisibility(map, visible)` helper sets `visibility` (`"visible"`/`"none"`) on all three layer ids together; `MapView.tsx` gets one new `userLocationVisible` state/ref pair and one `handleUserLocationToggle`, following the exact shape of `handleMilitaryToggle` etc. This is simpler than exposing two independent toggles and matches the acceptance criteria's "toggle layer button for hiding the rings plus the user icon" (singular button).

**6. Rotation removed, not just disabled.** `startDishRotation`'s `requestAnimationFrame` loop, its `isStyleReady`-gated `setData` calls, and the `dishRotationStopRef`/`restartDishRotation` plumbing in `MapView.tsx` are deleted outright — a static icon has no rotation state to animate, so keeping the loop (even as dead code) would be pure debt.

## Risks / Trade-offs

- **[Risk]** A hand-authored `sat.svg` with overlapping/oppositely-wound subpaths could leave transparent holes after `source-in` recoloring, the same problem `airportIcon.ts` had to solve with flood-fill hole-solidifying. → Mitigation: author `sat.svg` as a single solid silhouette path (no compound subpaths), sidestepping the need to port that solidifying step.
- **[Risk]** Removing `USER_DISH_LAYER_ID`'s fill-extrusion layer and `startDishRotation` is a breaking change to `userLocation.ts`'s exports. → Mitigation: no other module imports these besides `MapView.tsx`, which is updated in the same change (confirmed via grep — only `MapView.tsx` imports from `userLocation.ts`).
- **[Trade-off]** Combining the icon + rings into one toggle (Decision 5) means a user can't hide just the rings while keeping the icon visible, or vice versa. Accepted per the acceptance criteria's explicit "toggle layer button for hiding the rings plus the user icon" wording (one button, both together).

## Migration Plan

Single-branch change, no data migration. Rollout is just shipping the updated `userLocation.ts`/new `userLocationIcon.ts`/`MapView.tsx`/`sat.svg`; rollback is reverting the commit. No feature flag — the old mast had no user-facing toggle either, so this is a straight visual replacement.

## Open Questions

None — acceptance criteria and existing code patterns (`airportIcon.ts`, the other layer toggles) fully determine the approach.

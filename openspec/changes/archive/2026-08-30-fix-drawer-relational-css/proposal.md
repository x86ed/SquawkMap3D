## Why

The `right-side-drawer` change (archived as `layer-control-drawer`) added a right-hand `LayerDrawer` that slides in over the map, resizable between 360-900px. Three pieces of pre-existing floating map UI were never updated to react to it, so they now visually collide with or hide behind it:

1. `ColorModeLegendDock` (the bottom-right color-mode legend the issue calls the "track indicator" — it recolors both aircraft icons and their track trails) is pinned at a flat `right: 12px`. When `LayerDrawer` opens, the drawer (z-index 20) slides directly over it (z-index 4), hiding it instead of making room for it.
2. `AircraftColorDock` (the bottom-left recenter + color-mode 2-button control, "the buttons on the left") already repositions vertically to clear the *aircraft* details drawer (`AircraftOverlay`, bottom, opens on aircraft selection), but has no awareness of `ColorModeLegendDock`'s own position. On a narrow viewport with a wide `LayerDrawer` open, `ColorModeLegendDock` gets pushed left far enough to overlap `AircraftColorDock` — today nothing detects or resolves that overlap.
3. `AircraftOverlay` (the full-width bottom "aircraft drawer" shown on aircraft selection) is hardcoded `left: 0; right: 0` — full viewport width regardless of whether `LayerDrawer` is open. Its own content already scales itself down via a `ResizeObserver` to whatever width its container reports, so it's already able to shrink correctly; it's just never told the right-hand drawer has taken part of the screen.

None of this is a `layer-control-drawer` regression in the sense of broken existing scenarios — those scenarios don't mention any of this other floating UI. It's an integration gap: `LayerDrawer` shipped without updating the map's other fixed-position overlays to treat its occupied width as part of the available screen space.

## What Changes

- `LayerDrawer` reports its current resizable width to `MapView` via a new `onWidthChange` callback prop, so `MapView` always knows the drawer's width independent of whether the drawer is open.
- `MapView` computes the drawer's currently *occupied* width (`0` when closed, the reported width when open) and exposes it as a CSS custom property (`--right-drawer-w`) on the shared ancestor element wrapping the map, `LayerDrawer`, `AircraftOverlay`, and the two bottom docks — so every one of those descendants can react to it in plain CSS, the same way `LayerDrawer` itself already exposes `--drawer-w` to its own subtree.
- `ColorModeLegendDock` rides the drawer's left edge while it's open: `right: calc(var(--right-drawer-w, 0px) + 12px)` instead of a flat `right: 12px`, transitioning smoothly in step with the drawer's own open/close and resize-drag animations.
- `AircraftOverlay`'s bottom drawer stops at the right-hand drawer's left edge while it's open: `right: var(--right-drawer-w, 0px)` instead of a flat `right: 0`. No changes are needed to its existing `ResizeObserver`-driven content-scaling logic (`AircraftOverlay.tsx`) — it already measures its actual rendered container width every time that container resizes, so a narrower box just makes it scale its grid down further, exactly as it already does for a narrow browser window.
- A new, testable collision check (`components/map/controls/dockCollision.ts`) measures `AircraftColorDock`'s and `ColorModeLegendDock`'s live bounding boxes and reports whether they overlap (or violate a minimum gap). `MapView` wires this into `AircraftColorDock` as an extra upward offset, so it stacks above `ColorModeLegendDock` instead of overlapping it whenever they'd otherwise collide — reactive to drawer width changes, drawer open/close, color-mode legend variant changes (the airspeed gauge is far wider than the altitude bar or rarity row), and viewport resizes.
- On the existing full-viewport mobile breakpoint (`max-width: 640px`, where `LayerDrawer` already expands to `100vw` and the top-right cluster already hides itself), `ColorModeLegendDock` and `AircraftColorDock` also hide themselves while the drawer is open — there's no meaningful "beside the drawer" position left at that width, matching the precedent `MapView.module.css`'s `.controls[data-hidden="true"]` rule already set for the top-right cluster at the same breakpoint.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-color-mode-control`: the bottom-left control and bottom-right legend also dock against the right-hand layer-control drawer (in addition to their existing docking against the aircraft details drawer), and the left control moves above the legend when the two would otherwise collide.
- `aircraft-info-overlay`: the overlay's bottom drawer is no longer unconditionally full-viewport-width; it's full-width-minus-the-right-hand-drawer whenever that drawer is open.

## Impact

- `components/map/drawer/LayerDrawer.tsx`: new `onWidthChange?: (width: number) => void` prop, invoked from the existing width-state effect/handlers (initial mount, drag-resize, restored-from-storage).
- `components/map/MapView.tsx`: new `layerDrawerWidth` state fed by `onWidthChange`; computes and applies `--right-drawer-w` as an inline style on the outer wrapper `div`; passes new props (`layerDrawerOpen` and refs feeding the collision check) into `AircraftColorDock`/`ColorModeLegendDock`.
- `components/map/overlay/AircraftOverlay.module.css`: `.drawer`'s `right: 0` becomes `right: var(--right-drawer-w, 0px)`.
- `components/map/overlay/ColorModeLegendDock.module.css` / `.tsx`: `.dock`'s `right: 12px` becomes `right: calc(var(--right-drawer-w, 0px) + 12px)`; new mobile-breakpoint hide rule; component forwards a ref for the collision check.
- `components/map/controls/AircraftColorDock.module.css` / `.tsx`: new `--collision-offset` custom property folded into the existing `bottom` calc; new mobile-breakpoint hide rule; component forwards a ref for the collision check.
- New: `components/map/controls/dockCollision.ts` (pure overlap predicate + `useDockCollisionOffset` hook) and its unit test.
- No changes to any layer-visibility logic, map view state, or aircraft data handling — this is purely a CSS/layout-coordination fix among already-existing UI pieces.

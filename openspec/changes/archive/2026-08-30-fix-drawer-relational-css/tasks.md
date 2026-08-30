## 1. Expose the layer-control drawer's occupied width

- [x] 1.1 In `components/map/drawer/LayerDrawer.tsx`, add an `onWidthChange?: (width: number) => void` prop and a `useEffect(() => onWidthChange?.(width), [width, onWidthChange])` so every change to the existing `width` state (initial mount/restore, resize-drag) is reported to the caller. Do not otherwise change how `width`/`isDesktop`/the drag handlers work.
- [x] 1.2 In `components/map/MapView.tsx`, add `const [layerDrawerWidth, setLayerDrawerWidth] = useState(DRAWER_DEFAULT_WIDTH)` (import `DRAWER_DEFAULT_WIDTH` from `./drawer/drawerWidth`) and pass `onWidthChange={setLayerDrawerWidth}` to `<LayerDrawer>`.
- [x] 1.3 In `components/map/MapView.tsx`, compute `const rightDrawerOccupiedWidth = drawerOpen ? layerDrawerWidth : 0;` and apply it as an inline `style` on the outermost wrapper `<div className={styles.container}>` (the one that wraps the map container, the drawer-theme scope, `AircraftOverlay`, `AircraftColorDock`, and `ColorModeLegendDock`): `style={{ "--right-drawer-w": \`${rightDrawerOccupiedWidth}px\` } as CSSProperties}`.

## 2. `AircraftOverlay` respects the drawer's occupied width

- [x] 2.1 In `components/map/overlay/AircraftOverlay.module.css`, change `.drawer`'s `right: 0;` to `right: var(--right-drawer-w, 0px);`. No changes to `AircraftOverlay.tsx` — its existing `ResizeObserver`-driven `scale` computation already reacts to `.scaleViewport`'s resulting width changing.
- [ ] 2.2 Manually verify: select an aircraft, open the layer-control drawer at its default width, then drag it wider — the aircraft overlay's right edge tracks the drawer's left edge in both cases, and its content scales down (never a horizontal scrollbar) as the available width shrinks.

## 3. `ColorModeLegendDock` rides the drawer's left edge

- [x] 3.1 In `components/map/overlay/ColorModeLegendDock.module.css`, change `.dock`'s `right: 12px;` to `right: calc(var(--right-drawer-w, 0px) + 12px);` (keep the existing `transition: bottom 220ms ease, right 220ms ease;`).
- [ ] 3.2 Manually verify: with no aircraft selected, open/close/resize the layer-control drawer — the legend's right edge tracks the drawer's left edge (plus 12px) while open, and returns to `right: 12px` once closed. Also verify combined with an aircraft selected (both the layer-control drawer's `right` offset and the aircraft overlay's `bottom` offset apply at once, without conflicting).

## 4. Collision-aware repositioning between the two bottom docks

- [x] 4.1 Add `components/map/controls/dockCollision.ts` exporting:
  - `export interface DockRect { top: number; right: number; bottom: number; left: number; height: number; }`
  - `export function docksTooClose(left: DockRect, right: DockRect, gapPx: number): boolean` — pure predicate per design.md Decision 4 (vertical-overlap check, then `left.right + gapPx > right.left`).
  - `export function useDockCollisionOffset(leftRef: RefObject<HTMLElement | null>, rightRef: RefObject<HTMLElement | null>, gapPx?: number): number` — returns `0` when clear, else `Math.ceil(rightRect.height + gapPx)`. Recomputes via a `ResizeObserver` on both elements, a `window.resize` listener, and an `IntersectionObserver` observing `leftRef.current` with `root: rightRef.current` and `rootMargin: "0px 0px 0px <gapPx>px"` (design.md Decision 4). Default `gapPx = 16`.
- [x] 4.2 Add `components/map/controls/dockCollision.test.ts` covering `docksTooClose`: clearly separated boxes (false), overlapping boxes (true), boxes within `gapPx` but not overlapping (true), boxes exactly `gapPx` apart (false, boundary case), and boxes with no vertical overlap at all despite horizontal proximity (false).
- [x] 4.3 In `components/map/controls/AircraftColorDock.tsx`, convert to `React.forwardRef<HTMLDivElement, ...>` so `MapView.tsx` can obtain a ref to the root `.dock` element; keep all existing props unchanged.
- [x] 4.4 In `components/map/overlay/ColorModeLegendDock.tsx`, same `React.forwardRef` change for its root `.dock` element.
- [x] 4.5 In `components/map/MapView.tsx`: create `const leftDockRef = useRef<HTMLDivElement>(null)` and `const legendDockRef = useRef<HTMLDivElement>(null)`, attach them to `<AircraftColorDock ref={leftDockRef} ...>` and `<ColorModeLegendDock ref={legendDockRef} ...>`, and call `const collisionOffsetPx = useDockCollisionOffset(leftDockRef, legendDockRef);`.
- [x] 4.6 Pass `collisionOffsetPx` into `<AircraftColorDock>` as a new prop (e.g. `collisionOffsetPx`), applied inside `AircraftColorDock.tsx` as an inline style on its root `.dock` element: `style={{ "--collision-offset": \`${collisionOffsetPx}px\` } as CSSProperties}`.
- [x] 4.7 In `components/map/controls/AircraftColorDock.module.css`, fold `var(--collision-offset, 0px)` into every existing `bottom` value: base `.dock` (`bottom: calc(12px + var(--collision-offset, 0px));`), `.dock[data-drawer-open="true"]` (`bottom: calc(45vh + 12px + var(--collision-offset, 0px));`), and the `@media (max-width: 760px)` variant (`bottom: calc(80vh + 12px + var(--collision-offset, 0px));`).
- [ ] 4.8 Manually verify the collision behavior across all three legend variants (rarity/altitude/airspeed — switch active color mode via the two-button control's own popup) at a narrow browser width with the layer-control drawer open and resized wide: confirm `AircraftColorDock` stacks above `ColorModeLegendDock` with a visible gap whenever they'd otherwise overlap, and returns to its normal row position once the drawer narrows/closes or the viewport widens.

## 5. Hide both bottom docks on the full-screen mobile drawer breakpoint

- [x] 5.1 In `components/map/MapView.tsx`, pass `layerDrawerOpen={drawerOpen}` (the existing `drawerOpen` state, no new state) to both `<AircraftColorDock>` and `<ColorModeLegendDock>`.
- [x] 5.2 In `components/map/controls/AircraftColorDock.tsx`, render the new `layerDrawerOpen` prop as `data-layer-drawer-open={layerDrawerOpen}` on the root `.dock` element (distinct from the existing `data-drawer-open`, which reflects the *aircraft* overlay's open state). Same change in `components/map/overlay/ColorModeLegendDock.tsx`.
- [x] 5.3 In both `AircraftColorDock.module.css` and `ColorModeLegendDock.module.css`, add:
  ```css
  @media (max-width: 640px) {
    .dock[data-layer-drawer-open="true"] {
      display: none;
    }
  }
  ```
- [ ] 5.4 Manually verify at a viewport narrower than 640px: opening the layer-control drawer hides both bottom docks entirely; closing it brings them back in whatever position their other docking rules currently dictate.

## 6. Verification

- [x] 6.1 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean.
- [ ] 6.2 Manually verify none of this change altered the layer-control drawer's own open/close/resize/persistence behavior, the aircraft details overlay's own open/close/selection behavior, or either bottom dock's existing docking behavior against the aircraft details overlay (only their behavior relative to the layer-control drawer and each other is new).
- [ ] 6.3 Manually verify with the layer-control drawer's Aircraft tab active and an aircraft selected simultaneously (both drawers open at once) — no component overlaps another, and both drawers' own content remains fully usable.

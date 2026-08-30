## Context

Three fixed-position pieces of map UI predate `LayerDrawer` (the right-hand drawer added by the archived `right-side-drawer` change) and have never been made aware of it:

- `AircraftOverlay` (`components/map/overlay/AircraftOverlay.tsx` + `.module.css`) — full-width bottom drawer shown on aircraft selection. Already scales its own content down via a `ResizeObserver` (`viewport.clientWidth`/`clientHeight` vs. `grid.scrollWidth`/`scrollHeight`) whenever its container is narrower than its content needs — it just has never been given a narrower container to react to.
- `ColorModeLegendDock` (`components/map/overlay/ColorModeLegendDock.tsx` + `.module.css`) — bottom-right color-mode legend (the issue's "track indicator"; it's the legend for whatever color mode is currently tinting aircraft icons and their track trails). Already repositions vertically (`bottom: calc(45vh + 12px)`) when `AircraftOverlay` opens.
- `AircraftColorDock` (`components/map/controls/AircraftColorDock.tsx` + `.module.css`) — bottom-left recenter + color-mode 2-button control (the issue's "buttons on the left"). Already repositions vertically the same way `ColorModeLegendDock` does, independently, to clear `AircraftOverlay`.

`LayerDrawer` (`components/map/drawer/LayerDrawer.tsx` + `.module.css`) itself already tracks a resizable `width` state (persisted via `drawerWidth.ts`, clamped `[360, min(900, 90vw)]`) and exposes it to its own subtree as a `--drawer-w` CSS custom property set inline on its own root `.drawer` element. Nothing outside that subtree can see it — `AircraftOverlay`, `ColorModeLegendDock`, and `AircraftColorDock` are siblings of `LayerDrawer`'s wrapper in `MapView.tsx`'s render tree, not descendants of it.

## Goals / Non-Goals

**Goals:**
- `ColorModeLegendDock` rides `LayerDrawer`'s left edge while it's open, instead of disappearing underneath it.
- `AircraftColorDock` never visually overlaps `ColorModeLegendDock`, regardless of viewport width, drawer width, or which color-mode legend variant (rarity row / altitude bar / airspeed gauge — three very different widths) is currently showing.
- `AircraftOverlay`'s bottom drawer treats `LayerDrawer`'s occupied width as the right edge of its own available space, so its existing scale-to-fit logic works against the real remaining space instead of the full viewport.
- Every reposition still uses the existing CSS-transition-driven approach (matching `LayerDrawer`'s own 0.32s slide and the docks' own existing 220ms `bottom`/`right` transitions) — no visible pop/jump.

**Non-Goals:**
- Redesigning any of these components' visuals, their docking behavior relative to `AircraftOverlay` (already correct and unchanged), or `LayerDrawer`'s own resize/persistence behavior.
- Making `AircraftColorDock`/`ColorModeLegendDock` collision-aware against anything other than each other (e.g. against `AircraftOverlay` — that relationship already exists and is untouched) or reflowing them into some other layout system (e.g. flexbox spanning both docks) — they remain two independent fixed-position elements.
- Any change to `LayerDrawer`'s own mobile full-screen breakpoint (`max-width: 640px`) behavior, beyond having the two bottom docks also hide themselves at that same breakpoint while it's open.

## Decisions

### Decision 1: `LayerDrawer` reports its width via a new `onWidthChange` callback; `MapView` owns the derived `--right-drawer-w` CSS variable
`LayerDrawer` keeps its own `width`/`isDesktop` state exactly as today (no controlled-component refactor — the resize-drag pointer handlers stay local, minimizing blast radius on already-shipped, tested behavior). It gains one new optional prop:

```ts
onWidthChange?: (width: number) => void;
```

Called once on mount (after `readStoredDrawerWidth()`/`clampDrawerWidth()` resolve the initial value) and again every time `width` changes (i.e. during a resize-drag, via the same `setWidth` calls `handlePointerMove` already makes) — simplest as a `useEffect(() => onWidthChange?.(width), [width, onWidthChange])`, not threaded through every individual `setWidth` call site.

`MapView.tsx` stores this in `const [layerDrawerWidth, setLayerDrawerWidth] = useState(DRAWER_DEFAULT_WIDTH)`, passes `onWidthChange={setLayerDrawerWidth}` into `<LayerDrawer>`, and computes:

```ts
const rightDrawerOccupiedWidth = drawerOpen ? layerDrawerWidth : 0;
```

This is applied as an inline style on `MapView.tsx`'s outermost wrapper `div` (the one at the top of the returned JSX, wrapping the map container, the drawer-theme scope, `AircraftOverlay`, and both docks):

```tsx
<div className={styles.container} style={{ "--right-drawer-w": `${rightDrawerOccupiedWidth}px` } as CSSProperties}>
```

CSS custom properties inherit down the DOM tree regardless of `position: fixed` on descendants (inheritance follows the DOM, not layout containment), so every fixed-position descendant — `LayerDrawer` itself (which still separately manages its own `--drawer-w` for its own width), `AircraftOverlay`, `ColorModeLegendDock`, and `AircraftColorDock` — can read `var(--right-drawer-w)` in plain CSS with no further prop drilling.

Deliberately *not* solved by lifting `width`/`isDesktop` fully out of `LayerDrawer` into a controlled component: that would also require moving the pointer-event drag handlers (`handlePointerDown`/`Move`/`Up`) and their `dragStateRef`, a much larger diff for the same outcome the callback achieves with one new prop and a three-line effect.

### Decision 2: No separate "is full-screen" flag from `LayerDrawer` — the mobile hide rule keys off `drawerOpen` alone, already known to `MapView`
At the `max-width: 640px` breakpoint, `LayerDrawer.module.css` forces `width: 100vw` purely via a media query — its `width` *state* (and therefore the reported `onWidthChange` value) still reflects whatever desktop-resized value was last set/stored, not `100vw`. That's fine: at that same breakpoint, both bottom docks are made to fully hide (`display: none`) whenever the drawer is open — see Decision 4 — so the numeric value of `--right-drawer-w` is irrelevant there; it's never rendered against. No new callback, prop, or `matchMedia` listener is needed in `MapView.tsx` for this — the existing `drawerOpen` boolean it already owns is sufficient, passed straight through as a new `layerDrawerOpen` prop to both docks.

### Decision 3: `AircraftOverlay` and `ColorModeLegendDock` consume `--right-drawer-w` in plain CSS; no JS changes to either's own logic
`AircraftOverlay.module.css`:
```css
.drawer {
  right: var(--right-drawer-w, 0px); /* was: right: 0; */
}
```
`AircraftOverlay.tsx`'s `ResizeObserver` already recomputes `scale` from `viewport.clientWidth`/`clientHeight` on every resize of its own container — narrowing `.drawer` via this CSS change makes that observer fire and shrink the content exactly as it already does for a narrow browser window. No code changes needed in `AircraftOverlay.tsx` itself.

`ColorModeLegendDock.module.css`:
```css
.dock {
  right: calc(var(--right-drawer-w, 0px) + 12px); /* was: right: 12px; */
  transition: bottom 220ms ease, right 220ms ease; /* right transition already present */
}
```
Because `--right-drawer-w` changes in lockstep with `LayerDrawer`'s own open/close slide and resize-drag (it's driven by the same `width`/`drawerOpen` state), and the `.dock`'s `right` property already transitions over 220ms, the legend visually eases to the drawer's edge. It won't be pixel-synced to the drawer's own 0.32s slide-open animation (two independent transitions, different durations) — accepted as a minor, cosmetic mismatch; both settle within a third of a second of each other and there's no requirement they move in lockstep frame-for-frame.

### Decision 4: Collision between `AircraftColorDock` and `ColorModeLegendDock` is resolved via a measured, JS-driven offset — not a fixed CSS breakpoint
Unlike `AircraftOverlay`'s width (a single, cleanly derivable number), whether the two bottom docks collide depends on several independently-varying quantities with no fixed relationship: viewport width, `LayerDrawer`'s resized width (360-900px), and `ColorModeLegendDock`'s own rendered width (its three variants in `ColorModeLegend.module.css` are very differently sized: the rarity row is 9×34px cards, the altitude bar is a flat 260px, the airspeed gauge is a 280px-wide speedometer arc). No single CSS breakpoint or `calc()` expression can correctly capture "these two elements' actual boxes are about to touch" across all those combinations — so this is measured directly, the same way `AircraftOverlay.tsx` already measures its own container with a `ResizeObserver` rather than guessing from viewport breakpoints.

New `components/map/controls/dockCollision.ts`:

```ts
export interface DockRect {
  top: number; right: number; bottom: number; left: number; height: number;
}

/** True when `left`'s box and `right`'s box are close enough (within
 * `gapPx`) — or already overlapping — along both axes that `left` should
 * stack above `right` instead of sharing its row. Pure and DOM-free so it's
 * directly unit-testable (same pattern as `drawerWidth.ts`'s
 * `clampDrawerWidth`), given plain `DOMRect`-shaped literals. */
export function docksTooClose(left: DockRect, right: DockRect, gapPx: number): boolean {
  const verticalOverlap = left.top < right.bottom && right.top < left.bottom;
  if (!verticalOverlap) return false;
  return left.right + gapPx > right.left;
}
```

and a hook, `useDockCollisionOffset(leftRef, rightRef, gapPx = 16): number`, returning `0` when the two docks are clear of each other, or `Math.ceil(rightRect.height + gapPx)` (the vertical distance `leftRef`'s dock must move up to clear `rightRef`'s dock entirely) when `docksTooClose` is true. Recomputation is triggered by:
- A `ResizeObserver` on both elements (catches `ColorModeLegendDock` switching between its three differently-sized legend variants, and any font-size/content reflow in either dock).
- A `window.resize` listener (catches viewport-width changes, which change `ColorModeLegendDock`'s `right: calc(...)` position without changing either element's own size — `ResizeObserver` alone would miss this).
- An `IntersectionObserver` observing `leftRef`'s element with `root: rightRef.current` and `rootMargin: "0px 0px 0px <gapPx>px"` — this is the mechanism that catches the case a plain `ResizeObserver`/`resize` listener both miss: the docks' *positions* changing purely from `LayerDrawer`'s own open/close/resize-drag CSS transition animating `--right-drawer-w` (and therefore `ColorModeLegendDock`'s `right` offset) frame-by-frame, with no corresponding `resize` event and no size change on either dock. Using an arbitrary (non-ancestor) element as an `IntersectionObserver` root is supported by every browser this app already requires for its other modern-API usage (`ResizeObserver`, `deck.gl`, WebGL terrain).

`MapView.tsx` renders both docks with `ref`s (`AircraftColorDock`/`ColorModeLegendDock` each forward a ref to their root `.dock` element via `React.forwardRef`), calls `useDockCollisionOffset(leftDockRef, rightDockRef)`, and passes the resulting number into `AircraftColorDock` as a new prop, applied as an inline custom property:

```tsx
<div className={styles.dock} data-drawer-open={drawerOpen} style={{ "--collision-offset": `${collisionOffsetPx}px` } as CSSProperties}>
```

`AircraftColorDock.module.css` folds this into its existing `bottom` calc (both the base and the `[data-drawer-open="true"]`/mobile-breakpoint variants):

```css
.dock {
  bottom: calc(12px + var(--collision-offset, 0px));
}
.dock[data-drawer-open="true"] {
  bottom: calc(45vh + 12px + var(--collision-offset, 0px));
}
@media (max-width: 760px) {
  .dock[data-drawer-open="true"] {
    bottom: calc(80vh + 12px + var(--collision-offset, 0px));
  }
}
```

This directly implements the acceptance criteria's "the buttons on the left should move up above the track indicator" — `AircraftColorDock` is always the one that moves (matching the issue's literal wording), `ColorModeLegendDock` never reacts to `AircraftColorDock`'s position.

### Decision 5: Both bottom docks hide entirely on the mobile full-screen drawer breakpoint while it's open
`AircraftColorDock.module.css` and `ColorModeLegendDock.module.css` each get:
```css
@media (max-width: 640px) {
  .dock[data-layer-drawer-open="true"] {
    display: none;
  }
}
```
(`640px` chosen to exactly match `LayerDrawer.module.css`'s own existing full-screen breakpoint and `MapView.module.css`'s existing `.controls[data-hidden="true"]` rule — this repo already duplicates this literal breakpoint value across those two files rather than sharing a constant; kept consistent with that existing style rather than introducing a new shared breakpoint constant for a purely CSS-scoped concern.) `data-layer-drawer-open` is a new attribute (distinct from each dock's existing `data-drawer-open`, which already means "the *aircraft* overlay is open" — reusing that name for a second, unrelated boolean would be actively confusing) fed straight from `MapView.tsx`'s existing `drawerOpen` state, no new state needed.

## Risks / Trade-offs

- The `IntersectionObserver`-with-arbitrary-root technique (Decision 4) is less commonly used than a plain ResizeObserver; if it ever proves unreliable in a real browser this app must support, the fallback is a `setTimeout` fired at `LayerDrawer`'s own known transition duration (0.32s) plus each dock's own transition duration (220ms) after any state change that can move either dock — strictly worse (timing-based, not event-based) but a viable fallback without redesigning the approach.
- `ColorModeLegendDock`'s `right` transition (220ms) and `LayerDrawer`'s `transform` slide (0.32s) are two independently-timed CSS transitions; during the ~100ms between them settling, the legend's edge and the drawer's edge won't be pixel-aligned. Accepted as cosmetically minor and not worth coupling the two transitions' durations together (which would require either hardcoding one dock's transition to match the drawer's, or introducing a shared timing constant threaded through both CSS modules).
- `useDockCollisionOffset` adds a small amount of always-on measurement work (two observers plus a resize listener) for as long as the map view is mounted. Given `AircraftOverlay.tsx` already runs a comparable `ResizeObserver`-driven measurement loop unconditionally today, this is consistent with the existing performance profile of this component tree, not a new category of cost.

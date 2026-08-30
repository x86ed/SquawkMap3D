import { useEffect, useState, type RefObject } from "react";

export interface DockRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  height: number;
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

/**
 * Returns the vertical offset (px) `leftRef`'s dock must move up to clear
 * `rightRef`'s dock entirely — `0` when the two are already clear of each
 * other, else `Math.ceil(rightRect.height + gapPx)` (design.md Decision 4).
 *
 * Recomputed on:
 * - A `ResizeObserver` on both elements (catches either dock's own content
 *   changing size, e.g. `ColorModeLegendDock` switching between its three
 *   differently-sized legend variants).
 * - A `window.resize` listener (catches viewport-width changes, which move
 *   `ColorModeLegendDock` via its own `right: calc(...)` without resizing
 *   either element).
 * - An `IntersectionObserver` observing `leftRef.current` with `root:
 *   rightRef.current` — catches the two docks' positions changing purely
 *   from `LayerDrawer`'s own open/close/resize-drag CSS transition
 *   animating `--right-drawer-w` frame-by-frame, with no corresponding
 *   `resize` event and no size change on either dock.
 */
export function useDockCollisionOffset(
  leftRef: RefObject<HTMLElement | null>,
  rightRef: RefObject<HTMLElement | null>,
  gapPx = 16,
): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    if (!leftEl || !rightEl) return;

    const recompute = () => {
      const leftRect = leftEl.getBoundingClientRect();
      const rightRect = rightEl.getBoundingClientRect();
      const tooClose = docksTooClose(leftRect, rightRect, gapPx);
      setOffset(tooClose ? Math.ceil(rightRect.height + gapPx) : 0);
    };

    recompute();

    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(leftEl);
    resizeObserver.observe(rightEl);

    window.addEventListener("resize", recompute);

    const intersectionObserver = new IntersectionObserver(recompute, {
      root: rightEl,
      rootMargin: `0px 0px 0px ${gapPx}px`,
    });
    intersectionObserver.observe(leftEl);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recompute);
      intersectionObserver.disconnect();
    };
  }, [leftRef, rightRef, gapPx]);

  return offset;
}

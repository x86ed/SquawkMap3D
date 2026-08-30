import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./LayerDrawer.module.css";
import {
  DRAWER_DEFAULT_WIDTH,
  clampDrawerWidth,
  readStoredDrawerWidth,
  writeStoredDrawerWidth,
} from "./drawerWidth";

/** Matches `LayerDrawer.module.css`'s own `@media (max-width: 640px)` full-
 * screen breakpoint (design.md Decision 12) — the resize handle only makes
 * sense strictly above that width, where the drawer isn't already forced to
 * 100vw (design.md Decision 16). */
const DESKTOP_MEDIA_QUERY = "(min-width: 641px)";

/**
 * Right-hand slide-out drawer shell (layer-control-drawer's "Right-hand
 * slide-out drawer" requirement) — header (title + close control) plus a
 * scrollable body. Always mounted (visibility driven by a `data-open`
 * `transform: translateX` CSS transition, matching the reference file's
 * `.drawer`/`.drawer.open` behavior) so the slide animation has something
 * to animate; callers are responsible for only mounting anything
 * poll-driven (e.g. `PlaneListingPanel`) while `open` is true (design.md
 * Decision 8) rather than relying on this shell to unmount `children`.
 */
export function LayerDrawer({
  open,
  onClose,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  subtitle?: string;
  children: ReactNode;
}) {
  const [width, setWidth] = useState<number>(DRAWER_DEFAULT_WIDTH);
  const [isDesktop, setIsDesktop] = useState(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const stored = readStoredDrawerWidth();
    if (stored !== null) setWidth(clampDrawerWidth(stored, window.innerWidth));
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    // The handle sits on the drawer's left edge, facing the map — dragging
    // left (negative clientX delta) widens the drawer, dragging right
    // narrows it (design.md Decision 16).
    const deltaX = event.clientX - dragState.startX;
    setWidth(clampDrawerWidth(dragState.startWidth - deltaX, window.innerWidth));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    writeStoredDrawerWidth(width);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className={styles.drawer}
      data-open={open}
      role="dialog"
      aria-label="Layers and traffic panel"
      aria-hidden={!open}
      style={{ "--drawer-w": `${width}px` } as CSSProperties}
    >
      {isDesktop && (
        <div
          className={styles.resizeHandle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
        />
      )}
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Layers &amp; Traffic</h1>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close panel"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

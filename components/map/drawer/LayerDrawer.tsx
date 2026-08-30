import type { ReactNode } from "react";
import styles from "./LayerDrawer.module.css";

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
  return (
    <div
      className={styles.drawer}
      data-open={open}
      role="dialog"
      aria-label="Layers and traffic panel"
      aria-hidden={!open}
    >
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./LayerDrawer.module.css";

const DRAWER_WIDTH_STORAGE_KEY = "squawkmap3d:layerDrawer:width";
const DRAWER_MIN_WIDTH = 360;
const DRAWER_DEFAULT_WIDTH = 452;
/** Matches `LayerDrawer.module.css`'s own `@media (max-width: 640px)` full-
 * screen breakpoint (design.md Decision 12) — the resize handle only makes
 * sense strictly above that width, where the drawer isn't already forced to
 * 100vw (design.md Decision 16). */
const DESKTOP_MEDIA_QUERY = "(min-width: 641px)";

function clampDrawerWidth(width: number): number {
  if (typeof window === "undefined") return width;
  const max = Math.min(900, window.innerWidth * 0.9);
  return Math.min(Math.max(width, DRAWER_MIN_WIDTH), max);
}

function readStoredWidth(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    // localStorage unavailable (e.g. private browsing) — width just won't persist.
  }
}

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

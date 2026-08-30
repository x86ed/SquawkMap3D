export const DRAWER_WIDTH_STORAGE_KEY = "squawkmap3d:layerDrawer:width";
export const DRAWER_MIN_WIDTH = 360;
export const DRAWER_MAX_WIDTH_CAP = 900;
export const DRAWER_DEFAULT_WIDTH = 452;

/**
 * Clamps a candidate drawer width to `[360, min(900, 90vw)]` (design.md
 * Decision 16). Pure/no `window` access so the bounds are directly unit-
 * testable without a DOM; `LayerDrawer.tsx` passes `window.innerWidth` as
 * `viewportWidth`.
 */
export function clampDrawerWidth(width: number, viewportWidth: number): number {
  const max = Math.min(DRAWER_MAX_WIDTH_CAP, viewportWidth * 0.9);
  return Math.min(Math.max(width, DRAWER_MIN_WIDTH), max);
}

/**
 * Restores a previously-resized drawer width from `localStorage` (design.md
 * Decision 16), same persistence convention as `theme.ts`'s
 * `THEME_STORAGE_KEY`. Returns `null` when unset, unavailable (SSR/private
 * browsing), or unparsable.
 */
export function readStoredDrawerWidth(): number | null {
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

/** Persists the current drawer width, restored on the next mount by
 * `readStoredDrawerWidth()`. */
export function writeStoredDrawerWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    // localStorage unavailable (e.g. private browsing) — width just won't persist.
  }
}

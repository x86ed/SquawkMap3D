export type ViewMode = "2d" | "3d";

export const VIEW_MODE_STORAGE_KEY = "squawkmap3d:viewMode";

export function getStoredViewMode(): ViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "2d" || stored === "3d" ? stored : null;
  } catch {
    return null;
  }
}

export function storeViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable (e.g. private browsing) — view mode just won't persist.
  }
}

/** Last chosen view mode, else 3D. */
export function getInitialViewMode(): ViewMode {
  return getStoredViewMode() ?? "3d";
}

import type { MapTheme } from "./mapStyles";

export const THEME_STORAGE_KEY = "squawkmap3d:theme";

export function getStoredTheme(): MapTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: MapTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (e.g. private browsing) — theme just won't persist.
  }
}

export function getSystemTheme(): MapTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** OS preference unless the user has manually chosen a theme before. */
export function getInitialTheme(): MapTheme {
  return getStoredTheme() ?? getSystemTheme();
}

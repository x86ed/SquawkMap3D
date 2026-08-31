import { clearAircraftModelCardCache } from "./aircraftModelCard";

/**
 * adsb.win feeder UUID (bearer credential) storage — mirrors `theme.ts`'s
 * `localStorage` accessor pattern exactly (SSR guard, try/catch around
 * storage access for private-browsing/unavailable-storage). See
 * openspec/changes/adsb-win-aircraft-card-api/design.md Decision 2: this is
 * deliberately a `localStorage`-only value, never a `NEXT_PUBLIC_*` build-time
 * env var, since it's a real bearer credential (unlike the low-sensitivity
 * map-tile API keys that do use that pattern).
 */
export const FEEDER_UUID_STORAGE_KEY = "squawkmap3d:adsbWinFeederUuid";

export function getStoredFeederUuid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(FEEDER_UUID_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Trims whitespace; a trimmed-empty value clears the key instead of storing `""`. */
export function storeFeederUuid(uuid: string): void {
  const trimmed = uuid.trim();
  if (typeof window === "undefined") return;
  try {
    if (trimmed === "") {
      window.localStorage.removeItem(FEEDER_UUID_STORAGE_KEY);
    } else {
      window.localStorage.setItem(FEEDER_UUID_STORAGE_KEY, trimmed);
    }
  } catch {
    // localStorage unavailable (e.g. private browsing) — value just won't persist.
  }
  // Defensive, on top of the cache key already being UUID-scoped (design.md
  // Decision 6) — a changed/cleared UUID must never serve another account's
  // cached card data.
  clearAircraftModelCardCache();
}

export function clearStoredFeederUuid(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FEEDER_UUID_STORAGE_KEY);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
  clearAircraftModelCardCache();
}

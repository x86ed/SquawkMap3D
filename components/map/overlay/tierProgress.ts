// adsb.win's real, confirmed material-tier XP thresholds. See
// openspec/changes/adsb-win-aircraft-card-api/design.md Decision 4/4a.
const TIER_START_XP: Record<string, number> = {
  alloy: 0,
  carbon: 25_000,
  titanium: 100_000,
  iridium: 300_000,
  plasma: 1_000_000,
  quantum: 3_000_000, // max tier
};

const TIER_ORDER = ["alloy", "carbon", "titanium", "iridium", "plasma", "quantum"] as const;

export interface TierProgress {
  percentToNext: number; // 0-99, clamped — never shown as 100 (see below)
  nextTierName: string | null; // null only for the max tier
}

function capitalizeTierName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Computes progress toward the next adsb.win material tier from the
 * confirmed, tester-sourced default threshold table (see top-of-file
 * comment). Returns `null` for any tier name this table doesn't recognize —
 * a safety valve so an unrecognized/future tier never renders a guessed
 * percentage, only a real "no bar" fallback.
 */
export function computeTierProgress(tierName: string, xp: number): TierProgress | null {
  const key = tierName.trim().toLowerCase();
  const idx = TIER_ORDER.indexOf(key as (typeof TIER_ORDER)[number]);
  if (idx === -1) return null; // unrecognized tier name — render no bar, not a guess
  const start = TIER_START_XP[key];
  const nextKey = TIER_ORDER[idx + 1];
  if (!nextKey) return { percentToNext: 100, nextTierName: null }; // max tier reached
  const end = TIER_START_XP[nextKey];
  const raw = ((xp - start) / (end - start)) * 100;
  return { percentToNext: Math.min(99, Math.max(0, Math.round(raw))), nextTierName: capitalizeTierName(nextKey) };
}

import type { Aircraft } from "./aircraft";
import aircraftRareness from "./data/aircraftRareness.json";

/**
 * Five-tier rarity classification for an aircraft, computed from a vendored
 * snapshot of a real per-aircraft-type "rareness" dataset (see design.md
 * Decision 5) — this is the `taildragger` sibling game project's own
 * game-balance scoring, not adsb.win's undisclosed algorithm and not a
 * bespoke/invented heuristic. Sourced from a different real dataset than
 * this feeder's actual sighting frequency; see
 * openspec/changes/aircraft-info-overlay/design.md's Risks for the residual
 * caveat.
 */
export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_TIER_COLORS: Record<RarityTier, string> = {
  common: "#64748b",
  uncommon: "#22c55e",
  rare: "#06b6d4",
  epic: "#8b5cf6",
  legendary: "#eab308",
};

/**
 * Four fixed quantile cutpoints (20th/40th/60th/80th percentile of the 1679
 * scored rows in the vendored snapshot), computed once and pinned as
 * constants — not recomputed at runtime. See design.md Decision 5's table.
 */
export const RARITY_TIER_THRESHOLDS = [6.91, 9.19, 11.18, 13.15] as const;

/** Fixed rarity value for an aircraft with no type designator, or one with
 * no matching row in the vendored snapshot. Sits above both the scored
 * dataset's mean (10.07) and median (10.26) — deliberately treated as more
 * rare than a typical known type, not a "safe middle" default. */
const UNMATCHED_TYPE_RARITY_VALUE = 15;

let rarenessByTypeDesignator: Map<string, number> | null = null;

function getRarenessByTypeDesignator(): Map<string, number> {
  if (!rarenessByTypeDesignator) {
    rarenessByTypeDesignator = new Map(
      (aircraftRareness as Array<{ id: string; rareness: number }>).map((row) => [
        row.id,
        row.rareness,
      ]),
    );
  }
  return rarenessByTypeDesignator;
}

/**
 * `rareness / 100` for the vendored snapshot row matching `aircraft`'s type
 * designator, or the fixed default (`15`) when unset/unmatched. See
 * design.md Decision 5.
 */
export function computeRarityValue(aircraft: Aircraft): number {
  if (!aircraft.typeDesignator) return UNMATCHED_TYPE_RARITY_VALUE;
  const rareness = getRarenessByTypeDesignator().get(aircraft.typeDesignator);
  if (rareness === undefined) return UNMATCHED_TYPE_RARITY_VALUE;
  return rareness / 100;
}

/** Buckets `computeRarityValue(aircraft)` against `RARITY_TIER_THRESHOLDS`. */
export function computeRarityTier(aircraft: Aircraft): RarityTier {
  const value = computeRarityValue(aircraft);
  const [t1, t2, t3, t4] = RARITY_TIER_THRESHOLDS;
  if (value < t1) return "common";
  if (value < t2) return "uncommon";
  if (value < t3) return "rare";
  if (value < t4) return "epic";
  return "legendary";
}

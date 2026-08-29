import type { Aircraft } from "./aircraft";
import aircraftRareness from "./data/aircraftRareness.json";

/**
 * Nine-tier rarity classification for an aircraft. The tier *names* and
 * their `{ color, highlight, glow }` CSS values are adsb.win's own real,
 * verified-exact 9-tier taxonomy (independently confirmed against
 * `https://adsb.win/assets/tailwind-255296c3.css`), not invented or
 * approximated — see design.md Decision 5. Only the *bucketing mechanics*
 * (which numeric value lands in which tier) are this project's own, sourced
 * from a vendored snapshot of a real per-aircraft-type "rareness" dataset
 * (the `taildragger` sibling game project's own game-balance scoring, not
 * adsb.win's undisclosed algorithm). Sourced from a different real dataset
 * than this feeder's actual sighting frequency; see
 * openspec/changes/aircraft-info-overlay/design.md's Risks for the residual
 * caveat.
 */
export type RarityTier =
  | "unidentified"
  | "standard"
  | "prime"
  | "remarkable"
  | "exceptional"
  | "epic"
  | "legendary"
  | "mythic"
  | "apex";

/**
 * adsb.win's own real, verified-exact per-tier `{ color, highlight, glow }`
 * CSS custom-property values (design.md Decision 5's table). `unidentified`
 * mirrors adsb.win's base `.aircraft-rarity` rule defaults — it shares
 * `color`/`highlight` with `standard` but has a distinct `glow`; it is
 * intentionally NOT the same object as `standard`.
 */
export const RARITY_TIER_STYLES: Record<
  RarityTier,
  { color: string; highlight: string; glow: string }
> = {
  unidentified: { color: "#64748b", highlight: "#cbd5e1", glow: "#64748b33" },
  standard: { color: "#64748b", highlight: "#cbd5e1", glow: "#94a3b83d" },
  prime: { color: "#0891b2", highlight: "#67e8f9", glow: "#06b6d46b" },
  remarkable: { color: "#2563eb", highlight: "#93c5fd", glow: "#3b82f675" },
  exceptional: { color: "#7c3aed", highlight: "#c4b5fd", glow: "#8b5cf680" },
  epic: { color: "#db2777", highlight: "#f9a8d4", glow: "#ec489985" },
  legendary: { color: "#d97706", highlight: "#fde68a", glow: "#f59e0b8f" },
  mythic: { color: "#db2777", highlight: "#f0abfc", glow: "#d946ef9e" },
  apex: { color: "#bae6fd", highlight: "#fff", glow: "#cffafed1" },
};

/**
 * Seven fixed octile cutpoints (12.5th/25th/37.5th/50th/62.5th/75th/87.5th
 * percentile of `rareness / 100` across the 1679 scored rows in the vendored
 * snapshot), computed once and pinned as constants — not recomputed at
 * runtime. See design.md Decision 5's table. `unidentified` is not on this
 * scale at all (see `computeRarityTier`); these seven cutpoints only bucket
 * the other eight named tiers (`standard` through `apex`).
 */
export const RARITY_TIER_OCTILE_THRESHOLDS = [
  5.84, 7.55, 8.98, 10.26, 11.45, 12.66, 14.0,
] as const;

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
 * designator, or `undefined` when `aircraft.typeDesignator` is unset or has
 * no matching row. There is no fixed numeric fallback: an unmatched aircraft
 * isn't a rare *value* on the scale at all — it has no meaningful bucket to
 * place it in (see `computeRarityTier`'s `unidentified` handling). See
 * design.md Decision 5.
 */
export function computeRarityValue(aircraft: Aircraft): number | undefined {
  if (!aircraft.typeDesignator) return undefined;
  const rareness = getRarenessByTypeDesignator().get(aircraft.typeDesignator);
  if (rareness === undefined) return undefined;
  return rareness / 100;
}

/**
 * Returns `"unidentified"` directly (not via bucketing) whenever
 * `computeRarityValue` is `undefined` — mirrors adsb.win's own behavior of
 * showing no rarity classification at all for a type it doesn't recognize.
 * Otherwise buckets the defined value against `RARITY_TIER_OCTILE_THRESHOLDS`.
 */
export function computeRarityTier(aircraft: Aircraft): RarityTier {
  const value = computeRarityValue(aircraft);
  if (value === undefined) return "unidentified";
  const [t1, t2, t3, t4, t5, t6, t7] = RARITY_TIER_OCTILE_THRESHOLDS;
  if (value < t1) return "standard";
  if (value < t2) return "prime";
  if (value < t3) return "remarkable";
  if (value < t4) return "exceptional";
  if (value < t5) return "epic";
  if (value < t6) return "legendary";
  if (value < t7) return "mythic";
  return "apex";
}

/**
 * The exact per-tier `background` gradient `PlaneCard.module.css`'s
 * `.aircraftRarityFrame[data-tier]` rules use (design.md Decision 5),
 * reproduced here so any other UI that needs a tier's real card gradient —
 * not just its flat accent color — can compute it from `RARITY_TIER_STYLES`
 * without duplicating a second hardcoded hex table (`ColorModeLegend`'s
 * rarity-mode swatches, see aircraft-color-mode-control's "should use the
 * gradients from the cards" fix). `mythic` and `apex` override with their
 * own distinct formulas in the source CSS (a conic sweep and a
 * white-forward linear ramp, respectively) — reproduced verbatim, not
 * derived from `color`/`highlight`, to stay byte-for-byte in sync with
 * `PlaneCard.module.css`. Keep both in sync if either changes.
 */
export function rarityTierGradient(tier: RarityTier): string {
  if (tier === "mythic") {
    return "conic-gradient(from 210deg, #22d3ee, #8b5cf6, #ec4899, #f59e0b, #22d3ee)";
  }
  if (tier === "apex") {
    return "linear-gradient(120deg, #fff, #ecfeff 18%, #bae6fd 46%, #e0e7ff 72%, #fff)";
  }
  const { color, highlight } = RARITY_TIER_STYLES[tier];
  return `linear-gradient(135deg, ${highlight}, color-mix(in srgb, ${color} 30%, #070b14) 35%, ${color})`;
}

/** All 9 real tiers in their low-to-high order, `unidentified` first — for
 * UI that renders every tier at once (e.g. `ColorModeLegend`'s rarity-mode
 * card row), rather than each caller re-deriving/duplicating this order. */
export const ALL_RARITY_TIERS: RarityTier[] = [
  "unidentified",
  "standard",
  "prime",
  "remarkable",
  "exceptional",
  "epic",
  "legendary",
  "mythic",
  "apex",
];

const RARITY_TIER_LADDER: RarityTier[] = [
  "standard",
  "prime",
  "remarkable",
  "exceptional",
  "epic",
  "legendary",
  "mythic",
  "apex",
];

/**
 * The next tier up from `tier` on the 8-tier numeric ladder (`standard`
 * through `apex`), for the "N% to {next tier}" progress label PlaneCard
 * shows (mirroring adsb.win's own "0% to Carbon" label — that's their
 * *material* tier ladder; this is the equivalent for the *rarity* ladder).
 * Returns `null` when `tier` is already `apex` (the maximum — nothing to
 * progress toward) or is `unidentified` (not a value on this ladder at all,
 * see `computeRarityTier`).
 */
export function nextRarityTier(tier: RarityTier): RarityTier | null {
  const index = RARITY_TIER_LADDER.indexOf(tier);
  if (index === -1 || index === RARITY_TIER_LADDER.length - 1) return null;
  return RARITY_TIER_LADDER[index + 1];
}

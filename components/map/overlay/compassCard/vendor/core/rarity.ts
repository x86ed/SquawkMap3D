// Trimmed vendoring from https://github.com/plens-win/Card
// packages/core/src/rarity.ts @ 39734839 (2026-09-28). Full upstream file
// also ships its own `computeRarityTier`/vendored rareness dataset; this app
// never calls those — it always computes `RarityTier` itself via
// components/map/aircraftRarity.ts and passes the result straight through
// (see design.md's "Live telemetry feed" decision) — so only the `RarityTier`
// type and `RARITY_TIER_STYLES` constant that compass-track-three actually
// imports from `@card/core` are vendored here, to avoid a second, unused
// copy of the rareness-bucketing dataset/logic living in this app.

/** Nine-tier rarity classification for an aircraft. The tier *names* and
 * their `{color, highlight, glow}` CSS values are adsb.win's own real,
 * verified-exact 9-tier taxonomy — identical to this app's own
 * `components/map/aircraftRarity.ts` (confirmed byte-for-byte against
 * upstream's own doc comment: "standardized to `SquawkMap3D`'s
 * `components/map/aircraftRarity.ts`"). */
export type RarityTier =
  | 'unidentified'
  | 'standard'
  | 'prime'
  | 'remarkable'
  | 'exceptional'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'apex';

/** adsb.win's own real, verified-exact per-tier `{color, highlight, glow}`
 * CSS custom-property values. `unidentified` mirrors adsb.win's base
 * `.aircraft-rarity` rule defaults — it shares `color`/`highlight` with
 * `standard` but has a distinct `glow`; it is intentionally NOT the same
 * object as `standard`. */
export const RARITY_TIER_STYLES: Record<RarityTier, { color: string; highlight: string; glow: string }> = {
  unidentified: { color: '#64748b', highlight: '#cbd5e1', glow: '#64748b33' },
  standard: { color: '#64748b', highlight: '#cbd5e1', glow: '#94a3b83d' },
  prime: { color: '#0891b2', highlight: '#67e8f9', glow: '#06b6d46b' },
  remarkable: { color: '#2563eb', highlight: '#93c5fd', glow: '#3b82f675' },
  exceptional: { color: '#7c3aed', highlight: '#c4b5fd', glow: '#8b5cf680' },
  epic: { color: '#db2777', highlight: '#f9a8d4', glow: '#ec489985' },
  legendary: { color: '#d97706', highlight: '#fde68a', glow: '#f59e0b8f' },
  mythic: { color: '#db2777', highlight: '#f0abfc', glow: '#d946ef9e' },
  apex: { color: '#bae6fd', highlight: '#fff', glow: '#cffafed1' },
};

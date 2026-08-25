import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";

const UNKNOWN = "Unknown";

/**
 * Identity card ported directly from adsb.win's "hangar" aircraft cards —
 * every color, gradient, shadow, radius, and spacing value below was read
 * off the live site's computed styles (`getComputedStyle` against
 * https://adsb.win/'s "Build your hangar" section), not approximated. Only
 * five of adsb.win's six tiers are used since this app has five rarity
 * tiers (`common`→`legendary`); each is mapped to its closest adsb.win
 * material: common→Alloy, uncommon→Carbon, rare→Titanium, epic→Plasma,
 * legendary→Quantum (Iridium's palette is the one dropped).
 *
 * adsb.win's cards additionally show per-model registrations/flights/XP
 * counts and a level-up progress bar — a fleet-wide aggregate that doesn't
 * exist for this app's single-aircraft-instance card, so those are not
 * reproduced (fabricating counts would violate this change's own
 * never-fabricate-data principle — see design.md). The decorative corner
 * glow orb is adsb.win's own fixed cyan-300/30 on every tier (verified: not
 * tier-colored on their site either), reproduced as-is rather than tinted.
 * Missing identity fields render an explicit "Unknown" placeholder — never
 * blank space or a literal "undefined"/"null" (aircraft-info-overlay spec's
 * "Identity data unknown" scenario).
 */
export function PlaneCard({
  registration,
  manufacturerModel,
  operator,
  rarityTier,
}: {
  registration?: string;
  manufacturerModel?: string;
  operator?: string;
  rarityTier: RarityTier;
  rarityColor: string;
}) {
  return (
    <article className={styles.card} data-tier={rarityTier}>
      <div className={styles.glowOrb} aria-hidden="true" />
      <div className={styles.headerRow}>
        <div className={styles.identity}>
          <span className={styles.typeBadge}>{rarityTier}</span>
          <p className={styles.registrationLabel}>{registration ?? UNKNOWN}</p>
          <h3 className={styles.modelName}>{manufacturerModel ?? UNKNOWN}</h3>
        </div>
        <div className={styles.planeIcon} aria-hidden="true">
          ✈
        </div>
      </div>
      <dl className={styles.statGrid}>
        <div className={styles.statFull}>
          <dt className={styles.statLabel}>Operator</dt>
          <dd className={styles.statValue}>{operator ?? UNKNOWN}</dd>
        </div>
      </dl>
      <div className={styles.badgeRow}>
        <span className={styles.rarityBadge}>{rarityTier}</span>
      </div>
    </article>
  );
}

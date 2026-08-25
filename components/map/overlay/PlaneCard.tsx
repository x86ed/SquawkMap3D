import type { CSSProperties } from "react";
import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";

const UNKNOWN = "Unknown";

/**
 * Identity card styled after adsb.win's "hangar" aircraft-model cards
 * (rounded card, corner blur glow, mono tier pill, divider, footer stat
 * row) — anatomy and chrome matched directly against the live site's
 * computed styles; colors are driven by this app's own single `rarityColor`
 * per tier rather than adsb.win's distinct per-tier palette, since this
 * card represents one tracked aircraft instance, not an aggregate
 * collection-progress card, and reuses the same tier color already shown
 * elsewhere (map glow, marquee). Missing fields render an explicit
 * "Unknown" placeholder — never blank space or a literal "undefined"/"null"
 * (aircraft-info-overlay spec's "Identity data unknown" scenario).
 */
export function PlaneCard({
  registration,
  manufacturerModel,
  operator,
  rarityTier,
  rarityColor,
}: {
  registration?: string;
  manufacturerModel?: string;
  operator?: string;
  rarityTier: RarityTier;
  rarityColor: string;
}) {
  return (
    <article
      className={styles.card}
      data-tier={rarityTier}
      style={{ "--tier-color": rarityColor } as CSSProperties}
    >
      <div className={styles.glowOrb} aria-hidden="true" />
      <div className={styles.headerRow}>
        <div className={styles.identity}>
          <span className={styles.tierBadge}>{rarityTier}</span>
          <div className={styles.registrationLabel}>{registration ?? UNKNOWN}</div>
          <h3 className={styles.modelName}>{manufacturerModel ?? UNKNOWN}</h3>
        </div>
        <div className={styles.planeIcon} aria-hidden="true">
          ✈
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.footer}>
        <span className={styles.footerLabel}>Operator</span>
        <span className={styles.operator}>{operator ?? UNKNOWN}</span>
      </div>
    </article>
  );
}

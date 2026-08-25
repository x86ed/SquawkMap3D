import type { CSSProperties } from "react";
import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";

const UNKNOWN = "Unknown";

/**
 * adsb.win-style identity sticker card: hard offset shadow, solid corner tag
 * showing the tier name in the tier's accent color, registration heading,
 * manufacturer/model + operator footer. Missing fields render an explicit
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
    <div
      className={styles.card}
      style={{ "--tier-color": rarityColor } as CSSProperties}
    >
      <div className={styles.cornerTag}>{rarityTier}</div>
      <div className={styles.planeIcon} aria-hidden="true">
        ✈
      </div>
      <div className={styles.registration}>{registration ?? UNKNOWN}</div>
      <div className={styles.footer}>
        <div className={styles.manufacturerModel}>{manufacturerModel ?? UNKNOWN}</div>
        <div className={styles.operator}>{operator ?? UNKNOWN}</div>
      </div>
    </div>
  );
}

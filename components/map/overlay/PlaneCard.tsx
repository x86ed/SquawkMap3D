import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";

const UNKNOWN = "Unknown";

export interface PlaneCardProps {
  registration?: string;
  manufacturerModel?: string;
  operator?: string;
  rarityTier: RarityTier;
  /**
   * Fleet-wide per-aircraft-type stats (design.md Decision 14) — always
   * `undefined` as of this change (no data source exists yet). Props exist
   * for forward compatibility only; when all six are defined, the real
   * stat-grid + XP-progress-bar layout renders instead of the empty state.
   */
  uniqueRegistrationsCount?: number;
  flightsCapturedCount?: number;
  observedFlightTimeSeconds?: number;
  highestAltitudeObserved?: number;
  xp?: number;
  xpProgressToNextTier?: number;
}

/** `HH:MM` from a seconds count, for the (currently unreachable) "present" stat grid. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

/**
 * Identity card using adsb.win's own real, verified-exact two-layer
 * gradient-border-frame technique (design.md Decision 5): the outer frame's
 * own `background` *is* the tier-colored border (a `--rarity-color`/
 * `--rarity-highlight`/`--rarity-glow` triple driven entirely by CSS via
 * `data-tier`, see `PlaneCard.module.css`); the inner card sits on top,
 * leaving a ~2px ring plus a 22px strip at the bottom for the floating tier
 * badge. All nine of adsb.win's real tiers (including `unidentified`, which
 * gets no explicit `[data-tier]` rule — it inherits the frame's own base
 * defaults, exactly like adsb.win's CSS) render via this one component; no
 * per-tier branching needed here.
 *
 * Fleet-wide stat fields (registrations/flights/observed time/highest
 * altitude/XP/progress) are forward-plumbed optional props (design.md
 * Decision 14) — always `undefined` today, since no data source for them
 * exists in this codebase or the feeder stack. The "present" stat-grid
 * layout below uses this codebase's own existing spec-grid conventions
 * (matching `RecordPanelHero`) as a documented placeholder — it is NOT
 * verified pixel-exact against adsb.win's real authenticated dashboard card
 * (unreachable during this amendment, see design.md Decision 14) and should
 * be confirmed by a developer with dashboard access before this branch ever
 * actually renders.
 */
export function PlaneCard({
  registration,
  manufacturerModel,
  operator,
  rarityTier,
  uniqueRegistrationsCount,
  flightsCapturedCount,
  observedFlightTimeSeconds,
  highestAltitudeObserved,
  xp,
  xpProgressToNextTier,
}: PlaneCardProps) {
  const statsPresent =
    uniqueRegistrationsCount !== undefined &&
    flightsCapturedCount !== undefined &&
    observedFlightTimeSeconds !== undefined &&
    highestAltitudeObserved !== undefined &&
    xp !== undefined &&
    xpProgressToNextTier !== undefined;

  return (
    <div className={styles.aircraftRarityFrame} data-tier={rarityTier}>
      <div className={styles.aircraftTierCard}>
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
        <dl className={styles.identityStats}>
          <div className={styles.statFull}>
            <dt className={styles.statLabel}>Operator</dt>
            <dd className={styles.statValue}>{operator ?? UNKNOWN}</dd>
          </div>
        </dl>
        {statsPresent ? (
          <dl className={styles.statGrid}>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Registrations</dt>
              <dd className={styles.statValue}>{uniqueRegistrationsCount}</dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>Flights captured</dt>
              <dd className={styles.statValue}>{flightsCapturedCount}</dd>
            </div>
            <div className={styles.statRowSpan2}>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Observed flight time</dt>
                <dd className={styles.statValue}>{formatDuration(observedFlightTimeSeconds)}</dd>
              </div>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Highest altitude</dt>
                <dd className={styles.statValue}>{highestAltitudeObserved} ft</dd>
              </div>
            </div>
            <div className={styles.xpRow}>
              <div className={styles.xpLabelRow}>
                <dt className={styles.statLabel}>XP</dt>
                <dd className={styles.statValue}>{xp}</dd>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round(xpProgressToNextTier * 100)}%` }}
                />
              </div>
            </div>
          </dl>
        ) : (
          <p className={styles.statsEmpty}>Not tracked yet</p>
        )}
      </div>
      <div className={styles.badgeRow}>
        <span className={styles.rarityBadge}>{rarityTier}</span>
      </div>
    </div>
  );
}

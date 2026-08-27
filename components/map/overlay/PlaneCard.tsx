import styles from "./PlaneCard.module.css";
import { nextRarityTier, type RarityTier } from "../aircraftRarity";
import { getAircraftShape } from "../aircraftShapes";

const UNKNOWN = "Unknown";

export interface PlaneCardProps {
  registration?: string;
  /** ICAO type designator — selects the vendored top-view silhouette (see
   * `aircraftShapes.ts`); falls back to that set's own "Unidentified"
   * shape when unset or unrecognized. */
  typeDesignator?: string;
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

function capitalize(tier: RarityTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
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
 * Fleet-wide stat fields (unique registrations/flights captured/observed
 * flight time/highest observed altitude/XP/progress-to-next-tier) are
 * forward-plumbed optional props (design.md Decision 14) — always
 * `undefined` today, since no data source for them exists in this codebase
 * or the feeder stack. The "present" branch's field labels, 2-col grid, and
 * XP/progress-bar row match adsb.win's real authenticated dashboard card
 * markup field-for-field (`dt`/`dd` labels, the "N% to {next tier}"
 * progress label — computed here from `rarityTier` via `nextRarityTier`,
 * which works today even though the stats themselves don't). One thing
 * intentionally NOT reproduced: adsb.win's card ends with a "View
 * registrations →" link into a per-model registrations list — this app has
 * no such view (it tracks live ADS-B instances, not a historical
 * per-type-model registrations database), so linking there would go
 * nowhere real; omitted rather than faked.
 */
export function PlaneCard({
  registration,
  typeDesignator,
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

  const shape = getAircraftShape(typeDesignator);
  const nextTier = nextRarityTier(rarityTier);

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
          <svg
            className={styles.shapeIcon}
            viewBox={shape.viewBox}
            aria-hidden="true"
            // shape.markup is sourced only from the vendored, license-attributed SVG files at build time (scripts/generate-aircraft-shapes-manifest.mjs), never from user/network input
            dangerouslySetInnerHTML={{ __html: shape.markup }}
          />
        </div>
        <dl className={styles.identityStats}>
          <div className={styles.statFull}>
            <dt className={styles.statLabel}>Operator</dt>
            <dd className={styles.statValue}>{operator ?? UNKNOWN}</dd>
          </div>
        </dl>
        {statsPresent ? (
          <>
            <dl className={styles.statGrid}>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Unique registrations</dt>
                <dd className={styles.statValueLarge}>{uniqueRegistrationsCount}</dd>
              </div>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Flights captured</dt>
                <dd className={styles.statValueLarge}>{flightsCapturedCount}</dd>
              </div>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Observed flight time</dt>
                <dd className={styles.statValue}>{formatDuration(observedFlightTimeSeconds)}</dd>
              </div>
              <div className={styles.statCell}>
                <dt className={styles.statLabel}>Highest observed</dt>
                <dd className={styles.statValue}>{highestAltitudeObserved.toLocaleString()} ft</dd>
              </div>
            </dl>
            <div className={styles.xpBlock}>
              <div className={styles.xpLabelRow}>
                <span className={styles.xpValue}>{xp} XP</span>
                <span className={styles.progressLabel}>
                  {nextTier
                    ? `${Math.round(xpProgressToNextTier * 100)}% to ${capitalize(nextTier)}`
                    : "Maximum tier"}
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.round(xpProgressToNextTier * 100)}%` }}
                />
              </div>
            </div>
          </>
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

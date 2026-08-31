import { useMemo, useState } from "react";
import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";
import { getAircraftShape, type AircraftShape } from "../aircraftShapes";
import { computeTightViewBox } from "../svgBBox";
import type { AircraftModelCardResult } from "./aircraftModelCard";
import { storeFeederUuid } from "./feederUuid";
import { computeTierProgress } from "./tierProgress";

const UNKNOWN = "Unknown";

export interface PlaneCardProps {
  registration?: string;
  /** ICAO type designator — selects the vendored top-view silhouette (see
   * `aircraftShapes.ts`); falls back to that set's own "Unidentified"
   * shape when unset or unrecognized. */
  typeDesignator?: string;
  /** ADS-B emitter category — passed straight through to `getAircraftShape`
   * as its coarse fallback when `typeDesignator` isn't available. */
  category?: string;
  manufacturerModel?: string;
  rarityTier: RarityTier;
  /**
   * adsb.win's real per-account, per-aircraft-type fleet-wide stats
   * (`adsb-win-aircraft-stats` capability) — `undefined` only when
   * `typeDesignator` itself is unknown. See design.md Decision 5.
   */
  cardStats?: AircraftModelCardResult;
}

/** `HH:MM` from a seconds count, for the stat grid's "observed flight time" cell. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

/**
 * The vendored shape's own declared `viewBox` isn't tightly cropped to its
 * actual drawing (see `svgBBox.ts`'s doc comment — some types, like the
 * Cessna 172, draw at barely a fourteenth of their nominal canvas), so
 * using it directly renders as a near-invisible speck regardless of how big
 * `.shapeIcon` itself is sized. Measures the shape's real content bounding
 * box (mounts the markup into a detached, off-screen `<svg>` just long
 * enough to call `getBBox()`, then immediately unmounts it — see
 * `computeTightViewBox`) and returns a tight, padded, square crop instead,
 * memoized per `shape` reference so re-renders with the same selected
 * aircraft don't remeasure.
 */
function useTightAircraftShapeViewBox(shape: AircraftShape): string {
  return useMemo(() => computeTightViewBox(shape.markup, shape.viewBox), [shape]);
}

/**
 * Inline feeder-UUID entry form (design.md Decision 3) — shown in the stat
 * region's `"not_configured"`/`"invalid_token"` states. Submitting calls
 * `storeFeederUuid()` directly (no callback prop threaded through
 * `AircraftOverlay`, matching `theme.ts`'s direct-import convention used
 * elsewhere in this app); the next ~1s aircraft poll picks up the freshly
 * stored value on its own.
 */
function FeederUuidForm({ message, buttonLabel }: { message: string; buttonLabel: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    storeFeederUuid(value);
    setSaved(true);
  };

  return (
    <form className={styles.feederUuidForm} onSubmit={handleSubmit}>
      <p className={styles.feederUuidMessage}>{message}</p>
      <input
        type="password"
        className={styles.feederUuidInput}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
        placeholder="Feeder UUID"
        aria-label="adsb.win feeder UUID"
      />
      <button type="submit" className={styles.feederUuidButton}>
        {saved ? "Saved" : buttonLabel}
      </button>
    </form>
  );
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
 * The stat region renders one of five states, driven by `cardStats?.status`
 * (`adsb-win-aircraft-stats` capability, design.md Decision 5): `undefined`
 * or `"not_found"` render the same "Not tracked yet" empty state as before
 * this data source existed; `"not_configured"`/`"invalid_token"` render an
 * inline feeder-UUID entry form; `"error"` renders a generic
 * "unable to load" message; `"ok"` renders the real stat grid plus an
 * XP/tier row and a `computeTierProgress`-driven progress bar (a *different*
 * tier ladder than this card's own `rarityTier` frame/badge — see
 * `tierProgress.ts`'s doc comment and design.md Decision 4).
 */
export function PlaneCard({
  registration,
  typeDesignator,
  category,
  manufacturerModel,
  rarityTier,
  cardStats,
}: PlaneCardProps) {
  const shape = getAircraftShape(typeDesignator, category);
  const viewBox = useTightAircraftShapeViewBox(shape);

  return (
    <div className={styles.aircraftRarityFrame} data-tier={rarityTier}>
      <div className={styles.aircraftTierCard}>
        <div className={styles.glowOrb} aria-hidden="true" />
        <div className={styles.headerRow}>
          <div className={styles.identity}>
            {/* ICAO type designator, not the rarity tier — that's shown on
             * `.rarityBadge` at the card's bottom edge already. */}
            <span className={styles.typeBadge}>{typeDesignator?.toUpperCase() ?? UNKNOWN}</span>
            <p className={styles.registrationLabel}>{registration ?? UNKNOWN}</p>
            <h3 className={styles.modelName}>{manufacturerModel ?? UNKNOWN}</h3>
          </div>
          <svg
            className={styles.shapeIcon}
            viewBox={viewBox}
            aria-hidden="true"
            // shape.markup is sourced only from the vendored, license-attributed SVG files at build time (scripts/generate-aircraft-shapes-manifest.mjs), never from user/network input
            dangerouslySetInnerHTML={{ __html: shape.markup }}
          />
        </div>
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
            {viewRegistrationsHref && (
              <a className={styles.viewRegistrationsLink} href={viewRegistrationsHref}>
                View registrations <span aria-hidden="true">→</span>
              </a>
            )}
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

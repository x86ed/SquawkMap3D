import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlaneCard.module.css";
import type { RarityTier } from "../aircraftRarity";
import { getAircraftShape, type AircraftShape } from "../aircraftShapes";
import { computeTightViewBox } from "../svgBBox";
import type { AircraftModelCardResult } from "./aircraftModelCard";
import { storeFeederUuid } from "./feederUuid";
import { computeTierProgress } from "./tierProgress";
import { splitManufacturerModel } from "./manufacturerModel";

const UNKNOWN = "Unknown";

export interface PlaneCardProps {
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
 * `data-material-tier` for `.aircraftTierCard` (design.md Decision 1) —
 * normalized the same way `computeTierProgress` normalizes its own `tierName`
 * argument (trim + lowercase), and only returned when that normalized value
 * is one `tierProgress.ts`'s table actually recognizes (delegates to
 * `computeTierProgress` itself rather than re-deriving the recognized-tier
 * list here, so there's one source of truth). `undefined` — never an empty
 * or unrecognized string — for a non-`"ok"` status or an unrecognized tier
 * name, so `PlaneCard`'s JSX omits the attribute entirely (React drops a
 * `data-*` prop set to `undefined`) rather than rendering a guessed style.
 */
function materialTierAttr(cardStats: AircraftModelCardResult | undefined): string | undefined {
  if (cardStats?.status !== "ok") return undefined;
  const normalized = cardStats.attributes.tier.trim().toLowerCase();
  return computeTierProgress(cardStats.attributes.tier, cardStats.attributes.xp) ? normalized : undefined;
}

/**
 * Renders `PlaneCard`'s stat region for every real `cardStats` outcome
 * (`adsb-win-aircraft-stats` capability, design.md Decision 5). `undefined`
 * and `"not_found"` are treated identically — both mean "nothing to show,
 * not an error" (design.md Decision 5).
 */
function renderStatRegion(cardStats: AircraftModelCardResult | undefined) {
  if (cardStats === undefined || cardStats.status === "not_found") {
    return <p className={styles.statsEmpty}>Not tracked yet</p>;
  }

  if (cardStats.status === "not_configured") {
    return (
      <FeederUuidForm
        message="Connect your adsb.win feeder ID to see stats for this aircraft"
        buttonLabel="Save"
      />
    );
  }

  if (cardStats.status === "invalid_token") {
    return (
      <FeederUuidForm
        message="Feeder UUID not recognized. Enter a valid one to see stats."
        buttonLabel="Update"
      />
    );
  }

  if (cardStats.status === "error") {
    return <p className={styles.statsEmpty}>Unable to load stats right now</p>;
  }

  const { attributes } = cardStats;
  const progress = computeTierProgress(attributes.tier, attributes.xp);

  return (
    <>
      <dl className={styles.statGrid}>
        <div className={styles.statCell}>
          <dt className={styles.statLabel}>Unique registrations</dt>
          <dd className={styles.statValueLarge}>{attributes.uniqueRegistrations}</dd>
        </div>
        <div className={styles.statCell}>
          <dt className={styles.statLabel}>Flights captured</dt>
          <dd className={styles.statValueLarge}>{attributes.flightsCaptured}</dd>
        </div>
        <div className={styles.statCell}>
          <dt className={styles.statLabel}>Observed flight time</dt>
          <dd className={styles.statValue}>{formatDuration(attributes.observedSeconds)}</dd>
        </div>
        <div className={styles.statCell}>
          <dt className={styles.statLabel}>Highest observed</dt>
          <dd className={styles.statValue}>
            {attributes.maximumAltitudeFt === null
              ? "—"
              : `${attributes.maximumAltitudeFt.toLocaleString()} ft`}
          </dd>
        </div>
      </dl>
      <div className={styles.xpBlock}>
        <div className={styles.xpLabelRow}>
          <span className={styles.xpValue}>{attributes.xp.toLocaleString()} XP</span>
          <span className={styles.progressLabel}>
            {attributes.tier}
            {progress && progress.nextTierName && ` — ${progress.percentToNext}% to ${progress.nextTierName}`}
            {progress && !progress.nextTierName && " — Maximum tier"}
          </span>
        </div>
        {progress && (
          <div className={styles.progressTrack}>
            <div
              className={
                progress.nextTierName === null
                  ? `${styles.progressFill} ${styles.progressFillMax}`
                  : styles.progressFill
              }
              style={{ width: `${progress.percentToNext}%` }}
            />
          </div>
        )}
      </div>
    </>
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
  typeDesignator,
  category,
  manufacturerModel,
  rarityTier,
  cardStats,
}: PlaneCardProps) {
  const shape = getAircraftShape(typeDesignator, category);
  const viewBox = useTightAircraftShapeViewBox(shape);
  const { manufacturer, model } = splitManufacturerModel(manufacturerModel);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  /**
   * Contain-fit scale for the whole card: `.aircraftRarityFrame` renders at
   * its real, intrinsic size (a fixed 320px width, auto height — see
   * `PlaneCard.module.css`'s doc comment on `.aircraftRarityFrame`), and
   * this ResizeObserver compares that natural `scrollWidth`/`scrollHeight`
   * against `.cardScaleWrap`'s actual `clientWidth`/`clientHeight` (the box
   * `.card`'s drawer-grid cell actually hands this component), applying a
   * uniform `transform: scale()` — capped at 1, so a cell already big
   * enough to fit the card renders it pixel-identical to its natural size —
   * mirroring `AircraftOverlay.tsx`'s own grid-level contain-fit mechanism
   * one level up. Because both axes scale together off the frame's own
   * fixed-width/auto-height box, the card's real aspect ratio is preserved
   * at every size ("keep the scale consistent with the aspect ratio ...
   * regardless of scale"), and shrinking a too-short cell shrinks the whole
   * card — fonts and the silhouette included — to fit its vertical height,
   * rather than only the inner content while the frame itself stayed
   * stretched to the cell's own (often much wider) shape. Neither
   * `clientWidth`/`clientHeight` nor `scrollWidth`/`scrollHeight` are
   * affected by an already-applied `transform`, so this self-referential
   * comparison is stable and can't feed back on itself.
   */
  useEffect(() => {
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame) return;

    const recompute = () => {
      const availableWidth = wrap.clientWidth;
      const availableHeight = wrap.clientHeight;
      const naturalWidth = frame.scrollWidth;
      const naturalHeight = frame.scrollHeight;
      if (availableWidth <= 0 || availableHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
        return;
      }
      setScale(Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight));
    };

    const observer = new ResizeObserver(recompute);
    observer.observe(wrap);
    observer.observe(frame);
    recompute();
    return () => observer.disconnect();
  }, [cardStats, rarityTier, typeDesignator, manufacturerModel]);

  return (
    <div className={styles.cardScaleWrap} ref={wrapRef}>
      <div
        className={styles.aircraftRarityFrame}
        ref={frameRef}
        data-tier={rarityTier}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <div className={styles.aircraftTierCard} data-material-tier={materialTierAttr(cardStats)}>
          <div className={styles.glowOrb} aria-hidden="true" />
          <div className={styles.scaledContent}>
            <div className={styles.headerRow}>
              <div className={styles.identity}>
                {/* ICAO type designator, not the rarity tier — that's shown on
                 * `.rarityBadge` at the card's bottom edge already. */}
                <span className={styles.typeBadge}>{typeDesignator?.toUpperCase() ?? UNKNOWN}</span>
                <p className={styles.manufacturerLabel}>{manufacturer ?? UNKNOWN}</p>
                <h3 className={styles.modelName}>{model ?? manufacturerModel ?? UNKNOWN}</h3>
              </div>
              <svg
                className={styles.shapeIcon}
                viewBox={viewBox}
                aria-hidden="true"
                // shape.markup is sourced only from the vendored, license-attributed SVG files at build time (scripts/generate-aircraft-shapes-manifest.mjs), never from user/network input
                dangerouslySetInnerHTML={{ __html: shape.markup }}
              />
            </div>
            {renderStatRegion(cardStats)}
          </div>
        </div>
        <div className={styles.badgeRow}>
          {cardStats?.status === "ok" && <span className={styles.tierBadge}>{cardStats.attributes.tier}</span>}
          <span className={styles.rarityBadge}>{rarityTier}</span>
        </div>
      </div>
    </div>
  );
}

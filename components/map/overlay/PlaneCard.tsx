import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlaneCard.module.css";
import { RARITY_TIER_STYLES, type RarityTier } from "../aircraftRarity";
import { getAircraftShape, isExactShapeMatch, type AircraftShape } from "../aircraftShapes";
import { computeTightViewBox } from "../svgBBox";
import type { AircraftModelCardResult } from "./aircraftModelCard";
import { storeFeederUuid } from "./feederUuid";
import { computeTierProgress } from "./tierProgress";
import { splitManufacturerModel } from "./manufacturerModel";
import { loadAircraftGltfScene, mountCardArt } from "./planeCardFrontArt";
import { resolveModelKeyForTypeAndCategory, modelAuthor, isExactModelMatch } from "../aircraftModels";
import { getModelCrudUrl, getTypeCrudUrl, buildCrudUrl } from "../constants";
import { creditLinkMarkup, WIREFRAME_CUBE_ICON } from "./compassCard/vendor/core";

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
  /**
   * Which face rests forward without hover — `true` (the default) rests
   * the back face (identity + stat region) forward; hovering flips to the
   * front face (identity + silhouette + XP panel). See design.md
   * Decision 2. Every current call site (`AircraftOverlay`) passes `true`
   * explicitly rather than relying silently on the default.
   */
  showBack?: boolean;
  /** Aircraft-variant key (e.g. `"FREIGHTER"`) — shown under the model name
   * on both faces; omitted entirely when unset. Mirrors upstream
   * `AircraftCardInput.variant`. */
  variant?: string;
  /** adsb.win operator handle credited on the back face's "Added by" line
   * (who added this aircraft model). Blank renders an "UNKNOWN" placeholder
   * — a "+ Add info" link to the type CRUD page when configured. */
  addedBy?: string;
  /** adsb.win operator handle credited as first spotter on the first-seen
   * badge (both faces). Blank renders an "@unknown" placeholder. The date
   * itself comes from `cardStats.attributes.firstSeenAt`. */
  firstSeenBy?: string;
}

/** Static flag glyph for the first-seen badge — ported from
 * `@card/core`'s `FIRST_SEEN_FLAG_ICON`. */
const FIRST_SEEN_FLAG_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18M5 4h13l-3 4 3 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

const operatorProfileUrl = (handle: string) =>
  `https://adsb.win/operators/${encodeURIComponent(handle.trim())}`;

/** `Jan 1, 2024` (UTC) for the first-seen tooltip, or `null` when unparseable. */
function formatFirstSeenDate(iso: string): string | null {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
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
 * XP count / tier / progress-bar block — shared by the back face's stat
 * region (only for a successful `cardStats` result) and the front face's
 * always-present XP panel (design.md Decision 4), so the two faces never
 * drift out of sync on how this is computed/rendered. Renders a plain "—"
 * placeholder for every non-`"ok"` outcome rather than fabricating a value.
 */
function renderXpSummary(cardStats: AircraftModelCardResult | undefined) {
  if (cardStats?.status !== "ok") {
    return (
      <div className={styles.xpBlock}>
        <div className={styles.xpLabelRow}>
          <span className={styles.xpValue}>{UNKNOWN}</span>
        </div>
      </div>
    );
  }

  const { attributes } = cardStats;
  const progress = computeTierProgress(attributes.tier, attributes.xp);

  return (
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
  );
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
      {renderXpSummary(cardStats)}
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
  showBack = true,
  variant,
  addedBy = "",
  firstSeenBy = "",
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

  const frontArtRef = useRef<HTMLDivElement | null>(null);
  // `null` until the first mount resolves — which asset actually rendered
  // (flat SVG fallback vs. 3D wireframe), read from `mountCardArt`'s own
  // `slot.dataset.frontArtFlat` marker, so the credit line below (task 7 —
  // see design.md's "PlaneCard gets its own credit line" decision) credits
  // whichever asset is actually shown rather than guessing.
  const [frontArtIsFlat, setFrontArtIsFlat] = useState<boolean | null>(null);

  /**
   * Front-face art (design.md Decision 4's "3D model" follow-up): mounts a
   * themed wireframe render of the aircraft's vendored `.glb` model (the
   * same files `aircraftModels.ts` feeds to the map's `ScenegraphLayer`),
   * ported verbatim from `plens-win/Card`'s `@card/wireframe-three`
   * (`planeCardFrontArt.ts`), falling back to the flat 2D silhouette when
   * the aircraft has no vendored model. Runs imperatively (not React-owned
   * DOM) because the underlying library function directly manages a
   * `<canvas>`/WebGL context; `cancelled` guards against a slower-resolving
   * earlier aircraft's model landing after a newer selection's effect ran.
   */
  useEffect(() => {
    const slot = frontArtRef.current;
    if (!slot) return;
    let cancelled = false;
    const color = RARITY_TIER_STYLES[rarityTier].color;
    // `shape.markup` is inner content only (paths/groups, no `<svg>` tag —
    // see `aircraftShapes.ts`'s doc comment) meant to be rendered inside a
    // caller-provided `<svg viewBox>`, same as the back face's own shapeIcon
    // below. `mountCardArt`'s flat-fallback path sets this directly as a
    // plain `<div>`'s `innerHTML`; without the wrapping `<svg viewBox>` tag,
    // the browser's HTML parser never enters SVG foreign-content mode for
    // the bare `<g>`/`<path>` markup, so it rendered broken/tiny instead of
    // filling the front face like the 3D wireframe does.
    const fallbackSvg = `<svg viewBox="${viewBox}">${shape.markup}</svg>`;
    loadAircraftGltfScene(typeDesignator, category).then((scene) => {
      if (cancelled) return;
      mountCardArt(slot, scene ?? undefined, color, fallbackSvg);
      setFrontArtIsFlat(slot.dataset.frontArtFlat === "true");
    });
    return () => {
      cancelled = true;
    };
  }, [typeDesignator, category, rarityTier, shape, viewBox]);

  // Reset once the selection itself changes (type/category), so a stale
  // flat/3D verdict from the previous aircraft never briefly credits the
  // wrong asset while the new one's art effect above is still resolving.
  // Adjusted during render (React's documented pattern for resetting state
  // when a prop changes), not in a effect, since an effect whose entire body
  // is a single unconditional setState call is a lint-flagged anti-pattern.
  const [frontArtKey, setFrontArtKey] = useState({ typeDesignator, category });
  if (frontArtKey.typeDesignator !== typeDesignator || frontArtKey.category !== category) {
    setFrontArtKey({ typeDesignator, category });
    setFrontArtIsFlat(null);
  }

  /** Front-face credit line (task 7, design.md's "PlaneCard gets its own
   * credit line" decision): the vendored `.glb`'s author when the 3D
   * wireframe rendered, else the vendored SVG's own author when it fell
   * back to the flat silhouette — either way, an unauthored asset falls
   * back to the model-CRUD "create a model" CTA (reusing the same shared
   * `creditLinkMarkup` the compass card's credit HUD uses), and nothing
   * renders at all once neither an author nor a configured CTA endpoint
   * exists.
   *
   * Only ever credits an *exact* match for `typeDesignator` — a category
   * (wake-class) fallback or the "Unidentified" shape is a real vendored
   * asset, just not this aircraft's, and can itself carry a real author;
   * crediting it here would misattribute someone else's model/shape to an
   * unrelated aircraft, so a fallback/placeholder asset is always treated
   * as unauthored (driving the CTA) regardless of what it's actually
   * credited to. */
  const frontArtAuthor =
    frontArtIsFlat === null
      ? undefined
      : frontArtIsFlat
        ? (isExactShapeMatch(typeDesignator) ? shape.author : undefined)
        : (isExactModelMatch(typeDesignator)
            ? modelAuthor(resolveModelKeyForTypeAndCategory(typeDesignator, category))
            : undefined);
  const modelCrudUrlTemplate = getModelCrudUrl();
  const modelAddUrl =
    !frontArtAuthor && modelCrudUrlTemplate
      ? buildCrudUrl(modelCrudUrlTemplate, { icao: typeDesignator })
      : undefined;
  const showCreditLine = frontArtIsFlat !== null && (!!frontArtAuthor || !!modelAddUrl);
  const creditLinkHtml = showCreditLine
    ? creditLinkMarkup(
        frontArtAuthor ?? "",
        frontArtAuthor ? `https://adsb.win/operators/${encodeURIComponent(frontArtAuthor)}` : "",
        styles.creditLink,
        "",
        "+ Add a model",
        modelAddUrl,
      )
    : "";

  const typeCrudUrlTemplate = getTypeCrudUrl();
  const typeEditHref =
    typeCrudUrlTemplate && typeDesignator ? buildCrudUrl(typeCrudUrlTemplate, { icao: typeDesignator }) : undefined;

  // Upstream `aircraft` card's remaining user fields: added-by, silhouette
  // (SVG) credit, first-seen. Same blank -> placeholder/CTA convention as
  // the model credit above; CTAs link to the type CRUD page when configured.
  const silhouetteAuthor = isExactShapeMatch(typeDesignator) ? (shape.author ?? "") : "";
  const infoAddUrl = typeEditHref;
  const firstSeenIso = cardStats?.status === "ok" ? cardStats.attributes.firstSeenAt : undefined;
  const firstSeenDate = firstSeenIso ? formatFirstSeenDate(firstSeenIso) : null;
  const firstSeenTooltip = firstSeenDate ? `First seen ${firstSeenDate}` : "First seen: Nobody";
  const addedByHtml = creditLinkMarkup(
    addedBy,
    operatorProfileUrl(addedBy),
    styles.creditLink,
    "UNKNOWN",
    "+ Add info",
    infoAddUrl,
  );
  const silhouetteHtml = creditLinkMarkup(
    silhouetteAuthor,
    operatorProfileUrl(silhouetteAuthor),
    styles.creditLink,
    "@unknown",
    "+ Create an icon",
    infoAddUrl,
  );
  const firstSeenHtml = creditLinkMarkup(
    firstSeenBy,
    operatorProfileUrl(firstSeenBy),
    styles.creditLink,
    "@unknown",
    "+ Add info",
    infoAddUrl,
  );
  const firstSeenBadge = (
    <span
      className={`${styles.firstSeenIcon}${firstSeenDate ? "" : ` ${styles.creditUnknown}`}`}
      title={firstSeenTooltip}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: FIRST_SEEN_FLAG_ICON }}
    />
  );

  return (
    <div className={styles.cardScaleWrap} ref={wrapRef}>
      <div
        className={styles.aircraftRarityFrame}
        ref={frameRef}
        data-tier={rarityTier}
        data-show-back={showBack || undefined}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {/*
         * Two-face flip card (design.md Decision 2, ported from
         * `plens-win/Card`'s `@card/core`/`@card/wireframe-three`):
         * `.cardInner` is the shared click target (both faces navigate
         * identically) and the element `PlaneCard.module.css`'s
         * `data-show-back`-driven CSS rotates on hover. Each face
         * (`.cardFace.cardFaceBack`/`.cardFace.cardFaceFront`) is a
         * COMPLETE bordered card — the whole card flips, not just its inner
         * content (see `.cardFace`'s doc comment in the CSS).
         */}
        <div
          className={styles.cardInner}
          style={typeDesignator ? { cursor: "pointer" } : undefined}
          onClick={(event) => {
            if (!typeDesignator) return;
            // Leave the feeder-UUID form (and any other control) alone.
            if ((event.target as HTMLElement).closest("form, input, button, a")) return;
            window.open(
              `https://adsb.win/dashboard/aircraft/${encodeURIComponent(typeDesignator.trim().toUpperCase())}`,
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          <div className={`${styles.cardFace} ${styles.cardFaceBack}`}>
            <div className={styles.aircraftTierCard} data-material-tier={materialTierAttr(cardStats)}>
              <div className={styles.glowOrb} aria-hidden="true" />
              <div className={styles.scaledContent}>
                <div className={styles.headerRow}>
                  <div className={styles.identity}>
                    {/* ICAO type designator, not the rarity tier — that's
                     * shown on `.rarityBadge`/`.cardBadgeRow` below. */}
                    <span className={styles.typeBadge}>{typeDesignator?.toUpperCase() ?? UNKNOWN}</span>
                    <p className={styles.manufacturerLabel}>{manufacturer ?? UNKNOWN}</p>
                    <div className={styles.modelNameRow}>
                      <h3 className={styles.modelName}>{model ?? manufacturerModel ?? UNKNOWN}</h3>
                      {typeEditHref && (
                        <a
                          className={styles.editButton}
                          href={typeEditHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Edit this aircraft type's info"
                        >
                          Edit
                        </a>
                      )}
                    </div>
                    {variant && <p className={styles.variant}>{variant}</p>}
                  </div>
                  <svg
                    className={styles.shapeIcon}
                    viewBox={viewBox}
                    aria-hidden="true"
                    // shape.markup is sourced only from the vendored, license-attributed SVG files at build time (scripts/generate-aircraft-shapes-manifest.mjs), never from user/network input
                    dangerouslySetInnerHTML={{ __html: shape.markup }}
                  />
                </div>
                {/* Credit HTML below is built only from vendored asset metadata / configured CRUD URLs, escaped by the vendored creditLinkMarkup. */}
                <div className={styles.credits}>
                  <div className={styles.creditLine} title="Added by">
                    <span className={styles.creditPlus} aria-hidden="true">+</span>
                    <span dangerouslySetInnerHTML={{ __html: addedByHtml }} />
                  </div>
                  <div className={styles.creditLine} title="Silhouette credit">
                    <span className={styles.creditIcon} aria-hidden="true" dangerouslySetInnerHTML={{ __html: WIREFRAME_CUBE_ICON }} />
                    <span dangerouslySetInnerHTML={{ __html: silhouetteHtml }} />
                  </div>
                  <div className={styles.creditLine} title="First seen">
                    {firstSeenBadge}
                    <span dangerouslySetInnerHTML={{ __html: firstSeenHtml }} />
                  </div>
                </div>
                {renderStatRegion(cardStats)}
              </div>
            </div>
            <div className={styles.cardBadgeRow}>
              {cardStats?.status === "ok" && <span className={styles.tierBadge}>{cardStats.attributes.tier}</span>}
              <span className={styles.rarityBadge}>{rarityTier}</span>
            </div>
          </div>
          <div className={`${styles.cardFace} ${styles.cardFaceFront}`}>
            <div className={styles.cardFrontContent} data-front-content>
              <div className={styles.cardFrontGrid} data-front-grid aria-hidden="true" />
              <div className={styles.cardFrontArt} ref={frontArtRef} aria-hidden="true" />
              <div className={styles.creditRow}>
                <div className={styles.creditLine} title="First seen">
                  {firstSeenBadge}
                  <span dangerouslySetInnerHTML={{ __html: firstSeenHtml }} />
                </div>
                {showCreditLine && (
                  <div className={styles.creditLine}>
                    <span className={styles.creditIcon} aria-hidden="true" dangerouslySetInnerHTML={{ __html: WIREFRAME_CUBE_ICON }} />
                    {/* creditLinkHtml is built entirely from this app's own vendored asset metadata and configured CRUD URL — see the vendored creditLinkMarkup's own escaping. */}
                    <span dangerouslySetInnerHTML={{ __html: creditLinkHtml }} />
                  </div>
                )}
              </div>
              <div className={styles.cardFrontHeader}>
                <div className={styles.cardFrontPills}>
                  <span className={styles.rarityBadge}>{rarityTier}</span>
                  {cardStats?.status === "ok" && <span className={styles.tierBadge}>{cardStats.attributes.tier}</span>}
                </div>
                <div className={styles.cardFrontIdentity}>
                  <p className={styles.manufacturerLabel}>{manufacturer ?? UNKNOWN}</p>
                  <h2 className={styles.cardFrontName}>{model ?? manufacturerModel ?? UNKNOWN}</h2>
                  {variant && <p className={styles.variant}>{variant}</p>}
                </div>
              </div>
            </div>
            <div className={styles.frontXpPanel}>{renderXpSummary(cardStats)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

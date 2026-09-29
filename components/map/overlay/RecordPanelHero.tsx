import { useEffect, useRef, useState } from "react";
import styles from "./RecordPanelHero.module.css";
import { fetchAircraftPhoto, type PlanespottersPhoto } from "../planespottersPhoto";
import { splitManufacturerModel } from "./manufacturerModel";
import { getAircraftCrudUrl, buildCrudUrl } from "../constants";
import { buildCompassTrackCard, CARD_COMPASS_TRACK_SLOT_ID } from "./compassCard/vendor/core";
import { mountCompassTrackCard, type CompassTrackCardHandle } from "./compassCard/vendor/compassTrackThree";
import { getCompassTrackModel } from "./compassCard/compassTrackModel";
import { buildCompassTrackState, type CompassTrackTelemetryInput } from "./compassCard/compassTrackState";
import type { RarityTier } from "../aircraftRarity";

const UNKNOWN = "Unknown";

function computeAge(year: string | undefined): string {
  if (!year) return UNKNOWN;
  const parsed = parseInt(year, 10);
  if (!Number.isFinite(parsed)) return UNKNOWN;
  const age = new Date().getFullYear() - parsed;
  return age >= 0 ? `${age} yr` : UNKNOWN;
}

/** FAA registry lookup for a US tail number — the FAA's `NNumberResult`
 * endpoint keys on the number with its leading "N" stripped. Returns
 * `undefined` for registrations that aren't recognizably a US N-number, so
 * the heading falls back to plain (non-link) text rather than linking to a
 * lookup that can't resolve. */
/**
 * Resolves a registration to its national civil-registry lookup, when the
 * mark is recognizable as one we know how to link. Currently covers US
 * N-numbers (FAA) and Canadian C-numbers (Transport Canada CCARCS) — other
 * marks fall through to a plain, non-linked heading.
 */
function registryHref(registration: string | undefined): string | undefined {
  if (!registration) return undefined;
  const trimmed = registration.trim();

  const us = /^N(\d[\dA-Z]{0,4})$/i.exec(trimmed);
  if (us) {
    return `https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${us[1].toUpperCase()}`;
  }

  const canada = /^C-([A-Z]{4})$/i.exec(trimmed);
  if (canada) {
    return `https://wwwapps.tc.gc.ca/Saf-Sec-Sur/2/CCARCS-RIACC/RchHsRes.aspx?mh=${canada[1].toUpperCase()}`;
  }

  return undefined;
}

/**
 * Square-corner panel: top-right "AIRFRAME" tab, left image area, right
 * identity block (kicker, registration heading — clickable through to the
 * national civil registry for recognizable marks, see `registryHref`, with
 * an adjacent "Edit" control per `aircraft-record-edit-links` — `CALL //
 * {callsign}` / `ICAO // {hex}` sublines, bordered 2-col spec grid).
 * Reflows between portrait/landscape based on its own measured container
 * aspect ratio via `ResizeObserver` — not a viewport media query
 * (aircraft-info-overlay spec's "Layout reflows by measured container
 * aspect, not viewport" scenario).
 *
 * The image area loads a real aircraft photo from Planespotters.net's
 * public Photo API (`planespottersPhoto.ts`) keyed by hex, re-fetching
 * whenever the selected aircraft changes. When a photo exists it's shown by
 * default (per Planespotters' terms of use, the photographer credit and a
 * plain link back to the photo's page are always shown together with it);
 * when none exists, the live compass card (`airframe-compass-card`
 * capability — `plens-win/Card`'s `compass-track` kind, vendored under
 * `./compassCard/`) is shown instead of a bare placeholder. A toggle switches
 * between the two once both are available for the current selection (see
 * `showToggle` below).
 */
export function RecordPanelHero({
  registration,
  callsign,
  hex,
  manufacturerModel,
  operator,
  year,
  typeDesignator,
  category,
  rarityTier,
  track,
  verticalRate,
  altitude,
  groundSpeed,
  lat,
  lon,
}: {
  registration?: string;
  callsign?: string;
  hex: string;
  manufacturerModel?: string;
  operator?: string;
  year?: string;
  /** ICAO type designator — resolves the compass card's vendored `.glb`
   * model (per `aircraftModels.ts`, see `airframe-compass-card` capability). */
  typeDesignator?: string;
  /** ADS-B emitter category — the compass card's model-resolution fallback
   * when `typeDesignator` isn't available (same resolution `PlaneCard`'s
   * front-face art and the map's own aircraft rendering already use). */
  category?: string;
  /** Drives the compass card's emissive tint (`RARITY_TIER_STYLES`). */
  rarityTier: RarityTier;
  /** Live telemetry — feeds the compass card's `CompassTrackState` via
   * `buildCompassTrackState`. */
  track?: number;
  verticalRate?: number;
  altitude?: number;
  groundSpeed?: number;
  lat?: number;
  lon?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [landscape, setLandscape] = useState(true);
  const [photoForHex, setPhotoForHex] = useState<{ hex: string; photo: PlanespottersPhoto | null } | null>(null);
  const photo = photoForHex?.hex === hex ? photoForHex.photo : null;
  const photoResolved = photoForHex?.hex === hex;

  // "photo" | "compass" — defaults per-hex to photo when one exists, else
  // compass; resets on hex change rather than preserving a manual toggle
  // across different aircraft (design.md's "RecordPanelHero owns view-mode
  // state" decision).
  const [viewModeForHex, setViewModeForHex] = useState<{ hex: string; mode: "photo" | "compass" } | null>(null);
  const viewMode =
    viewModeForHex?.hex === hex ? viewModeForHex.mode : photo ? "photo" : "compass";

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setLandscape(width >= height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAircraftPhoto(hex).then((result) => {
      if (!cancelled) setPhotoForHex({ hex, photo: result });
    });
    return () => {
      cancelled = true;
    };
  }, [hex]);

  const compassContainerRef = useRef<HTMLDivElement | null>(null);
  const compassHandleRef = useRef<CompassTrackCardHandle | null>(null);
  const telemetry: CompassTrackTelemetryInput = { track, verticalRate, altitude, groundSpeed, lat, lon };

  // Mounts the live compass-card scene whenever the compass view becomes
  // active for this hex; disposed on hex change, view-mode switch away from
  // compass, or unmount (design.md: "mountCompassTrackCard's handle is
  // disposed ... never left running invisibly"). The mount slot is found by
  // its stable exported id within the just-rendered `buildCompassTrackCard`
  // markup (dangerouslySetInnerHTML), rather than a direct React ref, since
  // that markup is a raw HTML string this app doesn't own the DOM nodes of.
  useEffect(() => {
    if (viewMode !== "compass") return;
    const slot = compassContainerRef.current?.querySelector<HTMLElement>(`#${CARD_COMPASS_TRACK_SLOT_ID}`);
    if (!slot) return;
    const model = getCompassTrackModel(typeDesignator, category, undefined, rarityTier);
    const handle = mountCompassTrackCard(slot, model, buildCompassTrackState(telemetry));
    compassHandleRef.current = handle;
    return () => {
      handle.dispose();
      compassHandleRef.current = null;
    };
    // Telemetry updates are pushed via the effect below through the mounted
    // handle's own `update()`, not by remounting — this effect only reacts
    // to what should actually cause a remount (hex/view/type change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex, viewMode, typeDesignator, category, rarityTier]);

  useEffect(() => {
    compassHandleRef.current?.update(buildCompassTrackState(telemetry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, verticalRate, altitude, groundSpeed, lat, lon]);

  const compassCardHtml = buildCompassTrackCard({
    kind: "compass-track",
    model: getCompassTrackModel(typeDesignator, category, undefined, rarityTier),
    initialState: buildCompassTrackState(telemetry),
  });

  const registryLookupHref = registryHref(registration);
  const { manufacturer, model } = splitManufacturerModel(manufacturerModel);
  const aircraftCrudUrlTemplate = getAircraftCrudUrl();
  const aircraftEditHref = aircraftCrudUrlTemplate
    ? buildCrudUrl(aircraftCrudUrlTemplate, { hex })
    : undefined;

  // The toggle only makes sense once there's something to switch *to* —
  // with no photo, the compass card is the only view and there's nothing to
  // toggle (design.md/spec: "Photo/compass toggle switches the image
  // area's view").
  const showToggle = photoResolved && photo !== null;

  return (
    <div
      ref={containerRef}
      className={styles.panel}
      data-orientation={landscape ? "landscape" : "portrait"}
    >
      <div className={styles.tab}>AIRFRAME</div>
      <div className={styles.body}>
        {viewMode === "photo" && photo ? (
          <a
            className={styles.photoBlock}
            href={photo.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image's optimizer would proxy/resize this through our own server, which Planespotters' Photo API terms explicitly forbid ("must be loaded by the end user's browser from the thumbnail ... URLs we return"; "Proxying, rewriting ... is not permitted"). */}
            <img className={styles.photoImg} src={photo.thumbnailLargeSrc} alt={`Aircraft photo by ${photo.photographer}`} />
            <span className={styles.photoCaption}>
              Photo by {photo.photographer} · Planespotters.net
            </span>
          </a>
        ) : (
          <div
            className={styles.photoBlock}
            ref={compassContainerRef}
            dangerouslySetInnerHTML={{ __html: compassCardHtml }}
          />
        )}
        {showToggle && (
          <button
            type="button"
            className={styles.viewToggle}
            onClick={() => setViewModeForHex({ hex, mode: viewMode === "photo" ? "compass" : "photo" })}
            aria-label={viewMode === "photo" ? "Switch to compass view" : "Switch to photo view"}
          >
            {viewMode === "photo" ? "Compass" : "Photo"}
          </button>
        )}
        <div className={styles.identity}>
          <div className={styles.kicker}>Registration</div>
          <div className={styles.headingRow}>
            {registryLookupHref ? (
              <a
                className={styles.heading}
                href={registryLookupHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Look up this tail number in the national civil aircraft registry"
              >
                {registration}
              </a>
            ) : (
              <div className={styles.heading}>{registration ?? UNKNOWN}</div>
            )}
            {aircraftEditHref && (
              <a
                className={styles.editButton}
                href={aircraftEditHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Edit this aircraft's record"
              >
                Edit
              </a>
            )}
          </div>
          <p className={styles.subline}>CALL // {callsign ?? UNKNOWN}</p>
          <p className={styles.subline}>
            ICAO //{" "}
            <a
              className={styles.sublineLink}
              href={`https://adsb.win/aircraft/${encodeURIComponent(hex.toLowerCase())}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View this aircraft on adsb.win"
            >
              {hex.toUpperCase()}
            </a>
          </p>
          <div className={styles.specGrid}>
            <SpecCell label="Manufacturer" value={manufacturer ?? UNKNOWN} />
            <SpecCell label="Model" value={model ?? UNKNOWN} />
            <SpecCell label="Operator" value={operator ?? UNKNOWN} />
            <SpecCell label="Age" value={computeAge(year)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.specCell}>
      <div className={styles.specLabel}>{label}</div>
      <div className={styles.specValue}>{value}</div>
    </div>
  );
}

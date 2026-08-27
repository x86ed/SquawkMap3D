import { useEffect, useRef, useState } from "react";
import styles from "./RecordPanelHero.module.css";
import { fetchAircraftPhoto, type PlanespottersPhoto } from "../planespottersPhoto";

const UNKNOWN = "Unknown";

function computeAge(year: string | undefined): string {
  if (!year) return UNKNOWN;
  const parsed = parseInt(year, 10);
  if (!Number.isFinite(parsed)) return UNKNOWN;
  const age = new Date().getFullYear() - parsed;
  return age >= 0 ? `${age} yr` : UNKNOWN;
}

/**
 * Square-corner panel: top-right "AIRFRAME / {hex}" tab, left image area,
 * right identity block (kicker, registration heading, callsign, hex, 2-col
 * spec grid). Reflows between portrait/landscape based on its own measured
 * container aspect ratio via `ResizeObserver` — not a viewport media query
 * (aircraft-info-overlay spec's "Layout reflows by measured container
 * aspect, not viewport" scenario).
 *
 * The image area loads a real aircraft photo from Planespotters.net's
 * public Photo API (`planespottersPhoto.ts`) keyed by hex, re-fetching
 * whenever the selected aircraft changes; falls back to the plane-icon
 * placeholder while loading or when no photo is found. Per Planespotters'
 * terms of use, the photographer credit and a plain link back to the
 * photo's page are always shown together with the image.
 */
export function RecordPanelHero({
  registration,
  callsign,
  hex,
  manufacturerModel,
  operator,
  year,
}: {
  registration?: string;
  callsign?: string;
  hex: string;
  manufacturerModel?: string;
  operator?: string;
  year?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [landscape, setLandscape] = useState(true);
  const [photoForHex, setPhotoForHex] = useState<{ hex: string; photo: PlanespottersPhoto | null } | null>(null);
  const photo = photoForHex?.hex === hex ? photoForHex.photo : null;

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

  return (
    <div
      ref={containerRef}
      className={styles.panel}
      data-orientation={landscape ? "landscape" : "portrait"}
    >
      <div className={styles.tab}>AIRFRAME / {hex}</div>
      <div className={styles.body}>
        {photo ? (
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
          <div className={styles.iconBlock} aria-hidden="true">
            ✈
          </div>
        )}
        <div className={styles.identity}>
          <div className={styles.kicker}>Registration</div>
          <div className={styles.heading}>{registration ?? UNKNOWN}</div>
          <div className={styles.subline}>
            <span>{callsign ?? UNKNOWN}</span>
            <span>{hex.toUpperCase()}</span>
          </div>
          <div className={styles.specGrid}>
            <SpecCell label="Manufacturer" value={manufacturerModel ?? UNKNOWN} />
            <SpecCell label="Model" value={manufacturerModel ?? UNKNOWN} />
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

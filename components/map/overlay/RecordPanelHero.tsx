import { useEffect, useRef, useState } from "react";
import styles from "./RecordPanelHero.module.css";

const UNKNOWN = "Unknown";

function computeAge(year: string | undefined): string {
  if (!year) return UNKNOWN;
  const parsed = parseInt(year, 10);
  if (!Number.isFinite(parsed)) return UNKNOWN;
  const age = new Date().getFullYear() - parsed;
  return age >= 0 ? `${age} yr` : UNKNOWN;
}

/**
 * Square-corner panel: top-right "AIRFRAME / {hex}" tab, left icon
 * placeholder block, right identity block (kicker, registration heading,
 * callsign, hex, 2-col spec grid). Reflows between portrait/landscape based
 * on its own measured container aspect ratio via `ResizeObserver` — not a
 * viewport media query (aircraft-info-overlay spec's "Layout reflows by
 * measured container aspect, not viewport" scenario).
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

  return (
    <div
      ref={containerRef}
      className={styles.panel}
      data-orientation={landscape ? "landscape" : "portrait"}
    >
      <div className={styles.tab}>AIRFRAME / {hex}</div>
      <div className={styles.body}>
        <div className={styles.iconBlock} aria-hidden="true">
          ✈
        </div>
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

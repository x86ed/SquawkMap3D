import styles from "./TelemetryMarquee.module.css";

// Dead-zone around zero for the vertical-rate trend indicator (design.md's
// "tune threshold during implementation" note, tasks.md 10.3) — small
// enough that a genuinely climbing/descending aircraft still reads as such,
// large enough that ADS-B noise around level flight doesn't flicker between
// climbing/descending glyphs.
const VERTICAL_RATE_LEVEL_THRESHOLD_FPM = 100;

function verticalRateTrend(verticalRate: number | undefined): string {
  if (verticalRate === undefined) return "";
  if (verticalRate > VERTICAL_RATE_LEVEL_THRESHOLD_FPM) return "↑";
  if (verticalRate < -VERTICAL_RATE_LEVEL_THRESHOLD_FPM) return "↓";
  return "→";
}

interface TelemetryMarqueeProps {
  altitude?: number;
  groundSpeed?: number;
  track?: number;
  verticalRate?: number;
  squawk?: string;
  distanceNm?: number;
  secondsSinceLastMessage?: number;
}

function buildItems(props: TelemetryMarqueeProps): string[] {
  const items: string[] = [];
  if (props.altitude !== undefined) items.push(`ALT ${Math.round(props.altitude)} FT`);
  if (props.groundSpeed !== undefined) items.push(`GS ${Math.round(props.groundSpeed)} KT`);
  if (props.track !== undefined) items.push(`HDG ${Math.round(props.track)}°`);
  if (props.verticalRate !== undefined) {
    items.push(`V/S ${verticalRateTrend(props.verticalRate)} ${Math.round(props.verticalRate)} FPM`);
  }
  if (props.squawk) items.push(`SQK ${props.squawk}`);
  if (props.distanceNm !== undefined) items.push(`DIST ${props.distanceNm.toFixed(1)} NM`);
  if (props.secondsSinceLastMessage !== undefined) {
    items.push(`SEEN ${Math.round(props.secondsSinceLastMessage)}s`);
  }
  return items;
}

/**
 * Monospace (`var(--font-geist-mono)`, design.md Decision 11) scrolling
 * ticker of live telemetry, built as a duplicated-content CSS `@keyframes`
 * infinite scroll — no JS animation loop. Missing values are simply omitted
 * (never a fabricated number, aircraft-info-overlay spec's "Missing
 * telemetry value omitted, not fabricated" scenario). Pauses on hover/focus
 * via CSS `:hover`/`:focus-within`, no JS needed.
 */
export function TelemetryMarquee(props: TelemetryMarqueeProps) {
  const items = buildItems(props);

  if (items.length === 0) {
    return <div className={styles.marquee}>No telemetry available</div>;
  }

  const text = items.join("   •   ");

  return (
    <div className={styles.marquee} tabIndex={0}>
      <div className={styles.track}>
        <span className={styles.segment}>{text}</span>
        <span className={styles.segment} aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}

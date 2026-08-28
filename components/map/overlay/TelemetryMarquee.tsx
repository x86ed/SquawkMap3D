import { useEffect, useRef, useState } from "react";
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

interface TelemetryPair {
  k: string;
  v: string;
}

/** Structured `k`/`v` pairs, each rendered as its own dimmed-key/bright-value
 * span (rather than one flat joined string) so the key reads as a label and
 * the value as data — missing values are simply omitted, never fabricated
 * (aircraft-info-overlay spec's "Missing telemetry value omitted, not
 * fabricated" scenario). */
function buildPairs(props: TelemetryMarqueeProps): TelemetryPair[] {
  const pairs: TelemetryPair[] = [];
  if (props.altitude !== undefined) pairs.push({ k: "ALT", v: `${Math.round(props.altitude)} FT` });
  if (props.groundSpeed !== undefined) pairs.push({ k: "GS", v: `${Math.round(props.groundSpeed)} KT` });
  if (props.track !== undefined) pairs.push({ k: "HDG", v: `${Math.round(props.track)}°` });
  if (props.verticalRate !== undefined) {
    pairs.push({ k: "V/S", v: `${verticalRateTrend(props.verticalRate)} ${Math.round(props.verticalRate)} FPM` });
  }
  if (props.squawk) pairs.push({ k: "SQK", v: props.squawk });
  if (props.distanceNm !== undefined) pairs.push({ k: "DIST", v: `${props.distanceNm.toFixed(1)} NM` });
  if (props.secondsSinceLastMessage !== undefined) {
    pairs.push({ k: "SEEN", v: `${Math.round(props.secondsSinceLastMessage)}s` });
  }
  return pairs;
}

/**
 * Monospace (`var(--font-geist-mono)`, design.md Decision 11) scrolling
 * ticker of live telemetry, built as a duplicated-content CSS `@keyframes`
 * infinite scroll — no JS animation loop. Missing values are simply omitted
 * (never a fabricated number, aircraft-info-overlay spec's "Missing
 * telemetry value omitted, not fabricated" scenario). Pauses on hover/focus
 * via CSS `:hover`/`:focus-within`, no JS needed.
 */
/** How many times `.segment` must repeat so the track's total content width
 * always covers at least twice the marquee's own visible width — the
 * minimum needed for the loop to look continuous at every point in the
 * cycle. Two hard-coded copies (the obvious approach) only holds up when a
 * single copy is already wider than the marquee itself; a wide drawer with
 * few telemetry values (some are simply omitted — see `buildPairs`) has a
 * copy narrower than that, and the track runs out of content before it
 * reaches the marquee's right edge, reading as the ticker stopping instead
 * of wrapping. */
function computeRequiredCopies(containerWidth: number, segmentWidth: number): number {
  if (segmentWidth <= 0 || containerWidth <= 0) return 2;
  return Math.max(2, Math.ceil(containerWidth / segmentWidth) + 1);
}

export function TelemetryMarquee(props: TelemetryMarqueeProps) {
  const pairs = buildPairs(props);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const segmentRef = useRef<HTMLDivElement | null>(null);
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const container = containerRef.current;
    const segment = segmentRef.current;
    if (!container || !segment) return;

    const recompute = () => {
      setCopies(computeRequiredCopies(container.clientWidth, segment.scrollWidth));
    };

    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    observer.observe(segment);
    recompute();
    return () => observer.disconnect();
  }, [pairs.length]);

  if (pairs.length === 0) {
    return <div className={styles.marquee}>No telemetry available</div>;
  }

  return (
    <div className={styles.marquee} tabIndex={0} ref={containerRef}>
      <div
        className={styles.track}
        style={{ "--marquee-shift": `${100 / copies}%` } as React.CSSProperties}
      >
        {Array.from({ length: copies }, (_, copy) => (
          <div className={styles.segment} key={copy} aria-hidden={copy !== 0} ref={copy === 0 ? segmentRef : undefined}>
            {pairs.map((pair, i) => (
              <span className={styles.pair} key={`${copy}-${i}`}>
                <span className={styles.k}>{pair.k}</span>
                <span className={styles.v}>{pair.v}</span>
                <span className={styles.dot}>·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

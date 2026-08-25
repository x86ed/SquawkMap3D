import styles from "./FlightInfoPane.module.css";
import type { FlightRoute } from "../flightRoute";
import type { SparklinePoint } from "./selectedAircraftInfo";

const SPARKLINE_WIDTH = 240;
const SPARKLINE_HEIGHT = 40;

/** Builds an SVG polyline `points` string from `series`, normalized to the
 * series' own observed min/max (never a shared/global scale — each
 * sparkline is independently normalized per the aircraft-info-overlay
 * spec). A flat series (min === max) renders as a horizontal mid-line
 * rather than dividing by zero. */
function sparklinePoints(series: SparklinePoint[]): string {
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return series
    .map((point, index) => {
      const x = (index / (series.length - 1)) * SPARKLINE_WIDTH;
      const y = range === 0 ? SPARKLINE_HEIGHT / 2 : SPARKLINE_HEIGHT - ((point.value - min) / range) * SPARKLINE_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const SPARKLINE_SERIES: { key: "altitude" | "groundSpeed"; label: string; color: string }[] = [
  { key: "altitude", label: "Altitude", color: "#06b6d4" },
  { key: "groundSpeed", label: "Ground speed", color: "#22c55e" },
];

/** Both series drawn into one shared SVG canvas so altitude and ground
 * speed overlap on the same plot rather than stacking as separate charts —
 * each still independently normalized to its own min/max, since the two
 * are on unrelated scales (feet vs. knots) and only their shapes, not a
 * shared axis, are meaningful together. */
function OverlaySparkline({ altitudeSeries, groundSpeedSeries }: { altitudeSeries: SparklinePoint[]; groundSpeedSeries: SparklinePoint[] }) {
  const seriesByKey = { altitude: altitudeSeries, groundSpeed: groundSpeedSeries };
  const hasAnyData = SPARKLINE_SERIES.some(({ key }) => seriesByKey[key].length >= 2);

  return (
    <div className={styles.sparklineBlock}>
      <div className={styles.sparklineLegend}>
        {SPARKLINE_SERIES.map(({ key, label, color }) => (
          <span key={key} className={styles.sparklineLegendItem}>
            <span className={styles.sparklineSwatch} style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
      {hasAnyData ? (
        <svg
          viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          className={styles.sparklineSvg}
          preserveAspectRatio="none"
        >
          {SPARKLINE_SERIES.map(({ key, color }) => {
            const series = seriesByKey[key];
            if (series.length < 2) return null;
            return <polyline key={key} points={sparklinePoints(series)} fill="none" stroke={color} strokeWidth={2} />;
          })}
        </svg>
      ) : (
        <div className={styles.noDataState}>Not enough data yet</div>
      )}
    </div>
  );
}

function formatSessionTimestamp(timestamp: number | undefined): string {
  if (timestamp === undefined) return "unknown";
  return new Date(timestamp).toLocaleTimeString();
}

function RouteBand({
  route,
  firstSeenThisSessionAt,
}: {
  route: FlightRoute | null;
  firstSeenThisSessionAt: number | undefined;
}) {
  if (!route) {
    return <div className={styles.noDataState}>No route data available</div>;
  }

  return (
    <div className={styles.routeBand}>
      <div className={styles.routeEndpoints}>
        <span>{route.origin ?? "Unknown"}</span>
        <span className={styles.routeArrow}>→</span>
        <span>{route.destination ?? "Unknown"}</span>
      </div>
      <div className={styles.routeTimeline}>
        First seen this session: {formatSessionTimestamp(firstSeenThisSessionAt)}
      </div>
    </div>
  );
}

/**
 * Dual sparkline (altitude + ground speed, independently normalized) built
 * from the extended track buffer, plus a route-progress/timeline band
 * sourced from `info.route` (design.md Decision 12) — an explicit
 * "no route data available" state when no route was found, never
 * fabricated values (aircraft-info-overlay spec's "Route/timeline shows an
 * explicit no-data state when no route is found" scenario).
 */
export function FlightInfoPane({
  altitudeSeries,
  groundSpeedSeries,
  route,
  firstSeenThisSessionAt,
}: {
  altitudeSeries: SparklinePoint[];
  groundSpeedSeries: SparklinePoint[];
  route: FlightRoute | null;
  firstSeenThisSessionAt: number | undefined;
}) {
  return (
    <div className={styles.pane}>
      <OverlaySparkline altitudeSeries={altitudeSeries} groundSpeedSeries={groundSpeedSeries} />
      <RouteBand route={route} firstSeenThisSessionAt={firstSeenThisSessionAt} />
    </div>
  );
}

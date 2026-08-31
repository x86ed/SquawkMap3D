import { useRef, useState, type MouseEvent } from "react";
import styles from "./FlightInfoPane.module.css";
import type { FlightRoute } from "../flightRoute";
import type { SparklinePoint } from "./selectedAircraftInfo";

const SPARKLINE_WIDTH = 240;
const SPARKLINE_HEIGHT = 60;
const SPARKLINE_GRID_DOT_SPACING = 12;

/** Maps a data value to its plot-space `y` pixel for a given `[min, max]`
 * domain — the single source of truth shared by the polyline itself, its
 * gridline rows, and hover markers, so none of the three can visually
 * drift apart from one another. */
function valueToY(value: number, [domainMin, domainMax]: [number, number]): number {
  const clamped = Math.min(domainMax, Math.max(domainMin, value));
  return SPARKLINE_HEIGHT - ((clamped - domainMin) / (domainMax - domainMin)) * SPARKLINE_HEIGHT;
}

/** Builds an SVG polyline `points` string from `series`, scaled against a
 * fixed `[min, max]` domain (not the series' own observed range) so the
 * altitude and ground-speed lines are readable against their labeled axes
 * below rather than each auto-stretching to fill the plot. */
function sparklinePoints(series: SparklinePoint[], domain: [number, number]): string {
  return series
    .map((point, index) => {
      const x = (index / (series.length - 1)) * SPARKLINE_WIDTH;
      const y = valueToY(point.value, domain);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const SPARKLINE_SERIES: {
  key: "altitude" | "groundSpeed";
  label: string;
  color: string;
  /** Domain max when the series hasn't exceeded it — the axis doesn't
   * grow until the aircraft actually flies past this. */
  defaultMax: number;
  /** Once the series' own peak exceeds `defaultMax`, the domain max grows
   * to peak + this padding, so the line never touches the very top. */
  growthPadding: number;
  unit: string;
  tickCount: number;
  /** Low-alpha derivative of `color`, used for this axis's gridline rows
   * (design.md Decision 2) — reuses the axis's own legend swatch rather
   * than an unrelated new color. */
  gridColor: string;
  /** "line" for a continuous faint stroke per tick, "dots" for discrete
   * circle markers per tick — kept visually distinguishable per axis. */
  gridStyle: "line" | "dots";
}[] = [
  {
    key: "altitude",
    label: "Altitude",
    color: "#06b6d4",
    defaultMax: 40000,
    growthPadding: 1000,
    unit: "ft",
    tickCount: 5,
    gridColor: "rgba(6, 182, 212, 0.22)",
    gridStyle: "line",
  },
  {
    key: "groundSpeed",
    label: "Ground speed",
    color: "#22c55e",
    defaultMax: 600,
    growthPadding: 100,
    unit: "kt",
    tickCount: 5,
    gridColor: "rgba(34, 197, 94, 0.55)",
    gridStyle: "dots",
  },
];

/** `[0, defaultMax]` unless the series' own peak value has grown past
 * `defaultMax`, in which case the domain grows to `peak + growthPadding`. */
function computeDomain(series: SparklinePoint[], defaultMax: number, growthPadding: number): [number, number] {
  const seriesMax = series.length === 0 ? 0 : Math.max(...series.map((p) => p.value));
  return [0, Math.max(defaultMax, seriesMax + growthPadding)];
}

/** Evenly spaced tick values from the domain max down to its min (top to
 * bottom, matching the plot's y-axis direction) — e.g. [100000, 75000,
 * 50000, 25000, 0] for a 5-tick, 0–100000 domain. */
function axisTicks([domainMin, domainMax]: [number, number], tickCount: number): number[] {
  const step = (domainMax - domainMin) / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, i) => domainMax - i * step);
}

/** Plot-space `y` positions for a gridline row at each of the axis's own
 * tick values — the exact same `domain`/`tickCount` inputs (and `valueToY`
 * mapping) already used for that axis's label column, so the grid can
 * never desync from the labels it lines up with. */
function buildGridRows(domain: [number, number], tickCount: number): number[] {
  return axisTicks(domain, tickCount).map((tick) => valueToY(tick, domain));
}

/** Cursor fraction (`0..1` across the plot's rendered width) to an index
 * into a series of `length` evenly index-spaced points — `null` for an
 * empty series, since there's no index to resolve to. */
export function cursorIndexFromFraction(length: number, fraction: number): number | null {
  if (length === 0) return null;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * (length - 1));
}

/** The point in `series` whose `timestamp` is closest to `timestamp` — used
 * to look up the non-reference series' value at a hovered x position, since
 * the two series don't share an index space (design.md Decision 3). */
export function nearestPointByTimestamp(series: SparklinePoint[], timestamp: number): SparklinePoint | undefined {
  if (series.length === 0) return undefined;
  return series.reduce((closest, point) =>
    Math.abs(point.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp) ? point : closest,
  );
}

/** Both series drawn into one shared SVG canvas, overlapping rather than
 * stacking as separate charts, each plotted against its own labeled y-axis
 * — a shared canvas but never a shared scale, since the two are on
 * unrelated units. Each axis's domain defaults to a fixed max (altitude
 * 40,000 ft, ground speed 600 kt) and grows dynamically once the aircraft's
 * own observed peak exceeds it (to peak + 1,000 ft / peak + 100 kt), so the
 * scale only stretches when the aircraft actually demands it. Each axis's
 * tick labels are color-coded to match its line. */
function OverlaySparkline({ altitudeSeries, groundSpeedSeries }: { altitudeSeries: SparklinePoint[]; groundSpeedSeries: SparklinePoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  const seriesByKey = { altitude: altitudeSeries, groundSpeed: groundSpeedSeries };
  const hasAnyData = SPARKLINE_SERIES.some(({ key }) => seriesByKey[key].length >= 2);
  const domains = SPARKLINE_SERIES.map(({ key, defaultMax, growthPadding }) =>
    computeDomain(seriesByKey[key], defaultMax, growthPadding),
  );
  const domainByKey = { altitude: domains[0], groundSpeed: domains[1] };
  const colorByKey = { altitude: SPARKLINE_SERIES[0].color, groundSpeed: SPARKLINE_SERIES[1].color };

  // Reference series (Decision 3): whichever has more points gets an exact,
  // index-based crosshair/marker position; the other is matched by nearest
  // timestamp since the two aren't spaced on a shared x-axis.
  const referenceKey: "altitude" | "groundSpeed" = altitudeSeries.length >= groundSpeedSeries.length ? "altitude" : "groundSpeed";
  const otherKey: "altitude" | "groundSpeed" = referenceKey === "altitude" ? "groundSpeed" : "altitude";
  const referenceSeries = seriesByKey[referenceKey];
  const otherSeries = seriesByKey[otherKey];

  const cursorIndex = hoverFraction !== null ? cursorIndexFromFraction(referenceSeries.length, hoverFraction) : null;
  const referencePoint = cursorIndex !== null ? referenceSeries[cursorIndex] : null;
  const otherPoint = referencePoint ? (nearestPointByTimestamp(otherSeries, referencePoint.timestamp) ?? null) : null;
  const crosshairX = cursorIndex !== null ? (cursorIndex / (referenceSeries.length - 1)) * SPARKLINE_WIDTH : null;

  const altitudePoint = referenceKey === "altitude" ? referencePoint : otherPoint;
  const groundSpeedPoint = referenceKey === "groundSpeed" ? referencePoint : otherPoint;

  function handleMouseMove(event: MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    setHoverFraction(Math.min(1, Math.max(0, fraction)));
  }

  function handleMouseLeave() {
    setHoverFraction(null);
  }

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
        <div className={styles.sparklineRow}>
          <div className={styles.axisColumn} style={{ color: SPARKLINE_SERIES[0].color }}>
            {axisTicks(domains[0], SPARKLINE_SERIES[0].tickCount).map((tick) => {
              const rounded = Math.round(tick);
              return <span key={tick}>{rounded >= 1000 ? `${(rounded / 1000).toFixed(1)}k` : rounded}</span>;
            })}
          </div>
          <div className={styles.sparklineSvgWrap}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
              className={styles.sparklineSvg}
              preserveAspectRatio="none"
            >
              {SPARKLINE_SERIES.map((seriesDef, i) => {
                const series = seriesByKey[seriesDef.key];
                if (series.length < 2) return null;
                const rows = buildGridRows(domains[i], seriesDef.tickCount);
                if (seriesDef.gridStyle === "line") {
                  return rows.map((y, rowIndex) => (
                    <line
                      key={`${seriesDef.key}-grid-${rowIndex}`}
                      x1={0}
                      x2={SPARKLINE_WIDTH}
                      y1={y}
                      y2={y}
                      stroke={seriesDef.gridColor}
                      strokeWidth={1}
                    />
                  ));
                }
                const dotXs = [];
                for (let x = 0; x <= SPARKLINE_WIDTH; x += SPARKLINE_GRID_DOT_SPACING) dotXs.push(x);
                return rows.map((y, rowIndex) =>
                  dotXs.map((x, colIndex) => (
                    <circle key={`${seriesDef.key}-grid-${rowIndex}-${colIndex}`} cx={x} cy={y} r={1} fill={seriesDef.gridColor} />
                  )),
                );
              })}
              {SPARKLINE_SERIES.map(({ key, color }, i) => {
                const series = seriesByKey[key];
                if (series.length < 2) return null;
                return <polyline key={key} points={sparklinePoints(series, domains[i])} fill="none" stroke={color} strokeWidth={2} />;
              })}
              {hoverFraction !== null && referencePoint && crosshairX !== null && (
                <>
                  <line x1={crosshairX} x2={crosshairX} y1={0} y2={SPARKLINE_HEIGHT} stroke="rgba(226, 232, 240, 0.35)" strokeWidth={1} />
                  <circle
                    cx={crosshairX}
                    cy={valueToY(referencePoint.value, domainByKey[referenceKey])}
                    r={3}
                    fill={colorByKey[referenceKey]}
                    stroke="#0f1014"
                    strokeWidth={1}
                  />
                  {otherPoint && (
                    <circle
                      cx={crosshairX}
                      cy={valueToY(otherPoint.value, domainByKey[otherKey])}
                      r={3}
                      fill={colorByKey[otherKey]}
                      stroke="#0f1014"
                      strokeWidth={1}
                    />
                  )}
                </>
              )}
              <rect
                x={0}
                y={0}
                width={SPARKLINE_WIDTH}
                height={SPARKLINE_HEIGHT}
                fill="transparent"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </svg>
            {hoverFraction !== null && referencePoint && (
              <div className={styles.hoverTooltip} style={{ left: `${hoverFraction * 100}%` }}>
                <div className={styles.hoverTooltipLine1}>{altitudePoint ? `${Math.round(altitudePoint.value).toLocaleString()} ft` : "—"}</div>
                <div className={styles.hoverTooltipLine2}>{groundSpeedPoint ? `${Math.round(groundSpeedPoint.value)} kt` : "—"}</div>
              </div>
            )}
          </div>
          <div className={styles.axisColumn} style={{ color: SPARKLINE_SERIES[1].color }}>
            {axisTicks(domains[1], SPARKLINE_SERIES[1].tickCount).map((tick) => (
              <span key={tick}>
                {Math.round(tick)} {SPARKLINE_SERIES[1].unit}
              </span>
            ))}
          </div>
        </div>
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

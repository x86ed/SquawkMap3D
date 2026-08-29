import styles from "./ColorModeLegend.module.css";
import { ALL_RARITY_TIERS, rarityTierGradient } from "../aircraftRarity";
import { ALTITUDE_COLOR_STOPS, hexColorToRgb } from "../aircraftIcons";
import type { ColorMode } from "../aircraftIcons";
import { MACH1_APPROX_KTS } from "../constants";
import { AIRPORT_FILL_COLOR } from "../layers";

/**
 * Mirrors `aircraftIcons.ts`'s `airspeedToColor` band thresholds (design.md
 * Decision 3) as explicit knot boundary points — like `ALTITUDE_COLOR_STOPS`,
 * each point is both a gradient color stop and a tick label, positioned
 * proportionally to its real knot value rather than evenly spaced, so the
 * bar reads as an actual scale. Labels are kept short (bare numbers/"kt")
 * — the previous range-text labels ("100-200kt", "400-500kt", …) were wider
 * than their `flex:1` column in a 260px bar and overlapped illegibly under
 * `white-space: nowrap`.
 */
const AIRSPEED_COLOR_STOPS: Array<{ kt: number; rgb: [number, number, number]; label: string }> = [
  { kt: 0, rgb: [148, 148, 148], label: "0" },
  { kt: 100, rgb: [34, 197, 94], label: "100" },
  { kt: 200, rgb: [234, 179, 8], label: "200" },
  { kt: 400, rgb: [249, 115, 22], label: "400" },
  { kt: 500, rgb: [220, 38, 38], label: "500" },
  { kt: MACH1_APPROX_KTS, rgb: [217, 70, 239], label: "M1" },
  // Same airport-icon accent color aircraftIcons.ts's `airspeedToColor`
  // reuses for its supersonic band — kept in sync via the same source
  // rather than a second pinned hex.
  { kt: MACH1_APPROX_KTS + 140, rgb: hexColorToRgb(AIRPORT_FILL_COLOR.light), label: ">M1" },
];

function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Geometry for the airspeed gauge's half-circle arc (a real speedometer
 * look, not a straight bar — see `AirspeedGauge` below). All values in px,
 * relative to the gauge wrapper's own top-left corner. `PIVOT` is the arc's
 * center point (where a real gauge's needle would be mounted, at the bottom
 * of the semicircle); `RADIUS`/`BAND` define the colored ring; `LABEL_RADIUS`
 * sits just outside the ring for the tick labels. Sized with enough margin
 * that labels at the 0/max ends (level with the pivot) and the top-of-arc
 * label don't clip against the wrapper's edges.
 */
const GAUGE_PIVOT = { x: 140, y: 126 };
const GAUGE_RADIUS = 100;
const GAUGE_BAND = 26;
const GAUGE_LABEL_RADIUS = 118;
const GAUGE_WRAPPER_WIDTH = 280;
const GAUGE_WRAPPER_HEIGHT = 150;

/** A stop's position along the gauge's 180° sweep, 0 (left) to 1 (right). */
function gaugeFraction(kt: number, maxKt: number): number {
  return Math.min(1, Math.max(0, kt / maxKt));
}

/** The (x, y) a tick label centers on for a given sweep fraction, sweeping
 * left→top→right exactly like a real speedometer's dial face. */
function gaugeLabelPosition(fraction: number): { x: number; y: number } {
  const angleRad = (fraction * 180 * Math.PI) / 180;
  return {
    x: GAUGE_PIVOT.x - GAUGE_LABEL_RADIUS * Math.cos(angleRad),
    y: GAUGE_PIVOT.y - GAUGE_LABEL_RADIUS * Math.sin(angleRad),
  };
}

/**
 * Half-circle "speedometer" gauge for airspeed color mode — a real dial
 * arch rather than a straight gradient bar, per the acceptance criteria's
 * "look like a speedometer" ask. Built from two nested CSS half-circles (an
 * outer one painted with a `conic-gradient` swept over exactly the visible
 * 180°, an inner one solid-filled with the legend's own background to punch
 * out the ring) rather than SVG — no new rendering dependency, consistent
 * with every other legend variant's plain-CSS approach. Tick labels are
 * positioned by simple trigonometry around the same pivot the arc sweeps
 * around, so they land right at their color's position on the dial.
 */
function AirspeedGauge({ stops }: { stops: typeof AIRSPEED_COLOR_STOPS }) {
  const maxKt = stops[stops.length - 1].kt;
  const gradientStops = stops
    .map((stop) => `${rgbCss(stop.rgb)} ${gaugeFraction(stop.kt, maxKt) * 50}%`)
    .join(", ");

  return (
    <div
      className={styles.gaugeWrapper}
      style={{ width: GAUGE_WRAPPER_WIDTH, height: GAUGE_WRAPPER_HEIGHT }}
    >
      <div
        className={styles.gaugeArc}
        style={{
          width: GAUGE_RADIUS * 2,
          height: GAUGE_RADIUS,
          left: GAUGE_PIVOT.x - GAUGE_RADIUS,
          top: GAUGE_PIVOT.y - GAUGE_RADIUS,
          borderRadius: `${GAUGE_RADIUS}px ${GAUGE_RADIUS}px 0 0`,
          background: `conic-gradient(from 270deg at 50% 100%, ${gradientStops})`,
        }}
      />
      <div
        className={styles.gaugeCutout}
        style={{
          width: (GAUGE_RADIUS - GAUGE_BAND) * 2,
          height: GAUGE_RADIUS - GAUGE_BAND,
          left: GAUGE_PIVOT.x - (GAUGE_RADIUS - GAUGE_BAND),
          top: GAUGE_PIVOT.y - (GAUGE_RADIUS - GAUGE_BAND),
          borderRadius: `${GAUGE_RADIUS - GAUGE_BAND}px ${GAUGE_RADIUS - GAUGE_BAND}px 0 0`,
        }}
      />
      {stops.map((stop) => {
        const { x, y } = gaugeLabelPosition(gaugeFraction(stop.kt, maxKt));
        return (
          <span
            key={stop.kt}
            className={styles.gaugeTick}
            style={{ left: x, top: y }}
          >
            {stop.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Bottom-left legend matching the currently active aircraft color mode
 * (design.md Decisions 2-4): a 9-card rarity-tier row, or a horizontal
 * gradient bar for altitude/airspeed — exactly one variant renders at a
 * time. The altitude bar's gradient and tick labels are built from
 * `ALTITUDE_COLOR_STOPS`, the same table `aircraftIcons.ts`'s
 * `altitudeToColor` uses, so the legend can never drift from the live icon
 * colors.
 */
export function ColorModeLegend({ mode }: { mode: ColorMode }) {
  if (mode === "rarity") {
    return (
      <div className={styles.legend} aria-label="Rarity color legend">
        <div className={styles.rarityRow}>
          {ALL_RARITY_TIERS.map((tier) => (
            <div
              key={tier}
              className={styles.rarityCard}
              style={{ background: rarityTierGradient(tier) }}
              title={capitalize(tier)}
            >
              {capitalize(tier)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "altitude") {
    const gradient = ALTITUDE_COLOR_STOPS.map(
      (stop) => `${rgbCss(stop.rgb)} ${(stop.ft / ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1].ft) * 100}%`,
    ).join(", ");
    return (
      <div className={styles.legend} aria-label="Altitude color legend">
        <div className={styles.gradientBar} style={{ background: `linear-gradient(90deg, ${gradient})` }} />
        <div className={styles.tickRow}>
          {ALTITUDE_COLOR_STOPS.map((stop) => (
            <span key={stop.ft} className={styles.tick}>
              {stop.ft >= ALTITUDE_COLOR_STOPS[ALTITUDE_COLOR_STOPS.length - 1].ft
                ? `${(stop.ft / 1000).toLocaleString()}k+`
                : stop.ft >= 1000
                  ? `${stop.ft / 1000}k`
                  : stop.ft}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // airspeed
  return (
    <div className={styles.legend} aria-label="Airspeed color legend">
      <AirspeedGauge stops={AIRSPEED_COLOR_STOPS} />
    </div>
  );
}

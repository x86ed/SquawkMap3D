import styles from "./ColorModeLegend.module.css";
import { ALL_RARITY_TIERS, rarityTierGradient } from "../aircraftRarity";
import { ALTITUDE_COLOR_STOPS } from "../aircraftIcons";
import type { ColorMode } from "../aircraftIcons";
import { MACH1_APPROX_KTS } from "../constants";

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
  { kt: MACH1_APPROX_KTS + 140, rgb: [255, 20, 147], label: ">M1" },
];

function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const airspeedMaxKt = AIRSPEED_COLOR_STOPS[AIRSPEED_COLOR_STOPS.length - 1].kt;
  const gradient = AIRSPEED_COLOR_STOPS.map(
    (stop) => `${rgbCss(stop.rgb)} ${(stop.kt / airspeedMaxKt) * 100}%`,
  ).join(", ");
  return (
    <div className={styles.legend} aria-label="Airspeed color legend">
      <div
        className={`${styles.gradientBar} ${styles.speedometer}`}
        style={{ background: `linear-gradient(90deg, ${gradient})` }}
      />
      <div className={styles.tickRow}>
        {AIRSPEED_COLOR_STOPS.map((stop) => (
          <span key={stop.kt} className={styles.tick}>
            {stop.label}
          </span>
        ))}
      </div>
    </div>
  );
}

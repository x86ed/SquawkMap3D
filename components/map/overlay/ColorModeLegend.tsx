import styles from "./ColorModeLegend.module.css";
import { ALL_RARITY_TIERS, RARITY_TIER_STYLES } from "../aircraftRarity";
import { ALTITUDE_COLOR_STOPS } from "../aircraftIcons";
import type { ColorMode } from "../aircraftIcons";

const AIRSPEED_STOPS: Array<{ label: string; color: string }> = [
  { label: "Stopped", color: "rgb(148, 148, 148)" },
  { label: "<100kt", color: "rgb(34, 197, 94)" },
  { label: "100-200kt", color: "rgb(234, 179, 8)" },
  { label: "200-400kt", color: "rgb(249, 115, 22)" },
  { label: "400-500kt", color: "rgb(220, 38, 38)" },
  { label: ">500kt", color: "rgb(217, 70, 239)" },
  { label: ">Mach 1", color: "rgb(255, 20, 147)" },
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
              style={{ background: RARITY_TIER_STYLES[tier].color }}
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
  const gradient = AIRSPEED_STOPS.map(
    (stop, i) => `${stop.color} ${(i / (AIRSPEED_STOPS.length - 1)) * 100}%`,
  ).join(", ");
  return (
    <div className={styles.legend} aria-label="Airspeed color legend">
      <div
        className={`${styles.gradientBar} ${styles.speedometer}`}
        style={{ background: `linear-gradient(90deg, ${gradient})` }}
      />
      <div className={styles.tickRow}>
        {AIRSPEED_STOPS.map((stop) => (
          <span key={stop.label} className={styles.tick}>
            {stop.label}
          </span>
        ))}
      </div>
    </div>
  );
}

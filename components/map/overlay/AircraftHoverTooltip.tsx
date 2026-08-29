import styles from "./AircraftHoverTooltip.module.css";
import type { Aircraft } from "../aircraft";

const UNKNOWN = "Unknown";

/**
 * Lightweight hover-only tooltip (design.md Decision 10, aircraft-tracks-layer
 * spec's "Hovering an aircraft shows a quick-info tooltip" requirement) —
 * deliberately separate from `AircraftOverlay`, which stays click-to-select
 * only. Positioned near the cursor via the caller-supplied pixel coordinates
 * (deck.gl's `onHover` picking info), matching the acceptance criteria's
 * reference image: bold `callsign · type` line, `altitude · speed` line.
 */
export function AircraftHoverTooltip({
  aircraft,
  x,
  y,
}: {
  aircraft: Aircraft;
  x: number;
  y: number;
}) {
  return (
    <div
      className={styles.tooltip}
      style={{ left: x + 14, top: y + 14 }}
      role="tooltip"
      aria-hidden="true"
    >
      <div className={styles.line1}>
        {aircraft.callsign ?? aircraft.registration ?? UNKNOWN}
        {aircraft.typeDesignator && (
          <>
            {" "}
            <span className={styles.dot}>·</span> {aircraft.typeDesignator}
          </>
        )}
      </div>
      <div className={styles.line2}>
        {aircraft.altitude !== undefined ? `${aircraft.altitude.toLocaleString()} ft` : UNKNOWN}{" "}
        <span className={styles.dot}>·</span>{" "}
        {aircraft.groundSpeed !== undefined ? `${Math.round(aircraft.groundSpeed)} kt` : UNKNOWN}
      </div>
    </div>
  );
}

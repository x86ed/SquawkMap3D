import styles from "./AircraftOverlay.module.css";
import type { SelectedAircraftInfo } from "./selectedAircraftInfo";
import { PlaneCard } from "./PlaneCard";
import { RecordPanelHero } from "./RecordPanelHero";
import { TelemetryMarquee } from "./TelemetryMarquee";
import { FlightInfoPane } from "./FlightInfoPane";

/**
 * Full-width bottom drawer shown while an aircraft is selected (design.md
 * Decision 9) — a pure layout/open-close/keyboard shell around the four
 * independently-defined components, each fed its own slice of the shared
 * `SelectedAircraftInfo` view-model built in `MapView.tsx`. Stays mounted
 * (toggling an `open` state via CSS) rather than conditionally rendering
 * the whole subtree, so switching the selected aircraft while already open
 * updates in place with no close/reopen flash (aircraft-info-overlay
 * spec's "Switching selected aircraft updates the open overlay" scenario).
 */
export function AircraftOverlay({
  info,
  onClose,
}: {
  info: SelectedAircraftInfo | null;
  onClose: () => void;
}) {
  const open = info !== null;

  return (
    <>
      <div className={styles.drawer} data-open={open} role="dialog" aria-label="Aircraft details">
        {info && (
          <>
            <div className={styles.dragHandle} aria-hidden="true" />
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close aircraft details"
            >
              &times;
            </button>
            <div className={styles.grid}>
              <div className={styles.hero}>
                <RecordPanelHero
                  registration={info.registration}
                  callsign={info.callsign}
                  hex={info.hex}
                  manufacturerModel={info.manufacturerModel}
                  operator={info.operator}
                  year={info.year}
                />
              </div>
              <div className={styles.card}>
                <PlaneCard
                  registration={info.registration}
                  manufacturerModel={info.manufacturerModel}
                  operator={info.operator}
                  rarityTier={info.rarityTier}
                  rarityColor={info.rarityColor}
                />
              </div>
              <div className={styles.flightInfo}>
                <FlightInfoPane
                  altitudeSeries={info.altitudeSeries}
                  groundSpeedSeries={info.groundSpeedSeries}
                  route={info.route}
                  firstSeenThisSessionAt={info.firstSeenThisSessionAt}
                />
              </div>
              <div className={styles.marquee}>
                <TelemetryMarquee
                  altitude={info.altitude}
                  groundSpeed={info.groundSpeed}
                  track={info.track}
                  verticalRate={info.verticalRate}
                  squawk={info.squawk}
                  distanceNm={info.distanceNm}
                  secondsSinceLastMessage={info.secondsSinceLastMessage}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

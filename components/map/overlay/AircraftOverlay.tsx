import { useEffect, useRef, useState } from "react";
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
 *
 * The drawer's own height is resolution-relative (`vh`-based CSS) and must
 * never show a scrollbar in either axis: a `ResizeObserver` compares the
 * grid's actual rendered content extent (`scrollWidth`/`scrollHeight`,
 * unaffected by `transform`) against the box it was actually given
 * (`clientWidth`/`clientHeight`) and applies a uniform `transform: scale()`
 * correction — capped at 1, so the common case where everything already
 * fits renders pixel-identical to an unscaled grid — whenever content would
 * otherwise have overflowed. `.drawer`'s own `overflow: hidden` is the
 * final backstop.
 */
export function AircraftOverlay({
  info,
  onClose,
}: {
  info: SelectedAircraftInfo | null;
  onClose: () => void;
}) {
  const open = info !== null;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    const grid = gridRef.current;
    if (!viewport || !grid) return;

    const recompute = () => {
      const availableWidth = viewport.clientWidth;
      const availableHeight = viewport.clientHeight;
      const contentWidth = grid.scrollWidth;
      const contentHeight = grid.scrollHeight;
      if (availableWidth <= 0 || availableHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
        return;
      }
      setScale(Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight));
    };

    const observer = new ResizeObserver(recompute);
    observer.observe(viewport);
    observer.observe(grid);
    recompute();
    return () => observer.disconnect();
  }, [info]);

  return (
    <>
      <div className={styles.drawer} data-open={open} role="dialog" aria-label="Aircraft details">
        {info && (
          <>
            <button
              type="button"
              className={styles.dragHandle}
              onClick={onClose}
              aria-label="Close aircraft details"
            >
              <span className={styles.dragHandleGrip} aria-hidden="true" />
            </button>
            <div className={styles.scaleViewport} ref={viewportRef}>
              <div
                className={styles.grid}
                ref={gridRef}
                style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
              >
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
                    typeDesignator={info.typeDesignator}
                    manufacturerModel={info.manufacturerModel}
                    rarityTier={info.rarityTier}
                    uniqueRegistrationsCount={info.uniqueRegistrationsCount}
                    flightsCapturedCount={info.flightsCapturedCount}
                    observedFlightTimeSeconds={info.observedFlightTimeSeconds}
                    highestAltitudeObserved={info.highestAltitudeObserved}
                    xp={info.xp}
                    xpProgressToNextTier={info.xpProgressToNextTier}
                    viewRegistrationsHref={info.viewRegistrationsHref}
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
            </div>
          </>
        )}
      </div>
    </>
  );
}

import styles from "./ColorModeLegendDock.module.css";
import { ColorModeLegend } from "./ColorModeLegend";
import type { ColorMode } from "../aircraftIcons";

/**
 * Bottom-right-anchored wrapper around `ColorModeLegend`, kept separate
 * from `AircraftColorDock`'s bottom-left 2-gang control (which the legend
 * previously shared a stack with) so a taller variant — the airspeed
 * speedometer arc — never crowds/overlaps the control buttons. `drawerOpen`
 * drives the same `[data-drawer-open]` repositioning pattern
 * `AircraftColorDock` uses, mirrored to the drawer's top-right edge instead
 * of top-left.
 */
export function ColorModeLegendDock({
  colorMode,
  drawerOpen,
}: {
  colorMode: ColorMode;
  drawerOpen: boolean;
}) {
  return (
    <div className={styles.dock} data-drawer-open={drawerOpen}>
      <ColorModeLegend mode={colorMode} />
    </div>
  );
}

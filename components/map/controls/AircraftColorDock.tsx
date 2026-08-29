import styles from "./AircraftColorDock.module.css";
import { AircraftColorControl } from "./AircraftColorControl";
import type { ColorMode } from "../aircraftIcons";

/**
 * Bottom-left wrapper around the 2-gang control (recenter + color-mode
 * popup). The color-mode legend used to share this stack but was moved to
 * its own bottom-right dock (`ColorModeLegendDock`) so a taller legend
 * variant (the airspeed speedometer arc) never crowds/overlaps these
 * buttons. `drawerOpen` drives the `[data-drawer-open]` CSS rule in
 * `AircraftColorDock.module.css` that repositions this group above the
 * `AircraftOverlay` drawer's top-left edge while it's open (aircraft-color-
 * mode-control spec's "Control repositions when the drawer opens" scenario).
 */
export function AircraftColorDock({
  colorMode,
  onColorModeChange,
  onRecenter,
  drawerOpen,
}: {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  onRecenter: () => void;
  drawerOpen: boolean;
}) {
  return (
    <div className={styles.dock} data-drawer-open={drawerOpen}>
      <AircraftColorControl
        activeMode={colorMode}
        onModeChange={onColorModeChange}
        onRecenter={onRecenter}
      />
    </div>
  );
}

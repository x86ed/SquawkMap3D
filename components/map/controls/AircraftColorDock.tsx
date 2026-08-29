import styles from "./AircraftColorDock.module.css";
import { AircraftColorControl } from "./AircraftColorControl";
import { ColorModeLegend } from "../overlay/ColorModeLegend";
import type { ColorMode } from "../aircraftIcons";

/**
 * Bottom-left group of the 2-gang control + its matching color-mode legend
 * (design.md Decision 5) — a thin layout wrapper so `MapView.tsx` mounts one
 * component rather than positioning the control and legend independently.
 * `drawerOpen` drives the `[data-drawer-open]` CSS rule in
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
      <ColorModeLegend mode={colorMode} />
      <AircraftColorControl
        activeMode={colorMode}
        onModeChange={onColorModeChange}
        onRecenter={onRecenter}
      />
    </div>
  );
}

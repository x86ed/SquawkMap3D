import { forwardRef } from "react";
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
 *
 * Forwards a ref to its root `.dock` element (design.md Decision 4) so
 * `MapView` can measure it against `AircraftColorDock` for collision-aware
 * repositioning.
 */
export const ColorModeLegendDock = forwardRef<
  HTMLDivElement,
  {
    colorMode: ColorMode;
    drawerOpen: boolean;
    /** Whether the layer-control drawer (`LayerDrawer`) is open — distinct
     * from `drawerOpen` above, which reflects the *aircraft* overlay's open
     * state (design.md Decision 5). Drives `[data-layer-drawer-open]`,
     * which hides this dock entirely at the mobile full-screen drawer
     * breakpoint. */
    layerDrawerOpen: boolean;
  }
>(function ColorModeLegendDock({ colorMode, drawerOpen, layerDrawerOpen }, ref) {
  return (
    <div
      ref={ref}
      className={styles.dock}
      data-drawer-open={drawerOpen}
      data-layer-drawer-open={layerDrawerOpen}
    >
      <ColorModeLegend mode={colorMode} />
    </div>
  );
});

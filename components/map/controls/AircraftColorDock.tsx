import { forwardRef, type CSSProperties } from "react";
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
 *
 * Forwards a ref to its root `.dock` element (design.md Decision 4) so
 * `MapView` can measure it against `ColorModeLegendDock` for collision-aware
 * repositioning.
 */
export const AircraftColorDock = forwardRef<
  HTMLDivElement,
  {
    colorMode: ColorMode;
    onColorModeChange: (mode: ColorMode) => void;
    onRecenter: () => void;
    drawerOpen: boolean;
    /** Whether the layer-control drawer (`LayerDrawer`) is open — distinct
     * from `drawerOpen` above, which reflects the *aircraft* overlay's open
     * state (design.md Decision 5). Drives `[data-layer-drawer-open]`,
     * which hides this dock entirely at the mobile full-screen drawer
     * breakpoint. */
    layerDrawerOpen: boolean;
    /** Vertical offset (px) this dock must move up to clear
     * `ColorModeLegendDock` (design.md Decision 4) — `0` when the two are
     * clear of each other. */
    collisionOffsetPx: number;
  }
>(function AircraftColorDock(
  { colorMode, onColorModeChange, onRecenter, drawerOpen, layerDrawerOpen, collisionOffsetPx },
  ref,
) {
  return (
    <div
      ref={ref}
      className={styles.dock}
      data-drawer-open={drawerOpen}
      data-layer-drawer-open={layerDrawerOpen}
      style={{ "--collision-offset": `${collisionOffsetPx}px` } as CSSProperties}
    >
      <AircraftColorControl
        activeMode={colorMode}
        onModeChange={onColorModeChange}
        onRecenter={onRecenter}
      />
    </div>
  );
});

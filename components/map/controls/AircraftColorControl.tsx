"use client";

import { useState } from "react";
import styles from "./AircraftColorControl.module.css";
import type { ColorMode } from "../aircraftIcons";

const MODE_LABELS: Record<ColorMode, string> = {
  rarity: "Rarity",
  altitude: "Altitude",
  airspeed: "Airspeed",
};

const MODE_ORDER: ColorMode[] = ["rarity", "altitude", "airspeed"];

/**
 * Bottom-left "2-gang box" map control (proposal.md's acceptance criteria):
 * button 1 recenters the map, button 2 opens a popup with the three
 * color-mode toggle buttons. Docking against the aircraft details drawer
 * (design.md Decision 5) is handled by the parent wrapper's own
 * `data-drawer-open` CSS, not here.
 */
export function AircraftColorControl({
  activeMode,
  onModeChange,
  onRecenter,
}: {
  activeMode: ColorMode;
  onModeChange: (mode: ColorMode) => void;
  onRecenter: () => void;
}) {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <div className={styles.gangBox}>
      <button
        type="button"
        className={styles.gangButton}
        onClick={onRecenter}
        aria-label="Recenter map"
        title="Recenter map"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 19V5M12 5l-6 6M12 5l6 6"
          />
        </svg>
      </button>
      <div className={styles.popupAnchor}>
        <button
          type="button"
          className={styles.gangButton}
          data-active={popupOpen}
          onClick={() => setPopupOpen((open) => !open)}
          aria-label="Aircraft color mode"
          aria-expanded={popupOpen}
          title="Aircraft color mode"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2.5 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"
            />
          </svg>
        </button>
        {popupOpen && (
          <div className={styles.popup} role="menu" aria-label="Color mode">
            {MODE_ORDER.map((mode) => (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={activeMode === mode}
                className={styles.popupButton}
                data-active={activeMode === mode}
                onClick={() => {
                  onModeChange(mode);
                  setPopupOpen(false);
                }}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

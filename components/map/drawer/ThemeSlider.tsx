import styles from "./ThemeSlider.module.css";
import type { MapTheme } from "../mapStyles";

/**
 * Day/night slider control (layer-control-drawer's "Day/night slider
 * control" requirement) — same underlying theme-toggle behavior as the
 * button it replaces (`handleThemeToggle` in `MapView.tsx`), just a
 * sun/moon slider affordance matching the reference file's `.theme-switch`
 * structure instead of a text button.
 */
export function ThemeSlider({ theme, onToggle }: { theme: MapTheme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <div className={styles.themeSwitch} suppressHydrationWarning>
      <span className={styles.icon} data-dim={isDark} aria-hidden="true">
        <SunIcon />
      </span>
      <button
        type="button"
        className={styles.track}
        onClick={onToggle}
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle day/night theme"
      >
        <span className={styles.knob} data-dark={isDark}>
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </button>
      <span className={styles.icon} data-dim={!isDark} aria-hidden="true">
        <MoonIcon />
      </span>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

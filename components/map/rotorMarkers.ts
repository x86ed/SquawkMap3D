import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { Aircraft } from "./aircraft";
import styles from "./rotorMarker.module.css";

const ROTORCRAFT_CATEGORY = "A7";

const markers = new Map<string, Marker>();

function createRotorElement(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = styles.rotor;
  wrapper.style.color = "#e5e5e5";
  wrapper.innerHTML = `
    <svg class="${styles.disc}" viewBox="0 0 24 24" aria-hidden="true">
      <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </g>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  `;
  return wrapper;
}

/**
 * Adds/updates/removes a MapLibre `Marker` per currently-rendered rotorcraft
 * (ADS-B category A7), each carrying a CSS-animated spinning rotor-disc glyph
 * (design.md Decision 8; aircraft-tracks-layer spec's "Rotorcraft renders a
 * spinning rotor" scenario). Deliberately decorative and non-interactive
 * (`pointer-events: none` in `rotorMarker.module.css`) — the deck.gl
 * `IconLayer` still owns the actual aircraft silhouette and all click/hover
 * interaction for every aircraft, including rotorcraft, so this never
 * introduces a second competing hit target (design.md Decision 8's "which
 * one wins visually" concern: the deck.gl icon does, this is purely an
 * accent layered on top). Called on every aircraft poll (~1s), same cadence
 * as `MapView.tsx`'s `refreshAircraft` — the rotor's spin itself is pure
 * CSS, independent of that cadence.
 *
 * MapLibre `Marker`s are plain ground-plane-projected DOM elements with no
 * altitude/elevation control (unlike this app's deck.gl-positioned icons,
 * which render at real barometric altitude, see `aircraftLayer.ts`'s
 * `altitudeToRenderMeters`) — the rotor glyph renders at the aircraft's
 * lon/lat but isn't lifted to its actual altitude in the sky. Acceptable for
 * a small decorative accent on typically low-flying rotorcraft; revisit if
 * this proves visually distracting at altitude.
 */
export function updateRotorMarkers(map: MapLibreMap, aircraft: Aircraft[]): void {
  const current = new Set<string>();

  for (const a of aircraft) {
    if (a.category !== ROTORCRAFT_CATEGORY || a.lat === undefined || a.lon === undefined) {
      continue;
    }
    current.add(a.hex);

    const existing = markers.get(a.hex);
    if (existing) {
      existing.setLngLat([a.lon, a.lat]);
    } else {
      const marker = new Marker({ element: createRotorElement(), anchor: "center" }).setLngLat([
        a.lon,
        a.lat,
      ]);
      marker.addTo(map);
      markers.set(a.hex, marker);
    }
  }

  for (const [hex, marker] of markers) {
    if (!current.has(hex)) {
      marker.remove();
      markers.delete(hex);
    }
  }
}

/** Removes every rotor marker — called on map/component unmount. */
export function clearRotorMarkers(): void {
  for (const marker of markers.values()) {
    marker.remove();
  }
  markers.clear();
}

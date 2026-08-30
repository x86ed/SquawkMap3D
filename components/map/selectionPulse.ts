import type { Layer } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { altitudeToRenderMeters, AIRCRAFT_SELECTION_GLOW_LAYER_ID } from "./aircraftLayer";
import { hexColorToRgb } from "./aircraftIcons";
import {
  AIRCRAFT_SELECTION_GLOW_ALPHA,
  AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS,
  AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE,
  AIRCRAFT_SELECTION_PULSE_PERIOD_MS,
  AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS,
} from "./constants";

export interface SelectionPulseTarget {
  lon: number;
  lat: number;
  altitude?: number;
  rarityColorHex: string;
}

/**
 * Pure per-frame layer builder for the selected-aircraft glow highlight —
 * analogous to radarSweep.ts's buildRangeOutlineSweepLayers(), called every
 * requestAnimationFrame rather than once per feeder poll (design.md
 * Decision 1), since AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS/ALPHA alone
 * (aircraftLayer.ts's old static glowLayer) can't pulse smoothly on a ~1s
 * poll cadence.
 *
 * Returns [] when nothing is selected. The pulse is a sine wave over
 * elapsed time since pulseStartMs: radius grows and alpha fades by up to
 * their respective amplitude constants at the wave's peak, then back down
 * (design.md Decision 3).
 */
export function buildSelectionPulseLayer(params: {
  selected: SelectionPulseTarget | null;
  nowMs: number;
  pulseStartMs: number;
}): Layer[] {
  const { selected, nowMs, pulseStartMs } = params;
  if (!selected) return [];

  const elapsedMs = nowMs - pulseStartMs;
  const t = elapsedMs / AIRCRAFT_SELECTION_PULSE_PERIOD_MS;
  const wave = (Math.sin(t * 2 * Math.PI) + 1) / 2;

  const radius = AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS + wave * AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS;
  const alpha = AIRCRAFT_SELECTION_GLOW_ALPHA - wave * AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE;

  const [r, g, b] = hexColorToRgb(selected.rarityColorHex);

  const pulseLayer = new ScatterplotLayer<SelectionPulseTarget>({
    id: AIRCRAFT_SELECTION_GLOW_LAYER_ID,
    data: [selected],
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    getFillColor: () => [r, g, b, alpha],
    getRadius: radius,
    radiusUnits: "pixels",
    pickable: false,
  });

  return [pulseLayer];
}

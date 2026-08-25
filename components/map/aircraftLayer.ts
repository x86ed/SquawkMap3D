import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Aircraft, TrackPoint } from "./aircraft";
import { altitudeToColor, resolveIconKey, type IconAtlas } from "./aircraftIcons";
import { computeRarityTier, RARITY_TIER_STYLES } from "./aircraftRarity";
import { AIRCRAFT_SELECTION_GLOW_ALPHA, AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS } from "./constants";

export const AIRCRAFT_ICON_LAYER_ID = "aircraft-icons";
export const AIRCRAFT_TRACK_LAYER_ID = "aircraft-tracks";
export const AIRCRAFT_SELECTION_GLOW_LAYER_ID = "aircraft-selection-glow";

// Exported so other real-altitude-positioned deck.gl layers (radarSweep.ts's
// aircraft dots) reuse the exact same conversion rather than a copy that
// could drift.
export const FEET_TO_METERS = 0.3048;

interface TrackSegment {
  path: [[number, number, number], [number, number, number]];
  color: [number, number, number];
}

/**
 * Builds the deck.gl `IconLayer` (current aircraft, positioned at their real
 * altitude in meters above sea level) and `PathLayer` (recent track trails)
 * from the current aircraft + track-buffer state. Called on every feeder
 * poll and pushed into the `MapboxOverlay` via `setProps` — not itself
 * re-run per animation frame, deck.gl handles that internally once given
 * the layer instances (see design.md Decision 2).
 *
 * Track trails are built as many short two-point `PathLayer` segments
 * (one per consecutive pair of track points) rather than one path per
 * aircraft, because `PathLayer` only supports a single color per path —
 * segmenting is what lets the trail's color vary along its length by
 * altitude (see aircraft-tracks-layer spec's "Track colored by altitude"
 * scenario).
 */
export function buildAircraftLayers(params: {
  aircraft: Aircraft[];
  tracks: ReadonlyMap<string, TrackPoint[]>;
  iconAtlas: IconAtlas | null;
  selectedHex: string | null;
  onAircraftClick: (hex: string | null) => void;
}): Layer[] {
  const { aircraft, tracks, iconAtlas, selectedHex, onAircraftClick } = params;
  if (!iconAtlas) return [];

  const positioned = aircraft.filter(
    (a): a is Aircraft & { lat: number; lon: number } =>
      a.lat !== undefined && a.lon !== undefined,
  );

  const iconLayer = new IconLayer<Aircraft & { lat: number; lon: number }>({
    id: AIRCRAFT_ICON_LAYER_ID,
    data: positioned,
    iconAtlas: iconAtlas.image,
    iconMapping: iconAtlas.mapping,
    getIcon: (d) => resolveIconKey(d).key,
    getPosition: (d) => [d.lon, d.lat, (d.altitude ?? 0) * FEET_TO_METERS],
    // Icon SVGs are drawn nose-up in the atlas (verified per-asset; two
    // pw-silhouettes exceptions corrected in aircraftIcons.ts's atlas
    // builder). deck.gl's IconLayer rotates clockwise for positive `angle`
    // (icon-layer-vertex.glsl.js), matching compass track directly — no
    // sign flip needed.
    getAngle: (d) => d.track ?? 0,
    getColor: (d) => altitudeToColor(d.altitude ?? 0),
    getSize: 28,
    sizeUnits: "pixels",
    // Selection picking (design.md Decision 2): the click handler itself
    // toggles off when re-clicking the already-selected hex, else selects
    // the clicked one; a miss (empty map area) reports `null` here, but the
    // real "clicked elsewhere" deselect path is MapLibre's own unscoped
    // `map.on("click", ...)` in MapView.tsx (Decision 3) since this only
    // fires on an actual pick hit.
    pickable: true,
    onClick: (info) => onAircraftClick(info.object ? info.object.hex : null),
  });

  const selectedAircraft = selectedHex
    ? positioned.find((a) => a.hex === selectedHex)
    : undefined;

  // Glow highlight (design.md Decision 4): a second, larger, semi-transparent
  // ScatterplotLayer circle rendered underneath the icon at the same
  // position, colored by the selected aircraft's computed rarity tier. Only
  // ever zero or one element — no highlight when nothing is selected or the
  // selected aircraft has dropped out of the current positioned set.
  const glowLayer = new ScatterplotLayer<Aircraft & { lat: number; lon: number }>({
    id: AIRCRAFT_SELECTION_GLOW_LAYER_ID,
    data: selectedAircraft ? [selectedAircraft] : [],
    getPosition: (d) => [d.lon, d.lat, (d.altitude ?? 0) * FEET_TO_METERS],
    getFillColor: (d) => {
      const [r, g, b] = hexColorToRgb(RARITY_TIER_STYLES[computeRarityTier(d)].color);
      return [r, g, b, AIRCRAFT_SELECTION_GLOW_ALPHA];
    },
    getRadius: AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS,
    radiusUnits: "pixels",
    pickable: false,
  });

  const segments: TrackSegment[] = [];
  for (const points of tracks.values()) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      segments.push({
        path: [
          [a.lon, a.lat, a.altitude * FEET_TO_METERS],
          [b.lon, b.lat, b.altitude * FEET_TO_METERS],
        ],
        color: altitudeToColor(b.altitude),
      });
    }
  }

  const trackLayer = new PathLayer<TrackSegment>({
    id: AIRCRAFT_TRACK_LAYER_ID,
    data: segments,
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: 2,
    widthUnits: "pixels",
    pickable: false,
  });

  // Glow beneath the trail/icons (design.md Decision 4), trail beneath
  // icons, icons on top.
  return [glowLayer, trackLayer, iconLayer];
}

/** Parses a `#rrggbb` hex color string into an `[r, g, b]` 0-255 triple. */
function hexColorToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

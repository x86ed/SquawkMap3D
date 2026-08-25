import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer } from "@deck.gl/layers";
import type { Aircraft, TrackPoint } from "./aircraft";
import { altitudeToColor, resolveIconKey, type IconAtlas } from "./aircraftIcons";

export const AIRCRAFT_ICON_LAYER_ID = "aircraft-icons";
export const AIRCRAFT_TRACK_LAYER_ID = "aircraft-tracks";

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
}): Layer[] {
  const { aircraft, tracks, iconAtlas } = params;
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

  // Trail beneath, icons on top.
  return [trackLayer, iconLayer];
}

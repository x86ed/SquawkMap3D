import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Aircraft, TrackPoint } from "./aircraft";
import {
  type ColorMode,
  hexColorToRgb,
  resolveAircraftColor,
  resolveIconKey,
  resolveTrackPointColor,
  type IconAtlas,
} from "./aircraftIcons";
import { computeRarityTier, RARITY_TIER_STYLES } from "./aircraftRarity";
import {
  AIRCRAFT_SELECTION_GLOW_ALPHA,
  AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS,
  TERRAIN_EXAGGERATION,
} from "./constants";

export const AIRCRAFT_ICON_LAYER_ID = "aircraft-icons";
export const AIRCRAFT_TRACK_LAYER_ID = "aircraft-tracks";
export const AIRCRAFT_SELECTION_GLOW_LAYER_ID = "aircraft-selection-glow";

// Exported so other real-altitude-positioned deck.gl layers (radarSweep.ts's
// aircraft dots) reuse the exact same conversion rather than a copy that
// could drift.
export const FEET_TO_METERS = 0.3048;

/**
 * Converts a reported altitude (feet) to the deck.gl world-space meters used
 * to position aircraft, scaled by the map's terrain exaggeration factor
 * (design.md Decision 6) so an aircraft's rendered height stays visually
 * consistent with the equally-stretched terrain mesh beneath it — MapLibre's
 * `exaggeration` only scales the terrain mesh itself, not deck.gl's own
 * world-space z units, so this multiplier has to be applied here explicitly.
 * Exported so every real-altitude-positioned deck.gl layer (this file's icon/
 * glow/track layers, and radarSweep.ts's aircraft dots) shares one
 * conversion rather than copies that could drift apart.
 */
export function altitudeToRenderMeters(altitudeFt: number | undefined): number {
  return (altitudeFt ?? 0) * FEET_TO_METERS * TERRAIN_EXAGGERATION;
}

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
  colorMode: ColorMode;
  onAircraftClick: (hex: string | null) => void;
  onAircraftHover: (
    aircraft: (Aircraft & { lat: number; lon: number }) | null,
    x: number,
    y: number,
  ) => void;
}): Layer[] {
  const { aircraft, tracks, iconAtlas, selectedHex, colorMode, onAircraftClick, onAircraftHover } =
    params;
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
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    // Icon SVGs are drawn nose-up in the atlas (verified per-asset; two
    // pw-silhouettes exceptions corrected in aircraftIcons.ts's atlas
    // builder). deck.gl's IconLayer actually rotates *counter-clockwise*
    // for positive `angle` — confirmed empirically (a standalone IconLayer
    // test: angle=90 pointed a nose-up icon west, not east) — while compass
    // track increases *clockwise* from north. Negating the track is what
    // makes a nose-up icon point the right way (track=90/east needs
    // angle=-90, i.e. 90° clockwise from the icon's own CCW-positive axis).
    getAngle: (d) => -(d.track ?? 0),
    getColor: (d) => resolveAircraftColor(d, colorMode),
    // Was 28 — with a solid-filled icon (see aircraftIcons.ts's atlas
    // builder), that read as too small on the map to be legible against
    // basemap clutter.
    getSize: 40,
    sizeUnits: "pixels",
    // design.md Decision 7 (reverted): billboard:false laid the icon flat in
    // its own ground plane so ordinary 3D perspective would foreshorten it
    // as the camera pitches. In practice, at this app's default/typical
    // pitch (60-85°), that foreshortening crushes most icons down to a
    // near-edge-on sliver depending on their track relative to the camera
    // bearing — the tint color is still technically applied, but the
    // foreshortened, anti-aliased sliver reads as washed-out/uncolored for
    // most aircraft. Icon legibility/color visibility wins over the cheap
    // tilt cue; true 3D aircraft orientation is deferred to the separate
    // follow-up 3D-aircraft-models change (see proposal.md). Left at
    // deck.gl's default (billboard: true — always faces the camera).
    // Selection picking (design.md Decision 2): the click handler itself
    // toggles off when re-clicking the already-selected hex, else selects
    // the clicked one; a miss (empty map area) reports `null` here, but the
    // real "clicked elsewhere" deselect path is MapLibre's own unscoped
    // `map.on("click", ...)` in MapView.tsx (Decision 3) since this only
    // fires on an actual pick hit.
    pickable: true,
    onClick: (info) => onAircraftClick(info.object ? info.object.hex : null),
    // Hover tooltip (design.md Decision 10) — independent of onClick above;
    // `info.object` is `undefined`/`null` when the pointer leaves every
    // icon, which is exactly the "hide tooltip" signal the caller needs.
    onHover: (info) => onAircraftHover(info.object ?? null, info.x, info.y),
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
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    getFillColor: (d) => {
      const [r, g, b] = hexColorToRgb(RARITY_TIER_STYLES[computeRarityTier(d)].color);
      return [r, g, b, AIRCRAFT_SELECTION_GLOW_ALPHA];
    },
    getRadius: AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS,
    radiusUnits: "pixels",
    pickable: false,
  });

  // Rarity mode needs each track point's owning aircraft's typeDesignator
  // (see aircraftIcons.ts's rarityToColorByTypeDesignator doc comment) —
  // TrackPoint itself carries no type info, only what was true at that poll.
  const aircraftByHex = new Map(aircraft.map((a) => [a.hex, a]));

  const segments: TrackSegment[] = [];
  for (const [hex, points] of tracks) {
    const typeDesignator = aircraftByHex.get(hex)?.typeDesignator;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      segments.push({
        path: [
          [a.lon, a.lat, altitudeToRenderMeters(a.altitude)],
          [b.lon, b.lat, altitudeToRenderMeters(b.altitude)],
        ],
        color: resolveTrackPointColor(b, colorMode, typeDesignator),
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

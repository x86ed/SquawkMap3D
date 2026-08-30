import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Aircraft, TrackPoint } from "./aircraft";
import {
  brightenColor,
  type ColorMode,
  hexColorToRgb,
  resolveAircraftColor,
  resolveIconKey,
  resolveTrackPointColor,
  ROTOR_ACCENT_KEY,
  type IconAtlas,
} from "./aircraftIcons";
import { computeRarityTier, RARITY_TIER_STYLES } from "./aircraftRarity";
import {
  AIRCRAFT_GLOW_BRIGHTEN_AMOUNT,
  AIRCRAFT_ICON_GLOW_ALPHA,
  AIRCRAFT_ICON_GLOW_RADIUS_PIXELS,
  AIRCRAFT_SELECTION_GLOW_ALPHA,
  AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS,
  AIRCRAFT_TRACK_GLOW_ALPHA,
  AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS,
  TERRAIN_EXAGGERATION,
} from "./constants";

export const AIRCRAFT_ICON_LAYER_ID = "aircraft-icons";
export const AIRCRAFT_TRACK_LAYER_ID = "aircraft-tracks";
export const AIRCRAFT_SELECTION_GLOW_LAYER_ID = "aircraft-selection-glow";
export const AIRCRAFT_ROTOR_ACCENT_LAYER_ID = "aircraft-rotor-accent";
export const AIRCRAFT_ICON_GLOW_LAYER_ID = "aircraft-icon-glow";
export const AIRCRAFT_TRACK_GLOW_LAYER_ID = "aircraft-track-glow";

const ROTORCRAFT_CATEGORY = "A7";
const ROTOR_ACCENT_SIZE_PIXELS = 22;
const ROTOR_ACCENT_COLOR: [number, number, number] = [229, 229, 229];

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
    // design.md Decision 7: laying the icon flat in its own ground plane
    // (rotated by getAngle above) rather than always billboarding to face
    // the camera lets ordinary 3D perspective foreshorten/tilt it as the
    // map camera pitches, so the icon's orientation actually matches the
    // 3D view instead of reading as a flat sticker pasted on screen. An
    // earlier attempt reverted this after live testing seemed to show it
    // washing out icon color at typical pitch — that turned out to be a
    // false diagnosis: the real cause was a separate atlas-mapping bug
    // (missing `mask: true`, see aircraftIcons.ts) that made every icon
    // render its baked-white texture color regardless of `billboard`. With
    // that fixed, `billboard: false` is back — colors and orientation both
    // now read correctly at pitch. Since geometry here is in the aircraft's
    // own world-space ground plane, its rotation already follows the
    // camera's bearing automatically (no manual bearing compensation
    // needed, unlike the screen-space rotation `billboard: true` requires).
    billboard: false,
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

  // Always-on per-aircraft icon glow (design.md Decision 3) — unlike
  // `glowLayer` above (selected aircraft only, fixed rarity color), this
  // renders for every currently rendered aircraft (`positioned`, same array
  // `iconLayer` uses), colored as a brightened variant of that same
  // aircraft's own current `resolveAircraftColor` result, so it always
  // matches the active color mode. Smaller radius/lower alpha than the
  // selection glow so a selected aircraft's rarity ring still stands out.
  const iconGlowLayer = new ScatterplotLayer<Aircraft & { lat: number; lon: number }>({
    id: AIRCRAFT_ICON_GLOW_LAYER_ID,
    data: positioned,
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    getFillColor: (d) => {
      const [r, g, b] = brightenColor(resolveAircraftColor(d, colorMode), AIRCRAFT_GLOW_BRIGHTEN_AMOUNT);
      return [r, g, b, AIRCRAFT_ICON_GLOW_ALPHA];
    },
    getRadius: AIRCRAFT_ICON_GLOW_RADIUS_PIXELS,
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

  // Always-on track glow (design.md Decision 4) — a second, wider,
  // lower-opacity pass over the exact same `segments` array already built
  // above for `trackLayer` (no new loop), colored as a brightened variant of
  // each segment's own resolved color, purely additive beneath the crisp
  // original line.
  const trackGlowLayer = new PathLayer<TrackSegment>({
    id: AIRCRAFT_TRACK_GLOW_LAYER_ID,
    data: segments,
    getPath: (d) => d.path,
    getColor: (d) => {
      const [r, g, b] = brightenColor(d.color, AIRCRAFT_GLOW_BRIGHTEN_AMOUNT);
      return [r, g, b, AIRCRAFT_TRACK_GLOW_ALPHA];
    },
    getWidth: AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS,
    widthUnits: "pixels",
    pickable: false,
  });

  // Rotorcraft rotor-disc accent (design.md Decision 8, revised): a second,
  // smaller `IconLayer` for category-A7 aircraft only, positioned at the
  // exact same real-world altitude as the aircraft's own icon (unlike the
  // previous MapLibre-`Marker`-based version, which had no altitude/pitch
  // awareness — see aircraftIcons.ts's `drawRotorAccent` doc comment).
  // `billboard: false` matches the main icon layer so the accent tilts with
  // the same 3D ground-plane orientation rather than floating flat-on
  // relative to the tilted fuselage beneath it. The "spin" is a per-poll
  // wall-clock-derived angle (not a continuous per-frame animation, unlike
  // the CSS version) — consistent with this app's aircraft themselves only
  // moving once per poll (~1s), not smoothly interpolated, so a
  // continuously-animated rotor would visually mismatch its own
  // "teleporting" parent anyway; the large per-poll step (~143°/s) still
  // reads as spinning rather than static.
  const rotorcraft = positioned.filter((a) => a.category === ROTORCRAFT_CATEGORY);
  const rotorSpinAngleDeg = (Date.now() / 7) % 360;
  const rotorLayer = new IconLayer<Aircraft & { lat: number; lon: number }>({
    id: AIRCRAFT_ROTOR_ACCENT_LAYER_ID,
    data: rotorcraft,
    iconAtlas: iconAtlas.image,
    iconMapping: iconAtlas.mapping,
    getIcon: () => ROTOR_ACCENT_KEY,
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    getAngle: () => rotorSpinAngleDeg,
    getColor: ROTOR_ACCENT_COLOR,
    getSize: ROTOR_ACCENT_SIZE_PIXELS,
    sizeUnits: "pixels",
    billboard: false,
    pickable: false,
  });

  // Paint order, back to front: the selected-aircraft rarity-colored
  // selection glow (`glowLayer`) stays visually outermost/largest and is
  // painted first/lowest so it's never swallowed by the new always-on
  // glows (design.md Decision 5); then the new always-on icon glow and
  // track glow (`iconGlowLayer`, `trackGlowLayer`), both smaller/dimmer
  // than the selection glow; then the crisp track line, rotor accent, and
  // icons on top, unchanged from before (rotor drawn just before the icon
  // so the fuselage silhouette isn't hidden underneath it).
  return [glowLayer, iconGlowLayer, trackGlowLayer, trackLayer, rotorLayer, iconLayer];
}

import type { Layer } from "@deck.gl/core";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Aircraft, TrackPoint } from "./aircraft";
import {
  brightenColor,
  type ColorMode,
  glowIconKey,
  resolveAircraftColor,
  resolveIconKey,
  resolveTrackPointColor,
  ROTOR_ACCENT_KEY,
  type IconAtlas,
} from "./aircraftIcons";
import {
  AIRCRAFT_GLOW_BRIGHTEN_AMOUNT,
  AIRCRAFT_ICON_GLOW_ALPHA,
  AIRCRAFT_ICON_GLOW_SIZE_PIXELS,
  AIRCRAFT_TRACK_CURTAIN_BAND_COUNT,
  AIRCRAFT_TRACK_CURTAIN_TOP_ALPHA,
  AIRCRAFT_TRACK_CURTAIN_WIDTH_PIXELS,
  AIRCRAFT_TRACK_DROPLINE_ALPHA,
  AIRCRAFT_TRACK_DROPLINE_COLOR,
  AIRCRAFT_TRACK_DROPLINE_DOT_COUNT,
  AIRCRAFT_TRACK_DROPLINE_DOT_RADIUS_PIXELS,
  AIRCRAFT_TRACK_FADE_MIN_ALPHA,
  AIRCRAFT_TRACK_GLOW_ALPHA,
  AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS,
  AIRCRAFT_TRACK_MARKER_INTERVAL_MS,
  AIRCRAFT_TRACK_RETENTION_MS,
  TERRAIN_EXAGGERATION,
} from "./constants";

export const AIRCRAFT_ICON_LAYER_ID = "aircraft-icons";
export const AIRCRAFT_TRACK_LAYER_ID = "aircraft-tracks";
export const AIRCRAFT_SELECTION_GLOW_LAYER_ID = "aircraft-selection-glow";
export const AIRCRAFT_ROTOR_ACCENT_LAYER_ID = "aircraft-rotor-accent";
export const AIRCRAFT_ICON_GLOW_LAYER_ID = "aircraft-icon-glow";
export const AIRCRAFT_TRACK_GLOW_LAYER_ID = "aircraft-track-glow";
export const AIRCRAFT_TRACK_CURTAIN_LAYER_ID = "aircraft-track-curtain";
export const AIRCRAFT_TRACK_DROPLINE_LAYER_ID = "aircraft-track-dropline";

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
  alpha: number;
}

interface CurtainBand {
  path: [[number, number, number], [number, number, number]];
  color: [number, number, number, number];
}

interface DroplineDot {
  position: [number, number, number];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction;
}

/**
 * Decimates a track's recorded points down to a coarser subset used by the
 * ground droplines/curtain (design.md Decision 2), keeping one point at
 * least `AIRCRAFT_TRACK_MARKER_INTERVAL_MS` after the previously-kept
 * marker's timestamp. Always appends the final (most recent) point, even if
 * it falls short of a full interval since the last kept marker, so the
 * current position always gets a dropline/curtain edge.
 */
export function selectTrackMarkers(points: TrackPoint[]): TrackPoint[] {
  if (points.length === 0) return [];

  const markers: TrackPoint[] = [points[0]];
  let lastKeptTimestamp = points[0].timestamp;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (point.timestamp - lastKeptTimestamp >= AIRCRAFT_TRACK_MARKER_INTERVAL_MS) {
      markers.push(point);
      lastKeptTimestamp = point.timestamp;
    }
  }

  const lastPoint = points[points.length - 1];
  if (markers[markers.length - 1] !== lastPoint) {
    markers.push(lastPoint);
  }
  return markers;
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
  colorMode: ColorMode;
  // Gates trail line/glow/droplines/curtain only — icon, icon-glow, and
  // rotor layers are unaffected (aircraft-tracks-layer's "toggleable
  // independently of aircraft icon visibility" requirement).
  tracksVisible: boolean;
  onAircraftClick: (hex: string | null) => void;
  onAircraftHover: (
    aircraft: (Aircraft & { lat: number; lon: number }) | null,
    x: number,
    y: number,
  ) => void;
}): Layer[] {
  const { aircraft, tracks, iconAtlas, colorMode, tracksVisible, onAircraftClick, onAircraftHover } =
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

  // Selection glow highlight (`AIRCRAFT_SELECTION_GLOW_LAYER_ID`) is no
  // longer built here — it now pulses continuously while selected, which
  // requires a per-frame rebuild `buildAircraftLayers()`'s own ~1s
  // feeder-poll cadence can't provide. It lives on its own dedicated,
  // requestAnimationFrame-driven overlay instead (selectionPulse.ts's
  // buildSelectionPulseLayer(), wired up in MapView.tsx — see
  // aircraft-selection-pulse's design.md Decision 1).

  // Always-on per-aircraft icon glow (design.md Decision 3) — unlike the
  // selection-pulse ring (selected aircraft only, fixed rarity color), this
  // renders for every currently rendered aircraft (`positioned`, same array
  // `iconLayer` uses), colored as a brightened variant of that same
  // aircraft's own current `resolveAircraftColor` result, so it always
  // matches the active color mode. Renders the aircraft's own blurred
  // silhouette (`glowIconKey`'s atlas entry, aircraftIcons.ts), not a plain
  // circle — larger and lower-alpha than the crisp icon so it reads as a
  // halo behind it, and lower-alpha than the selection glow so a selected
  // aircraft's rarity ring still stands out.
  const iconGlowLayer = new IconLayer<Aircraft & { lat: number; lon: number }>({
    id: AIRCRAFT_ICON_GLOW_LAYER_ID,
    data: positioned,
    iconAtlas: iconAtlas.image,
    iconMapping: iconAtlas.mapping,
    getIcon: (d) => glowIconKey(resolveIconKey(d).key),
    getPosition: (d) => [d.lon, d.lat, altitudeToRenderMeters(d.altitude)],
    getAngle: (d) => -(d.track ?? 0),
    getColor: (d) => {
      const [r, g, b] = brightenColor(resolveAircraftColor(d, colorMode), AIRCRAFT_GLOW_BRIGHTEN_AMOUNT);
      return [r, g, b, AIRCRAFT_ICON_GLOW_ALPHA];
    },
    getSize: AIRCRAFT_ICON_GLOW_SIZE_PIXELS,
    sizeUnits: "pixels",
    billboard: false,
    pickable: false,
  });

  // Rarity mode needs each track point's owning aircraft's typeDesignator
  // (see aircraftIcons.ts's rarityToColorByTypeDesignator doc comment) —
  // TrackPoint itself carries no type info, only what was true at that poll.
  const aircraftByHex = new Map(aircraft.map((a) => [a.hex, a]));

  // tracksVisible gates all track-derived work, not just which layers are
  // returned (tasks.md 6.2) — skipping the segment/band/dot-building loops
  // and layer construction entirely while hidden avoids wasted per-poll work
  // for elements nothing renders.
  let trackLayer: Layer | null = null;
  let trackGlowLayer: Layer | null = null;
  let curtainLayer: Layer | null = null;
  let droplineLayer: Layer | null = null;

  if (tracksVisible) {
    const segments: TrackSegment[] = [];
    const curtainBands: CurtainBand[] = [];
    const droplineDots: DroplineDot[] = [];
    // Captured once per call, not per segment (design.md Decision 1), so
    // every segment's fade is computed against the same instant.
    const now = Date.now();

    for (const [hex, points] of tracks) {
      const typeDesignator = aircraftByHex.get(hex)?.typeDesignator;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const ageFraction = clamp01((now - b.timestamp) / AIRCRAFT_TRACK_RETENTION_MS);
        const alpha =
          i === points.length - 1
            ? 255
            : lerp(255, AIRCRAFT_TRACK_FADE_MIN_ALPHA, ageFraction);
        segments.push({
          path: [
            [a.lon, a.lat, altitudeToRenderMeters(a.altitude)],
            [b.lon, b.lat, altitudeToRenderMeters(b.altitude)],
          ],
          color: resolveTrackPointColor(b, colorMode, typeDesignator),
          alpha,
        });
      }

      const markers = selectTrackMarkers(points);
      for (let i = 1; i < markers.length; i++) {
        const a = markers[i - 1];
        const b = markers[i];
        for (let band = 0; band < AIRCRAFT_TRACK_CURTAIN_BAND_COUNT; band++) {
          const f = band / (AIRCRAFT_TRACK_CURTAIN_BAND_COUNT - 1);
          curtainBands.push({
            path: [
              [a.lon, a.lat, altitudeToRenderMeters(a.altitude) * f],
              [b.lon, b.lat, altitudeToRenderMeters(b.altitude) * f],
            ],
            // Neutral, matching the droplines (not resolveTrackPointColor) —
            // the horizontal trail is the only element that should carry the
            // track's color-mode color; these ground-reference elements read
            // as competing/duplicate color-coding otherwise.
            color: [...AIRCRAFT_TRACK_DROPLINE_COLOR, lerp(AIRCRAFT_TRACK_CURTAIN_TOP_ALPHA, 0, f)],
          });
        }
      }

      for (const marker of markers) {
        const markerHeight = altitudeToRenderMeters(marker.altitude);
        for (let dot = 0; dot < AIRCRAFT_TRACK_DROPLINE_DOT_COUNT; dot++) {
          const f = dot / (AIRCRAFT_TRACK_DROPLINE_DOT_COUNT - 1);
          droplineDots.push({
            position: [marker.lon, marker.lat, lerp(markerHeight, 0, f)],
          });
        }
      }
    }

    trackLayer = new PathLayer<TrackSegment>({
      id: AIRCRAFT_TRACK_LAYER_ID,
      data: segments,
      getPath: (d) => d.path,
      getColor: (d) => [...d.color, d.alpha],
      getWidth: 2,
      widthUnits: "pixels",
      pickable: false,
    });

    // Always-on track glow (design.md Decision 4) — a second, wider,
    // lower-opacity pass over the exact same `segments` array already built
    // above for `trackLayer` (no new loop), colored as a brightened variant
    // of each segment's own resolved color, purely additive beneath the
    // crisp original line. The glow's own fixed alpha is scaled by the
    // segment's own fade fraction so the glow dims in lockstep with the line
    // rather than staying at constant brightness under a fading line.
    trackGlowLayer = new PathLayer<TrackSegment>({
      id: AIRCRAFT_TRACK_GLOW_LAYER_ID,
      data: segments,
      getPath: (d) => d.path,
      getColor: (d) => {
        const [r, g, b] = brightenColor(d.color, AIRCRAFT_GLOW_BRIGHTEN_AMOUNT);
        return [r, g, b, Math.round(AIRCRAFT_TRACK_GLOW_ALPHA * (d.alpha / 255))];
      },
      getWidth: AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS,
      widthUnits: "pixels",
      pickable: false,
    });

    // Ground "curtain" beneath the trail (design.md Decision 3) — a small
    // number of stacked, decreasing-alpha PathLayer bands approximating a
    // continuous vertical gradient from the trail's own color down to fully
    // transparent at the ground, built from the decimated marker subset
    // above.
    curtainLayer = new PathLayer<CurtainBand>({
      id: AIRCRAFT_TRACK_CURTAIN_LAYER_ID,
      data: curtainBands,
      getPath: (d) => d.path,
      getColor: (d) => d.color,
      getWidth: AIRCRAFT_TRACK_CURTAIN_WIDTH_PIXELS,
      widthUnits: "pixels",
      pickable: false,
    });

    // Dotted ground-reference droplines (design.md Decision 4) — fixed
    // neutral color regardless of the active color mode, since this is a
    // technical "how far above the ground was this point" cue, not
    // data-carrying.
    droplineLayer = new ScatterplotLayer<DroplineDot>({
      id: AIRCRAFT_TRACK_DROPLINE_LAYER_ID,
      data: droplineDots,
      getPosition: (d) => d.position,
      getFillColor: [...AIRCRAFT_TRACK_DROPLINE_COLOR, AIRCRAFT_TRACK_DROPLINE_ALPHA],
      getRadius: AIRCRAFT_TRACK_DROPLINE_DOT_RADIUS_PIXELS,
      radiusUnits: "pixels",
      pickable: false,
    });
  }

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

  // Paint order, back to front: the always-on icon glow, then the new ground
  // curtain (furthest-back "ground reference" element), the track glow, the
  // new ground droplines, then the crisp track line, rotor accent, and icons
  // on top (rotor drawn just before the icon so the fuselage silhouette
  // isn't hidden underneath it). Relative order between trackGlowLayer/
  // curtainLayer/droplineLayer is left to visual tuning (tasks.md 6.3). The
  // four track-related layers are `null` (and simply omitted) when
  // `tracksVisible` is false.
  return [
    iconGlowLayer,
    curtainLayer,
    trackGlowLayer,
    droplineLayer,
    trackLayer,
    rotorLayer,
    iconLayer,
  ].filter((layer): layer is Layer => layer !== null);
}

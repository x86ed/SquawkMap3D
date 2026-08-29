"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import styles from "./MapView.module.css";
import {
  getMapTilerKey,
  getStyleUrl,
  type MapTheme,
} from "./mapStyles";
import { getInitialTheme, storeTheme } from "./theme";
import { applySky, applyTerrain } from "./terrain";
import {
  fetchAircraft,
  updateTracks,
  getAllTracks,
  getTrack,
  clearTracks,
  type Aircraft,
} from "./aircraft";
import { buildAircraftIconAtlas, type ColorMode, type IconAtlas } from "./aircraftIcons";
import { buildAircraftLayers } from "./aircraftLayer";
import { AircraftColorDock } from "./controls/AircraftColorDock";
import { AircraftHoverTooltip } from "./overlay/AircraftHoverTooltip";
import { ColorModeLegendDock } from "./overlay/ColorModeLegendDock";
import { clearRotorMarkers, updateRotorMarkers } from "./rotorMarkers";
import { getFlightRoute, type FlightRoute } from "./flightRoute";
import {
  buildSelectedAircraftInfo,
  type SelectedAircraftInfo,
} from "./overlay/selectedAircraftInfo";
import { AircraftOverlay } from "./overlay/AircraftOverlay";
import {
  addCustomLayers,
  AIRPORTS_LAYER_ID,
  getAirportIconDisplayHeight,
  moveRangeOutlineBelowAirports,
  refreshAirspaceBoundaries,
  refreshRainViewer,
  refreshRangeOutline,
  refreshSpecialUseAirspace,
  refreshTfrs,
  setAirportsVisibility,
  setAirspaceBoundariesVisibility,
  setDwdRadolanVisibility,
  setMilitaryBasesVisibility,
  setNexradVisibility,
  setNoaaInfraredVisibility,
  setNoaaRadarVisibility,
  setOpenAipVisibility,
  setPilotModeVisibility,
  setRainViewerVisibility,
  setRangeOutlineVisibility,
  setSpecialUseAirspaceVisibility,
  setTfrVisibility,
} from "./layers";
import {
  buildRangeOutlineSweepLayers,
  clearRangeOutlineFlashTimestamps,
  computeSweepAngleDeg,
  updateFlashTimestamps,
} from "./radarSweep";
import {
  airportImageSlotId,
  buildAirportPopupHtml,
  fetchAirportImage,
  type AirportProperties,
} from "./airportPopup";
import {
  addUserLocationLayers,
  getUserLocationBounds,
  setUserLocationVisibility,
  USER_LOCATION_ICON_LAYER_ID,
} from "./userLocation";
import {
  addTerminatorLayers,
  refreshTerminator,
  setTerminatorVisibility,
} from "./terminator";
import { getCurrentLocation, type GeoCoords } from "./geolocation";
import { getFeederLocation } from "./feederLocation";
import {
  AIRCRAFT_DESELECT_CLICK_GUARD_MS,
  AIRCRAFT_FEED_REFRESH_INTERVAL_MS,
  AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS,
  DEFAULT_VIEW,
  FOLLOW_SELECTED_AIRCRAFT_EASE_MS,
  INITIAL_BEARING,
  INITIAL_PITCH,
  MAX_PITCH,
  RAINVIEWER_REFRESH_INTERVAL_MS,
  RANGE_OUTLINE_REFRESH_INTERVAL_MS,
  RANGE_OUTLINE_SWEEP_PERIOD_MS,
  SUA_REFRESH_INTERVAL_MS,
  TERMINATOR_REFRESH_INTERVAL_MS,
  TFR_REFRESH_INTERVAL_MS,
} from "./constants";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

// maplibre-gl resolves its worker script relative to `import.meta.url` of
// its own bundled module. Under Next.js/Turbopack, that module is served
// from a hashed `_next/static/chunks/...` URL, so the relative worker path
// maplibre computes doesn't exist and the app's HTML shell is returned
// instead (a module-worker "non-JavaScript MIME type" failure that kills
// the worker immediately after it starts). Since all vector- and
// GeoJSON-tile parsing happens in that worker, this silently breaks every
// source *except* the ones maplibre fetches/decodes on the main thread
// (raster + raster-dem, i.e. the FAA sectional and terrain-RGB tiles) —
// which is why only the base vector map/airports/military-bases layers
// failed to render. Pointing at a copy of the worker script served from
// `public/` (kept in sync with the pinned maplibre-gl version) sidesteps
// the bad relative-URL resolution entirely.
setWorkerUrl("/maplibre-gl-worker.mjs");

/**
 * Resolves the position to anchor the user-location marker/rings at,
 * preferring the feeder's own surveyed antenna position (the actual
 * transmitter location) over the browser's geolocation — a feeder is
 * stationary, so its receiver.json position is both more accurate and
 * doesn't depend on the browser granting a geolocation permission prompt.
 * Falls back to `getCurrentLocation()` when no feeder is configured or its
 * receiver.json is unreachable.
 */
async function resolveUserLocation(): Promise<GeoCoords | null> {
  const feederLocation = await getFeederLocation();
  if (feederLocation) return feederLocation;
  return getCurrentLocation();
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const themeRef = useRef<MapTheme>(getInitialTheme());
  const pilotModeRef = useRef(false);
  const militaryVisibleRef = useRef(true);
  const airportsVisibleRef = useRef(true);
  const terminatorVisibleRef = useRef(true);
  const openAipVisibleRef = useRef(true);
  const rainViewerVisibleRef = useRef(true);
  const tfrVisibleRef = useRef(true);
  const suaVisibleRef = useRef(true);
  const airspaceBoundariesVisibleRef = useRef(true);
  const rangeOutlineVisibleRef = useRef(true);
  const nexradVisibleRef = useRef(true);
  const noaaInfraredVisibleRef = useRef(true);
  const noaaRadarVisibleRef = useRef(true);
  const dwdRadolanVisibleRef = useRef(true);
  const aircraftVisibleRef = useRef(true);
  const userLocationRef = useRef<GeoCoords | null>(null);
  const userLocationVisibleRef = useRef(true);
  const styleReadyRef = useRef(false);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const aircraftIconAtlasRef = useRef<IconAtlas | null>(null);

  // Selection state (design.md Decision 1) — state for render, ref for the
  // mount-effect's stable closures, same pairing every other piece of this
  // file's interaction state already uses.
  const selectedAircraftHexRef = useRef<string | null>(null);
  // Timestamp guard (design.md Decision 3) distinguishing a real
  // "click elsewhere" from MapLibre's own unscoped click handler re-firing
  // for the same pointer event the aircraft IconLayer's own onClick already
  // handled.
  const lastAircraftClickAtRef = useRef(0);
  const followSelectedAircraftRef = useRef(true);
  // Aircraft color mode (design.md Decision 1) — default "altitude" is
  // closest to this layer's prior always-on-altitude-tint behavior.
  const colorModeRef = useRef<ColorMode>("altitude");
  // callsign+hex-keyed, cleared on deselect — avoids re-fetching the same
  // aircraft's route every ~1s poll while it stays selected (tasks.md 6.2).
  const routeCacheRef = useRef<Map<string, FlightRoute | null>>(new Map());

  // Second, dedicated overlay (design.md Decision 4) — kept separate from
  // `deckOverlayRef` above so this layer's ~60fps rAF loop never couples to
  // the aircraft overlay's ~1Hz poll-driven `setProps` calls.
  const rangeOutlineOverlayRef = useRef<MapboxOverlay | null>(null);
  const rangeOutlineDataRef = useRef<FeatureCollection<Polygon | MultiPolygon>>({
    type: "FeatureCollection",
    features: [],
  });
  // The feeder's own surveyed antenna position (design.md Decision 5) — not
  // `userLocationRef`, which can fall back to browser geolocation when no
  // feeder is configured; the sweep must anchor on the same site readsb
  // itself centers the outline on, or not render at all.
  const rangeOutlineSiteRef = useRef<GeoCoords | null>(null);
  // Own poll of fetchAircraft(), independent of the aircraft-icons layer's
  // poll (see design.md Decision 6 / tasks.md 5.1) — this layer must show
  // aircraft dots even when that other layer is toggled off.
  const rangeOutlineAircraftRef = useRef<Aircraft[]>([]);
  const rangeOutlineSweepRafRef = useRef<number | null>(null);
  const rangeOutlineSweepStartRef = useRef(0);
  const rangeOutlineSweepAngleRef = useRef(0);

  const [theme, setTheme] = useState<MapTheme>(() => getInitialTheme());
  const [pilotMode, setPilotMode] = useState(false);
  const [militaryVisible, setMilitaryVisible] = useState(true);
  const [airportsVisible, setAirportsVisible] = useState(true);
  const [terminatorVisible, setTerminatorVisible] = useState(true);
  const [openAipVisible, setOpenAipVisible] = useState(true);
  const [rainViewerVisible, setRainViewerVisible] = useState(true);
  const [tfrVisible, setTfrVisible] = useState(true);
  const [suaVisible, setSuaVisible] = useState(true);
  const [airspaceBoundariesVisible, setAirspaceBoundariesVisible] = useState(true);
  const [rangeOutlineVisible, setRangeOutlineVisible] = useState(true);
  const [nexradVisible, setNexradVisible] = useState(true);
  const [noaaInfraredVisible, setNoaaInfraredVisible] = useState(true);
  const [noaaRadarVisible, setNoaaRadarVisible] = useState(true);
  const [dwdRadolanVisible, setDwdRadolanVisible] = useState(true);
  const [aircraftVisible, setAircraftVisible] = useState(true);
  const [userLocationVisible, setUserLocationVisible] = useState(true);
  const [selectedAircraftHex, setSelectedAircraftHex] = useState<string | null>(null);
  const [selectedAircraftInfo, setSelectedAircraftInfo] = useState<SelectedAircraftInfo | null>(
    null,
  );
  const [followSelectedAircraft, setFollowSelectedAircraft] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>("altitude");
  // Hover tooltip state (design.md Decision 10) — deliberately separate from
  // selection state above; hovering never opens `AircraftOverlay`.
  const [hoveredAircraft, setHoveredAircraft] = useState<
    (Aircraft & { lat: number; lon: number }) | null
  >(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(() =>
    getMapTilerKey()
      ? null
      : "Map unavailable: NEXT_PUBLIC_MAPTILER_KEY is not set. Add a MapTiler API key to .env.local to load the map.",
  );

  // Toggles/selects the clicked aircraft (design.md Decisions 1-3): the
  // already-selected hex clicked again deselects; any other hex replaces
  // the current selection. `picked`, when available (the deck.gl pick's
  // `info.object`, looked up by the `refreshAircraft` call site below since
  // `buildAircraftLayers`'s own `onAircraftClick` only forwards a hex — see
  // aircraftLayer.ts), lets a fresh selection recenter the camera
  // immediately rather than waiting for the next poll (design.md Decision
  // 13's "Camera centers on the aircraft immediately upon selection").
  const handleAircraftClick = (hex: string | null, picked?: Aircraft) => {
    // react-hooks/purity flags this `Date.now()` conservatively: its static
    // reachability analysis can't prove `handleAircraftClick` is only ever
    // invoked from user interaction (the aircraft IconLayer's onClick, the
    // map's click/Escape listeners, and the overlay's close button — never
    // during render). Same documented-exception pattern as the
    // exhaustive-deps disable below in this file's mount effect.
    // eslint-disable-next-line react-hooks/purity
    lastAircraftClickAtRef.current = Date.now();
    const next = hex && hex === selectedAircraftHexRef.current ? null : hex;
    selectedAircraftHexRef.current = next;
    setSelectedAircraftHex(next);

    if (next === null) {
      setSelectedAircraftInfo(null);
      routeCacheRef.current.clear();
    } else if (
      followSelectedAircraftRef.current &&
      picked?.lat !== undefined &&
      picked?.lon !== undefined &&
      mapRef.current
    ) {
      mapRef.current.easeTo({
        center: [picked.lon, picked.lat],
        duration: FOLLOW_SELECTED_AIRCRAFT_EASE_MS,
      });
    }

    // Rebuild layers immediately (clearing/showing the glow highlight)
    // rather than waiting up to ~1s for the next scheduled poll, on both
    // selection and deselection — same "don't wait for the next tick"
    // reasoning as the camera recenter above.
    void refreshAircraft();
  };

  const refreshAircraft = async () => {
    if (!deckOverlayRef.current) return;
    if (!aircraftVisibleRef.current) {
      deckOverlayRef.current.setProps({ layers: [] });
      clearRotorMarkers();
      return;
    }
    const aircraft = await fetchAircraft();
    updateTracks(aircraft);

    // Deselect-on-drop-out (aircraft-tracks-layer spec's "Selected aircraft
    // drops out of the feed" scenario).
    if (
      selectedAircraftHexRef.current &&
      !aircraft.some((a) => a.hex === selectedAircraftHexRef.current)
    ) {
      selectedAircraftHexRef.current = null;
      setSelectedAircraftHex(null);
      setSelectedAircraftInfo(null);
      routeCacheRef.current.clear();
    }

    const layers = buildAircraftLayers({
      aircraft,
      tracks: getAllTracks(),
      iconAtlas: aircraftIconAtlasRef.current,
      selectedHex: selectedAircraftHexRef.current,
      colorMode: colorModeRef.current,
      // See aircraftLayer.ts's getAngle doc comment: billboard icons rotate
      // in screen-pixel space, not world space, so they don't automatically
      // follow the camera's own bearing the way track lines do — the icon
      // layer needs the current bearing explicitly to keep pointing the
      // right way once the user has rotated/tilted the view.
      bearingDeg: mapRef.current?.getBearing() ?? 0,
      onAircraftClick: (hex) =>
        handleAircraftClick(hex, hex ? aircraft.find((a) => a.hex === hex) : undefined),
      onAircraftHover: (hovered, x, y) => {
        setHoveredAircraft(hovered);
        if (hovered) setHoverPosition({ x, y });
      },
    });
    deckOverlayRef.current.setProps({ layers });

    if (mapRef.current) updateRotorMarkers(mapRef.current, aircraft);

    const selected = selectedAircraftHexRef.current
      ? aircraft.find((a) => a.hex === selectedAircraftHexRef.current)
      : undefined;
    if (!selected) return;

    // Follow: recenter on every subsequent poll while locked (design.md
    // Decision 13's "Map recenters on every refresh while following") — in
    // addition to handleAircraftClick's own immediate recenter on selection.
    if (
      followSelectedAircraftRef.current &&
      mapRef.current &&
      selected.lat !== undefined &&
      selected.lon !== undefined
    ) {
      mapRef.current.easeTo({
        center: [selected.lon, selected.lat],
        duration: FOLLOW_SELECTED_AIRCRAFT_EASE_MS,
      });
    }

    let route: FlightRoute | null = null;
    if (selected.callsign && selected.lat !== undefined && selected.lon !== undefined) {
      const cacheKey = `${selected.hex}:${selected.callsign}`;
      if (routeCacheRef.current.has(cacheKey)) {
        route = routeCacheRef.current.get(cacheKey) ?? null;
      } else {
        route = await getFlightRoute(selected.callsign, selected.lat, selected.lon);
        routeCacheRef.current.set(cacheKey, route);
      }
    }

    setSelectedAircraftInfo(
      buildSelectedAircraftInfo(selected, getTrack(selected.hex), userLocationRef.current, route),
    );
  };

  // Own poll of fetchAircraft(), separate from `refreshAircraft` above —
  // this layer must render aircraft dots independent of whether the
  // aircraft-icons layer is toggled on (design.md Decision 6).
  const refreshRangeOutlineAircraft = async () => {
    if (!rangeOutlineVisibleRef.current) return;
    rangeOutlineAircraftRef.current = await fetchAircraft();
  };

  // Refetches outline.json, updates the MapLibre fill layer's source, and
  // caches the parsed FeatureCollection for the sweep overlay's own
  // ray-cast geometry (`refreshRangeOutline` returns it precisely so this
  // doesn't need a second fetch).
  const refreshRangeOutlineData = async () => {
    if (!mapRef.current) return;
    rangeOutlineDataRef.current = await refreshRangeOutline(mapRef.current);
  };

  const rangeOutlineSweepFrame = (nowMs: number) => {
    const overlay = rangeOutlineOverlayRef.current;
    if (!overlay) return;

    const elapsedMs = nowMs - rangeOutlineSweepStartRef.current;
    const previousAngleDeg = rangeOutlineSweepAngleRef.current;
    const currentAngleDeg = computeSweepAngleDeg(elapsedMs, RANGE_OUTLINE_SWEEP_PERIOD_MS);
    rangeOutlineSweepAngleRef.current = currentAngleDeg;

    const site = rangeOutlineSiteRef.current;
    // `nowMs` (the rAF timestamp, same clock as `performance.now()` used to
    // seed `rangeOutlineSweepStartRef`) rather than `Date.now()` — only
    // relative deltas matter for flash-duration bookkeeping, and this keeps
    // every timestamp in this loop on one consistent, monotonic clock.
    if (site) {
      updateFlashTimestamps({
        aircraft: rangeOutlineAircraftRef.current,
        site,
        previousAngleDeg,
        currentAngleDeg,
        now: nowMs,
      });
    }

    const layers = buildRangeOutlineSweepLayers({
      outline: rangeOutlineDataRef.current,
      site,
      sweepAngleDeg: currentAngleDeg,
      aircraft: rangeOutlineAircraftRef.current,
      now: nowMs,
    });
    overlay.setProps({ layers });

    rangeOutlineSweepRafRef.current = requestAnimationFrame(rangeOutlineSweepFrame);
  };

  const startRangeOutlineSweep = () => {
    if (rangeOutlineSweepRafRef.current !== null) return; // already running
    rangeOutlineSweepStartRef.current = performance.now();
    rangeOutlineSweepAngleRef.current = 0;
    rangeOutlineSweepRafRef.current = requestAnimationFrame(rangeOutlineSweepFrame);
  };

  const stopRangeOutlineSweep = () => {
    if (rangeOutlineSweepRafRef.current !== null) {
      cancelAnimationFrame(rangeOutlineSweepRafRef.current);
      rangeOutlineSweepRafRef.current = null;
    }
    // Clears the wedge/dots immediately rather than leaving the last frame
    // painted, and resets flash state so re-enabling starts fresh (mirrors
    // aircraft.ts's clearTracks-on-disable).
    rangeOutlineOverlayRef.current?.setProps({ layers: [] });
    clearRangeOutlineFlashTimestamps();
  };

  const handleLocationResolved = (coords: GeoCoords | null) => {
    userLocationRef.current = coords;
    // `resolveUserLocation()` can resolve before the map's "load"/"style.load"
    // handler (`setupStyleDependentState`) has run for the first time (e.g. a
    // fast feeder/geolocation result racing initial style load), and
    // `addSource`/`addLayer` throw if called before the style is ready.
    // `styleReadyRef` mirrors exactly what that handler has already
    // established as safe (it's the same event `addCustomLayers` relies on);
    // `map.isStyleLoaded()` is NOT a safe substitute here — it reflects
    // whether every currently-visible tile has finished loading, not just
    // whether the initial style parse completed, so it can still read false
    // well after the map is otherwise ready to accept new sources.
    // `userLocationRef.current` is already set above, so if the style isn't
    // ready yet, `setupStyleDependentState` will add the marker/rings itself
    // once "load"/"style.load" fires — no separate retry needed here.
    if (coords && mapRef.current && styleReadyRef.current) {
      addUserLocationLayers(mapRef.current, coords, AIRPORTS_LAYER_ID);
      setUserLocationVisibility(mapRef.current, userLocationVisibleRef.current);
      // Location can resolve asynchronously, after the range-outline layers
      // already exist — re-assert their position below airports/above the
      // range-circle rings this call just (re)added. See
      // `moveRangeOutlineBelowAirports`'s doc comment for why this can't
      // just be a one-time `before` at creation.
      moveRangeOutlineBelowAirports(mapRef.current);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const apiKey = getMapTilerKey();
    if (!apiKey) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: getStyleUrl(themeRef.current),
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      pitch: INITIAL_PITCH,
      maxPitch: MAX_PITCH,
      bearing: INITIAL_BEARING,
    });
    mapRef.current = map;
    map.addControl(
      new NavigationControl({
        showZoom: true,
        showCompass: true,
        visualizePitch: true,
      }),
      "top-left",
    );

    // Unlike the style-owned custom layers below (re-added in
    // `setupStyleDependentState` on every `style.load`), this overlay is
    // NOT part of the MapLibre style — `setStyle` never discards it, so it's
    // added once here and only needs `setProps({ layers })` afterward. See
    // design.md Decision 2.
    //
    // `interleaved: false`: with this app's terrain enabled,
    // `@deck.gl/mapbox` 9.3.10's `centerCameraOnTerrain` (in
    // `getViewState`, called on every render) unconditionally read
    // `map.transform.elevation` with no guard — MapLibre GL JS 6.5's `Map`
    // exposes `transform` as undefined at the point this runs, so every
    // single call threw, and `getViewState` never returned a value.
    // Root-caused and fixed via `patches/@deck.gl+mapbox+9.3.10.patch`
    // (`patch-package`, applied on `postinstall`): adds the missing `?.`.
    // Before that fix this exception aborted `_updateViewState` on every
    // render, which corrupted deck.gl's view-state sync with MapLibre's
    // camera — the visible symptom wasn't just console noise, aircraft
    // icons rendered at the wrong screen position because deck.gl's
    // overlay camera had desynced from MapLibre's. With the patch applied
    // the exception is gone and view-state sync is correct. `interleaved`
    // is still kept `false` — `interleaved: true` was verified to crash
    // this app's render loop entirely (blank map) before the patch existed
    // (an uncaught exception inside MapLibre's own custom-layer render call
    // aborts that frame); revisit `interleaved: true` now that the root
    // cause is patched, since it would restore proper depth-sorting against
    // the 3D terrain mesh (an aircraft icon currently isn't occluded by a
    // mountain in front of it) — not re-tested here, left as a follow-up.
    // Dedicated overlay for the actual-range-outline's radar sweep (design.md
    // Decision 4) — mounted once here, not re-added on `style.load` (not
    // part of the MapLibre style). Added *before* the aircraft overlay below:
    // for two separate non-interleaved `MapboxOverlay` canvases, whichever is
    // added later ends up later in the DOM and paints on top — so the sweep
    // has to go first for aircraft icons to render above it, not the other
    // way around (previously backwards here, which put the sweep wedge on
    // top of the aircraft; see tasks.md 6.6's original, incorrect ordering
    // rationale).
    const rangeOutlineOverlay = new MapboxOverlay({ interleaved: false, layers: [] });
    rangeOutlineOverlayRef.current = rangeOutlineOverlay;
    map.addControl(rangeOutlineOverlay);

    const deckOverlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      // design.md Decision 9: a bigger effective click radius than deck.gl's
      // default (0px, i.e. pixel-exact) so small/distant aircraft icons are
      // easier to select without requiring a pixel-precise click.
      pickingRadius: 12,
    });
    deckOverlayRef.current = deckOverlay;
    map.addControl(deckOverlay);

    // Built once (rasterizing every vendored SVG into a single canvas atlas
    // — see aircraftIcons.ts) rather than per-poll; the first refresh is
    // kicked off once it's ready so aircraft render with icons from the
    // start rather than needing a second poll interval to pick them up.
    buildAircraftIconAtlas().then((atlas) => {
      aircraftIconAtlasRef.current = atlas;
      void refreshAircraft();
    });

    // The sweep's own site anchor (design.md Decision 5) — resolved once,
    // independent of `resolveUserLocation()` below, which can fall back to
    // browser geolocation when no feeder is configured; the sweep must use
    // the feeder's own surveyed position or not render at all.
    getFeederLocation().then((coords) => {
      rangeOutlineSiteRef.current = coords;
    });
    void refreshRangeOutlineAircraft();
    if (rangeOutlineVisibleRef.current) startRangeOutlineSweep();

    const setupStyleDependentState = () => {
      styleReadyRef.current = true;
      applyTerrain(map);
      applySky(map);
      // Added before `addCustomLayers` so it lands at the bottom of the
      // custom-layer stack (MapLibre draws layers in insertion order) —
      // the day/night tint sits just above the base style, underneath the
      // sectional chart/military bases/airports, so those stay undimmed.
      addTerminatorLayers(map, themeRef.current, terminatorVisibleRef.current);
      addCustomLayers(map, themeRef.current, {
        military: militaryVisibleRef.current,
        airports: airportsVisibleRef.current,
        openAip: openAipVisibleRef.current,
        rainViewer: rainViewerVisibleRef.current,
        tfr: tfrVisibleRef.current,
        specialUseAirspace: suaVisibleRef.current,
        airspaceBoundaries: airspaceBoundariesVisibleRef.current,
        rangeOutline: rangeOutlineVisibleRef.current,
        nexrad: nexradVisibleRef.current,
        noaaInfrared: noaaInfraredVisibleRef.current,
        noaaRadar: noaaRadarVisibleRef.current,
        dwdRadolan: dwdRadolanVisibleRef.current,
      });
      void refreshTfrs(map);
      void refreshSpecialUseAirspace(map);
      if (airspaceBoundariesVisibleRef.current) void refreshAirspaceBoundaries(map);
      void refreshRangeOutlineData();
      setPilotModeVisibility(map, pilotModeRef.current);
      addUserLocationLayers(map, userLocationRef.current, AIRPORTS_LAYER_ID);
      setUserLocationVisibility(map, userLocationVisibleRef.current);
      // Re-assert stacking order every style reload too — a fresh style
      // swap re-adds every custom layer from scratch, same ordering
      // concerns as the initial add (see
      // `moveRangeOutlineBelowAirports`'s doc comment).
      moveRangeOutlineBelowAirports(map);
    };

    map.on("load", setupStyleDependentState);
    map.on("style.load", setupStyleDependentState);

    map.on("error", (event) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) {
        setError(
          "Map unavailable: the MapTiler API key was rejected. Check NEXT_PUBLIC_MAPTILER_KEY.",
        );
      }
    });

    map.on("mouseenter", AIRPORTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", AIRPORTS_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", USER_LOCATION_ICON_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", USER_LOCATION_ICON_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", USER_LOCATION_ICON_LAYER_ID, () => {
      // Center on the already-resolved location the icon represents,
      // rather than re-requesting geolocation like `handleJumpToLocation`
      // — the icon only renders once a location is known, so there's
      // always a value here.
      if (!userLocationRef.current || !mapRef.current) return;
      mapRef.current.fitBounds(getUserLocationBounds(userLocationRef.current), {
        padding: 40,
      });
    });

    map.on("click", AIRPORTS_LAYER_ID, (event) => {
      const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
      if (!feature || feature.geometry.type !== "Point") return;

      const properties = feature.properties as AirportProperties;
      const [lng, lat] = feature.geometry.coordinates;
      // Half the icon's on-screen height: `icon-anchor: "bottom"` puts the
      // feature coordinate at the icon's base, so this raises the popup's
      // origin from the ground to the icon's midpoint instead.
      const offset = getAirportIconDisplayHeight(map.getZoom()) / 2;
      new Popup({ className: "airport-popup", offset })
        .setLngLat([lng, lat])
        .setHTML(buildAirportPopupHtml(properties))
        .addTo(map);

      const name = properties.name;
      const ident = properties.ident ?? name;
      if (!name || !ident) return;
      fetchAirportImage(name).then((imageUrl) => {
        const slot = document.getElementById(airportImageSlotId(ident));
        if (!slot) return; // popup closed/replaced before the lookup resolved
        if (imageUrl) {
          slot.innerHTML = `<img src="${imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.closest('div').textContent='No image available'" />`;
        } else {
          slot.textContent = "No image available";
        }
      });
    });

    // Deselect-on-click-elsewhere (design.md Decision 3): unscoped (not
    // layer-id-scoped), so it fires for every click on the map, including
    // ones that already hit the aircraft IconLayer's own onClick (deck.gl
    // overlays the same canvas MapLibre owns) — the timestamp guard below
    // skips this handler when that just happened, so a genuine aircraft
    // click doesn't immediately deselect what it just selected.
    map.on("click", () => {
      if (!selectedAircraftHexRef.current) return;
      if (Date.now() - lastAircraftClickAtRef.current < AIRCRAFT_DESELECT_CLICK_GUARD_MS) return;
      handleAircraftClick(null);
    });

    // Escape key deselects (design.md Decision 3), same lifecycle as the
    // other map.on(...) listeners above (removed on unmount below).
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedAircraftHexRef.current) {
        handleAircraftClick(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    resolveUserLocation().then((coords) => {
      handleLocationResolved(coords);
      if (!coords || !mapRef.current) return;
      mapRef.current.fitBounds(getUserLocationBounds(coords), {
        padding: 40,
      });
    });

    const terminatorIntervalId = setInterval(() => {
      if (mapRef.current) refreshTerminator(mapRef.current, themeRef.current);
    }, TERMINATOR_REFRESH_INTERVAL_MS);

    const rainViewerIntervalId = setInterval(() => {
      if (mapRef.current && rainViewerVisibleRef.current) {
        void refreshRainViewer(mapRef.current);
      }
    }, RAINVIEWER_REFRESH_INTERVAL_MS);

    const tfrIntervalId = setInterval(() => {
      if (mapRef.current && tfrVisibleRef.current) {
        void refreshTfrs(mapRef.current);
      }
    }, TFR_REFRESH_INTERVAL_MS);

    const suaIntervalId = setInterval(() => {
      if (mapRef.current && suaVisibleRef.current) {
        void refreshSpecialUseAirspace(mapRef.current);
      }
    }, SUA_REFRESH_INTERVAL_MS);

    const airspaceBoundariesIntervalId = setInterval(() => {
      if (mapRef.current && airspaceBoundariesVisibleRef.current) {
        void refreshAirspaceBoundaries(mapRef.current);
      }
    }, AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS);

    const rangeOutlineIntervalId = setInterval(() => {
      if (mapRef.current && rangeOutlineVisibleRef.current) {
        void refreshRangeOutlineData();
      }
    }, RANGE_OUTLINE_REFRESH_INTERVAL_MS);

    // Much faster than every other layer's refresh interval (5-60 minutes
    // above) — this polls the user's own feeder, not a rate-limited public
    // API, so it can run fast enough for smooth-looking live motion. See
    // constants.ts.
    const aircraftIntervalId = setInterval(() => {
      void refreshAircraft();
    }, AIRCRAFT_FEED_REFRESH_INTERVAL_MS);

    const rangeOutlineAircraftIntervalId = setInterval(() => {
      void refreshRangeOutlineAircraft();
    }, AIRCRAFT_FEED_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(terminatorIntervalId);
      clearInterval(rainViewerIntervalId);
      clearInterval(tfrIntervalId);
      clearInterval(suaIntervalId);
      clearInterval(airspaceBoundariesIntervalId);
      clearInterval(rangeOutlineIntervalId);
      clearInterval(aircraftIntervalId);
      clearInterval(rangeOutlineAircraftIntervalId);
      window.removeEventListener("keydown", handleKeyDown);
      stopRangeOutlineSweep();
      clearRotorMarkers();
      map.remove();
      mapRef.current = null;
    };
    // Mount-once effect: `handleLocationResolved`/`startRangeOutlineSweep`
    // (called directly above to kick off the sweep's rAF loop if visible by
    // default) are plain closures re-created every render, so listing them
    // here would tear the map down and rebuild it on every state change
    // (theme toggle, etc). Both only read refs — never stale state — so
    // it's safe to omit them; `startRangeOutlineSweep` itself is re-created
    // per render but its body is otherwise identical every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleThemeToggle = () => {
    const nextTheme: MapTheme = theme === "dark" ? "light" : "dark";
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    storeTheme(nextTheme);
    // `setStyle` discards the current style immediately; `styleReadyRef`
    // flips back to true once `setupStyleDependentState` re-runs on the
    // resulting "style.load".
    styleReadyRef.current = false;
    mapRef.current?.setStyle(getStyleUrl(nextTheme));
  };

  const handlePilotModeToggle = () => {
    const next = !pilotMode;
    pilotModeRef.current = next;
    setPilotMode(next);
    if (mapRef.current) {
      setPilotModeVisibility(mapRef.current, next);
    }
  };

  const handleMilitaryToggle = () => {
    const next = !militaryVisible;
    militaryVisibleRef.current = next;
    setMilitaryVisible(next);
    if (mapRef.current) {
      setMilitaryBasesVisibility(mapRef.current, next);
    }
  };

  const handleAirportsToggle = () => {
    const next = !airportsVisible;
    airportsVisibleRef.current = next;
    setAirportsVisible(next);
    if (mapRef.current) {
      setAirportsVisibility(mapRef.current, next);
    }
  };

  const handleTerminatorToggle = () => {
    const next = !terminatorVisible;
    terminatorVisibleRef.current = next;
    setTerminatorVisible(next);
    if (mapRef.current) {
      setTerminatorVisibility(mapRef.current, next);
    }
  };

  const handleOpenAipToggle = () => {
    const next = !openAipVisible;
    openAipVisibleRef.current = next;
    setOpenAipVisible(next);
    if (mapRef.current) setOpenAipVisibility(mapRef.current, next);
  };

  const handleRainViewerToggle = () => {
    const next = !rainViewerVisible;
    rainViewerVisibleRef.current = next;
    setRainViewerVisible(next);
    if (mapRef.current) {
      setRainViewerVisibility(mapRef.current, next);
      if (next) void refreshRainViewer(mapRef.current);
    }
  };

  const handleTfrToggle = () => {
    const next = !tfrVisible;
    tfrVisibleRef.current = next;
    setTfrVisible(next);
    if (mapRef.current) {
      setTfrVisibility(mapRef.current, next);
      if (next) void refreshTfrs(mapRef.current);
    }
  };

  const handleSuaToggle = () => {
    const next = !suaVisible;
    suaVisibleRef.current = next;
    setSuaVisible(next);
    if (mapRef.current) {
      setSpecialUseAirspaceVisibility(mapRef.current, next);
      if (next) void refreshSpecialUseAirspace(mapRef.current);
    }
  };

  const handleAirspaceBoundariesToggle = () => {
    const next = !airspaceBoundariesVisible;
    airspaceBoundariesVisibleRef.current = next;
    setAirspaceBoundariesVisible(next);
    if (mapRef.current) {
      setAirspaceBoundariesVisibility(mapRef.current, next);
      if (next) void refreshAirspaceBoundaries(mapRef.current);
    }
  };

  const handleRangeOutlineToggle = () => {
    const next = !rangeOutlineVisible;
    rangeOutlineVisibleRef.current = next;
    setRangeOutlineVisible(next);
    if (mapRef.current) {
      setRangeOutlineVisibility(mapRef.current, next);
      if (next) void refreshRangeOutlineData();
    }
    if (next) {
      void refreshRangeOutlineAircraft();
      startRangeOutlineSweep();
    } else {
      stopRangeOutlineSweep();
    }
  };

  const handleNexradToggle = () => {
    const next = !nexradVisible;
    nexradVisibleRef.current = next;
    setNexradVisible(next);
    if (mapRef.current) setNexradVisibility(mapRef.current, next);
  };

  const handleNoaaInfraredToggle = () => {
    const next = !noaaInfraredVisible;
    noaaInfraredVisibleRef.current = next;
    setNoaaInfraredVisible(next);
    if (mapRef.current) setNoaaInfraredVisibility(mapRef.current, next);
  };

  const handleNoaaRadarToggle = () => {
    const next = !noaaRadarVisible;
    noaaRadarVisibleRef.current = next;
    setNoaaRadarVisible(next);
    if (mapRef.current) setNoaaRadarVisibility(mapRef.current, next);
  };

  const handleDwdRadolanToggle = () => {
    const next = !dwdRadolanVisible;
    dwdRadolanVisibleRef.current = next;
    setDwdRadolanVisible(next);
    if (mapRef.current) setDwdRadolanVisibility(mapRef.current, next);
  };

  const handleAircraftToggle = () => {
    const next = !aircraftVisible;
    aircraftVisibleRef.current = next;
    setAircraftVisible(next);
    if (!next) {
      // Tracks reset on re-enable rather than resuming a stale trail — see
      // aircraft.ts's clearTracks doc comment.
      clearTracks();
    }
    void refreshAircraft();
  };

  const handleUserLocationToggle = () => {
    const next = !userLocationVisible;
    userLocationVisibleRef.current = next;
    setUserLocationVisible(next);
    if (mapRef.current) {
      setUserLocationVisibility(mapRef.current, next);
    }
  };

  const handleJumpToLocation = () => {
    resolveUserLocation().then((coords) => {
      handleLocationResolved(coords);
      if (!coords || !mapRef.current) return;
      mapRef.current.fitBounds(getUserLocationBounds(coords), {
        padding: 40,
      });
    });
  };

  // Toggle + click-to-lock are the same mechanism (design.md Decision 13) —
  // this handler only flips the flag the click/poll recenter logic above
  // already reads; it doesn't itself recenter (no surprise camera snap from
  // toggling alone).
  const handleColorModeChange = (mode: ColorMode) => {
    colorModeRef.current = mode;
    setColorMode(mode);
    void refreshAircraft();
  };

  const handleFollowSelectedAircraftToggle = () => {
    const next = !followSelectedAircraft;
    followSelectedAircraftRef.current = next;
    setFollowSelectedAircraft(next);
  };

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorBody}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.container} />
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleThemeToggle}
          suppressHydrationWarning
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={pilotMode}
          onClick={handlePilotModeToggle}
        >
          Pilot mode
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={militaryVisible}
          onClick={handleMilitaryToggle}
        >
          {militaryVisible ? "Hide military bases" : "Show military bases"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={airportsVisible}
          onClick={handleAirportsToggle}
        >
          {airportsVisible ? "Hide airports" : "Show airports"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={terminatorVisible}
          onClick={handleTerminatorToggle}
        >
          {terminatorVisible ? "Hide day/night terminator" : "Show day/night terminator"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={openAipVisible}
          onClick={handleOpenAipToggle}
        >
          {openAipVisible ? "Hide OpenAIP airspace" : "Show OpenAIP airspace"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={rainViewerVisible}
          onClick={handleRainViewerToggle}
        >
          {rainViewerVisible ? "Hide RainViewer radar" : "Show RainViewer radar"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={tfrVisible}
          onClick={handleTfrToggle}
        >
          {tfrVisible ? "Hide TFRs" : "Show TFRs"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={suaVisible}
          onClick={handleSuaToggle}
        >
          {suaVisible ? "Hide special use airspace" : "Show special use airspace"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={airspaceBoundariesVisible}
          onClick={handleAirspaceBoundariesToggle}
        >
          {airspaceBoundariesVisible
            ? "Hide airspace boundaries"
            : "Show airspace boundaries"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={rangeOutlineVisible}
          onClick={handleRangeOutlineToggle}
        >
          {rangeOutlineVisible
            ? "Hide actual range outline"
            : "Show actual range outline"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={nexradVisible}
          onClick={handleNexradToggle}
        >
          {nexradVisible ? "Hide NEXRAD" : "Show NEXRAD"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={noaaInfraredVisible}
          onClick={handleNoaaInfraredToggle}
        >
          {noaaInfraredVisible ? "Hide NOAA infrared" : "Show NOAA infrared"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={noaaRadarVisible}
          onClick={handleNoaaRadarToggle}
        >
          {noaaRadarVisible ? "Hide NOAA Radar" : "Show NOAA Radar"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={dwdRadolanVisible}
          onClick={handleDwdRadolanToggle}
        >
          {dwdRadolanVisible ? "Hide DWD RADOLAN" : "Show DWD RADOLAN"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={aircraftVisible}
          onClick={handleAircraftToggle}
        >
          {aircraftVisible ? "Hide aircraft" : "Show aircraft"}
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={followSelectedAircraft}
          onClick={handleFollowSelectedAircraftToggle}
        >
          Follow selected aircraft
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleJumpToLocation}
        >
          My location
        </button>
        <button
          type="button"
          className={styles.controlButton}
          data-active={userLocationVisible}
          onClick={handleUserLocationToggle}
        >
          {userLocationVisible ? "Hide my location" : "Show my location"}
        </button>
      </div>
      <AircraftOverlay info={selectedAircraftInfo} onClose={() => handleAircraftClick(null)} />
      <AircraftColorDock
        colorMode={colorMode}
        onColorModeChange={handleColorModeChange}
        onRecenter={handleJumpToLocation}
        drawerOpen={selectedAircraftInfo !== null}
      />
      <ColorModeLegendDock colorMode={colorMode} drawerOpen={selectedAircraftInfo !== null} />
      {hoveredAircraft && (
        <AircraftHoverTooltip
          aircraft={hoveredAircraft}
          x={hoverPosition.x}
          y={hoverPosition.y}
        />
      )}
    </div>
  );
}

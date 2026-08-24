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
import { fetchAircraft, updateTracks, getAllTracks, clearTracks } from "./aircraft";
import { buildAircraftIconAtlas, type IconAtlas } from "./aircraftIcons";
import { buildAircraftLayers } from "./aircraftLayer";
import {
  addCustomLayers,
  AIRPORTS_LAYER_ID,
  getAirportIconDisplayHeight,
  refreshAirspaceBoundaries,
  refreshRainViewer,
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
  setSpecialUseAirspaceVisibility,
  setTfrVisibility,
} from "./layers";
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
} from "./userLocation";
import {
  addTerminatorLayers,
  refreshTerminator,
  setTerminatorVisibility,
} from "./terminator";
import { getCurrentLocation, type GeoCoords } from "./geolocation";
import {
  AIRCRAFT_FEED_REFRESH_INTERVAL_MS,
  AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS,
  DEFAULT_VIEW,
  INITIAL_BEARING,
  INITIAL_PITCH,
  MAX_PITCH,
  RAINVIEWER_REFRESH_INTERVAL_MS,
  SUA_REFRESH_INTERVAL_MS,
  TERMINATOR_REFRESH_INTERVAL_MS,
  TFR_REFRESH_INTERVAL_MS,
} from "./constants";

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
  const [nexradVisible, setNexradVisible] = useState(true);
  const [noaaInfraredVisible, setNoaaInfraredVisible] = useState(true);
  const [noaaRadarVisible, setNoaaRadarVisible] = useState(true);
  const [dwdRadolanVisible, setDwdRadolanVisible] = useState(true);
  const [aircraftVisible, setAircraftVisible] = useState(true);
  const [userLocationVisible, setUserLocationVisible] = useState(true);
  const [error, setError] = useState<string | null>(() =>
    getMapTilerKey()
      ? null
      : "Map unavailable: NEXT_PUBLIC_MAPTILER_KEY is not set. Add a MapTiler API key to .env.local to load the map.",
  );

  const refreshAircraft = async () => {
    if (!deckOverlayRef.current) return;
    if (!aircraftVisibleRef.current) {
      deckOverlayRef.current.setProps({ layers: [] });
      return;
    }
    const aircraft = await fetchAircraft();
    updateTracks(aircraft);
    const layers = buildAircraftLayers({
      aircraft,
      tracks: getAllTracks(),
      iconAtlas: aircraftIconAtlasRef.current,
    });
    deckOverlayRef.current.setProps({ layers });
  };

  const handleLocationResolved = (coords: GeoCoords | null) => {
    userLocationRef.current = coords;
    // `getCurrentLocation()` can resolve before the map's "load"/"style.load"
    // handler (`setupStyleDependentState`) has run for the first time (e.g. a
    // fast/cached geolocation result racing initial style load), and
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
      addUserLocationLayers(mapRef.current, coords);
      setUserLocationVisibility(mapRef.current, userLocationVisibleRef.current);
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
    const deckOverlay = new MapboxOverlay({ interleaved: false, layers: [] });
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
        nexrad: nexradVisibleRef.current,
        noaaInfrared: noaaInfraredVisibleRef.current,
        noaaRadar: noaaRadarVisibleRef.current,
        dwdRadolan: dwdRadolanVisibleRef.current,
      });
      void refreshTfrs(map);
      void refreshSpecialUseAirspace(map);
      if (airspaceBoundariesVisibleRef.current) void refreshAirspaceBoundaries(map);
      setPilotModeVisibility(map, pilotModeRef.current);
      addUserLocationLayers(map, userLocationRef.current);
      setUserLocationVisibility(map, userLocationVisibleRef.current);
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
    getCurrentLocation().then((coords) => {
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

    // Much faster than every other layer's refresh interval (5-60 minutes
    // above) — this polls the user's own feeder, not a rate-limited public
    // API, so it can run fast enough for smooth-looking live motion. See
    // constants.ts.
    const aircraftIntervalId = setInterval(() => {
      void refreshAircraft();
    }, AIRCRAFT_FEED_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(terminatorIntervalId);
      clearInterval(rainViewerIntervalId);
      clearInterval(tfrIntervalId);
      clearInterval(suaIntervalId);
      clearInterval(airspaceBoundariesIntervalId);
      clearInterval(aircraftIntervalId);
      map.remove();
      mapRef.current = null;
    };
    // Mount-once effect: `handleLocationResolved` is a plain closure
    // re-created every render, so listing it here would tear the map down
    // and rebuild it on every state change (theme toggle, etc). It's only
    // ever called from map event handlers/promises after this effect has
    // already run, and only reads refs — never stale state — so it's safe
    // to omit it.
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
    getCurrentLocation().then((coords) => {
      handleLocationResolved(coords);
      if (!coords || !mapRef.current) return;
      mapRef.current.fitBounds(getUserLocationBounds(coords), {
        padding: 40,
      });
    });
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
    </div>
  );
}

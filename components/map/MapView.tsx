"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import styles from "./MapView.module.css";
import {
  getMapTilerKey,
  getStyleUrl,
  type MapTheme,
} from "./mapStyles";
import { getInitialTheme, storeTheme } from "./theme";
import { applySky, applyTerrain } from "./terrain";
import {
  addCustomLayers,
  setMilitaryBasesVisibility,
  setPilotModeVisibility,
} from "./layers";
import {
  addUserLocationLayers,
  getUserLocationBounds,
  startDishRotation,
} from "./userLocation";
import { getCurrentLocation, type GeoCoords } from "./geolocation";
import {
  DEFAULT_VIEW,
  INITIAL_BEARING,
  INITIAL_PITCH,
  MAX_PITCH,
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
  const userLocationRef = useRef<GeoCoords | null>(null);
  const styleReadyRef = useRef(false);
  const dishRotationStopRef = useRef<(() => void) | null>(null);

  const [theme, setTheme] = useState<MapTheme>(() => getInitialTheme());
  const [pilotMode, setPilotMode] = useState(false);
  const [militaryVisible, setMilitaryVisible] = useState(true);
  const [error, setError] = useState<string | null>(() =>
    getMapTilerKey()
      ? null
      : "Map unavailable: NEXT_PUBLIC_MAPTILER_KEY is not set. Add a MapTiler API key to .env.local to load the map.",
  );

  // Stops any in-flight rotation loop before starting a new one — a leaked
  // `requestAnimationFrame` loop from a previous location/style reload would
  // otherwise keep calling `setData` forever. Stable identity (only refs in
  // its closure) so it can safely sit in the mount effect's dependency array.
  const restartDishRotation = useCallback((map: MapLibreMap, coords: GeoCoords) => {
    dishRotationStopRef.current?.();
    dishRotationStopRef.current = startDishRotation(map, coords);
  }, []);

  // Stable identity for the same reason as `restartDishRotation` above.
  const handleLocationResolved = useCallback(
    (coords: GeoCoords | null) => {
      userLocationRef.current = coords;
      // `getCurrentLocation()` can resolve before the map's "load"/"style.load"
      // handler (`setupStyleDependentState`) has run for the first time (e.g.
      // a fast/cached geolocation result racing initial style load), and
      // `addSource`/`addLayer` throw if called before the style is ready.
      // `styleReadyRef` mirrors exactly what that handler has already
      // established as safe (it's the same event `addCustomLayers` relies
      // on); `map.isStyleLoaded()` is NOT a safe substitute here — it
      // reflects whether every currently-visible tile has finished loading,
      // not just whether the initial style parse completed, so it can still
      // read false well after the map is otherwise ready to accept new
      // sources. `userLocationRef.current` is already set above, so if the
      // style isn't ready yet, `setupStyleDependentState` will add the
      // dish/rings itself once "load"/"style.load" fires — no separate retry
      // needed here.
      if (coords && mapRef.current && styleReadyRef.current) {
        addUserLocationLayers(mapRef.current, coords);
        restartDishRotation(mapRef.current, coords);
      }
    },
    [restartDishRotation],
  );

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

    const setupStyleDependentState = () => {
      styleReadyRef.current = true;
      applyTerrain(map);
      applySky(map);
      addCustomLayers(map, themeRef.current, militaryVisibleRef.current);
      setPilotModeVisibility(map, pilotModeRef.current);
      addUserLocationLayers(map, userLocationRef.current);
      if (userLocationRef.current) {
        restartDishRotation(map, userLocationRef.current);
      }
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

    getCurrentLocation().then((coords) => {
      handleLocationResolved(coords);
      if (!coords || !mapRef.current) return;
      mapRef.current.fitBounds(getUserLocationBounds(coords), {
        padding: 40,
      });
    });

    return () => {
      dishRotationStopRef.current?.();
      dishRotationStopRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [handleLocationResolved, restartDishRotation]);

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
          onClick={handleJumpToLocation}
        >
          My location
        </button>
      </div>
    </div>
  );
}

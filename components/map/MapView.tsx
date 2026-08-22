"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import styles from "./MapView.module.css";
import {
  getMapTilerKey,
  getStyleUrl,
  type MapTheme,
} from "./mapStyles";
import { getInitialTheme, storeTheme } from "./theme";
import { applySky, applyTerrain } from "./terrain";
import { addCustomLayers, setPilotModeVisibility } from "./layers";
import { getCurrentLocation } from "./geolocation";
import {
  DEFAULT_VIEW,
  GEOLOCATION_ZOOM,
  INITIAL_BEARING,
  INITIAL_PITCH,
  MAX_PITCH,
} from "./constants";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const themeRef = useRef<MapTheme>("light");
  const pilotModeRef = useRef(false);

  const [theme, setTheme] = useState<MapTheme>(() => getInitialTheme());
  const [pilotMode, setPilotMode] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    getMapTilerKey()
      ? null
      : "Map unavailable: NEXT_PUBLIC_MAPTILER_KEY is not set. Add a MapTiler API key to .env.local to load the map.",
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const apiKey = getMapTilerKey();
    if (!apiKey) return;

    themeRef.current = theme;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: getStyleUrl(theme),
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      pitch: INITIAL_PITCH,
      maxPitch: MAX_PITCH,
      bearing: INITIAL_BEARING,
    });
    mapRef.current = map;

    const setupStyleDependentState = () => {
      applyTerrain(map);
      applySky(map);
      addCustomLayers(map, themeRef.current);
      setPilotModeVisibility(map, pilotModeRef.current);
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
      if (!coords || !mapRef.current) return;
      mapRef.current.flyTo({
        center: [coords.longitude, coords.latitude],
        zoom: GEOLOCATION_ZOOM,
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleThemeToggle = () => {
    const nextTheme: MapTheme = theme === "dark" ? "light" : "dark";
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    storeTheme(nextTheme);
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
      </div>
    </div>
  );
}

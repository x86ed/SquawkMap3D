"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type MapGeoJSONFeature,
} from "maplibre-gl";
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
  AIRPORTS_LAYER_ID,
  setAirportsVisibility,
  setMilitaryBasesVisibility,
  setPilotModeVisibility,
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
  const airportsVisibleRef = useRef(true);
  const userLocationRef = useRef<GeoCoords | null>(null);
  const styleReadyRef = useRef(false);
  const dishRotationStopRef = useRef<(() => void) | null>(null);

  const [theme, setTheme] = useState<MapTheme>(() => getInitialTheme());
  const [pilotMode, setPilotMode] = useState(false);
  const [militaryVisible, setMilitaryVisible] = useState(true);
  const [airportsVisible, setAirportsVisible] = useState(true);
  const [error, setError] = useState<string | null>(() =>
    getMapTilerKey()
      ? null
      : "Map unavailable: NEXT_PUBLIC_MAPTILER_KEY is not set. Add a MapTiler API key to .env.local to load the map.",
  );

  // Stops any in-flight rotation loop before starting a new one — a leaked
  // `requestAnimationFrame` loop from a previous location/style reload would
  // otherwise keep calling `setData` forever.
  const restartDishRotation = (map: MapLibreMap, coords: GeoCoords) => {
    dishRotationStopRef.current?.();
    dishRotationStopRef.current = startDishRotation(
      map,
      coords,
      () => styleReadyRef.current,
    );
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
    // ready yet, `setupStyleDependentState` will add the dish/rings itself
    // once "load"/"style.load" fires — no separate retry needed here.
    if (coords && mapRef.current && styleReadyRef.current) {
      addUserLocationLayers(mapRef.current, coords);
      restartDishRotation(mapRef.current, coords);
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

    const setupStyleDependentState = () => {
      styleReadyRef.current = true;
      applyTerrain(map);
      applySky(map);
      addCustomLayers(
        map,
        themeRef.current,
        militaryVisibleRef.current,
        airportsVisibleRef.current,
      );
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
      new Popup({ className: "airport-popup" })
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

    return () => {
      dishRotationStopRef.current?.();
      dishRotationStopRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Mount-once effect: `handleLocationResolved`/`restartDishRotation` are
    // plain closures re-created every render, so listing them here would
    // tear the map down and rebuild it on every state change (theme toggle,
    // etc). They're only ever called from map event handlers/promises after
    // this effect has already run, and only read refs — never stale state —
    // so it's safe to omit them.
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
          onClick={handleJumpToLocation}
        >
          My location
        </button>
      </div>
    </div>
  );
}

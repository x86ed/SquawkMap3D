export const DEFAULT_VIEW = {
  center: [-98.5795, 39.8283] as [number, number], // geographic center of the contiguous US
  zoom: 4,
};

export const GEOLOCATION_ZOOM = 11;
export const INITIAL_PITCH = 60;
export const MAX_PITCH = 85;
export const INITIAL_BEARING = 0;
export const TERRAIN_EXAGGERATION = 3;

// ChartBundle (the original free sectional-tile host) shut down permanently
// (unmaintained, security vulnerabilities) — its domain no longer resolves.
// FAA's own VFR Sectional service, hosted on Esri's tiles.arcgis.com, is the
// live replacement: public, no key required. Esri's tile scheme is {z}/{y}/{x}
// (row before column) and only serves zoom levels 8-12 (see FAA_SECTIONAL_MINZOOM/MAXZOOM).
export const FAA_SECTIONAL_TILE_URL =
  "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}";
export const FAA_SECTIONAL_MINZOOM = 8;
export const FAA_SECTIONAL_MAXZOOM = 12;

export const METERS_PER_NM = 1852;
export const RANGE_RING_RADII_NM = [50, 100, 150, 200] as const;

// Solar-elevation thresholds (degrees) for the day/night terminator's
// twilight bands, from a light dusk threshold down to -18° (the end of
// astronomical twilight — beyond this the sky is fully dark). Ordered
// highest (largest, lightest band) to lowest (smallest, darkest band) —
// `addTerminatorLayers` relies on this order to stack them correctly.
export const TERMINATOR_ELEVATION_BANDS_DEG = [
  3, 0, -3, -6, -9, -12, -15, -18,
] as const;

export const TERMINATOR_REFRESH_INTERVAL_MS = 60_000;

// OpenAIP's tile host round-robins across these three subdomains (no
// wildcard templating support in MapLibre's `tiles` array, so all three are
// listed explicitly). Requires an API key — free tier via openaip.net.
export const OPENAIP_TILE_SUBDOMAINS = ["a", "b", "c"] as const;
export const OPENAIP_TILE_URL_TEMPLATE =
  "https://{s}.api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png";
export const OPENAIP_MINZOOM = 4;
export const OPENAIP_MAXZOOM = 14;

export function getOpenAipApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_OPENAIP_API_KEY;
}

// RainViewer's frame list/host come from this JSON endpoint; the tile URL
// is built at runtime from `host` + the current frame's `path` (see
// `rainviewer.ts`) rather than a static template, since the available frame
// timestamp changes as new radar sweeps arrive. No API key required.
export const RAINVIEWER_MAPS_JSON_URL =
  "https://api.rainviewer.com/public/weather-maps.json";
export const RAINVIEWER_TILE_SIZE = 256;
// "2" = Universal Blue color scheme; "1_1" = smooth+snow enabled. See
// RainViewer's own API docs/example repo for the full options grammar.
export const RAINVIEWER_COLOR_SCHEME = 2;
export const RAINVIEWER_TILE_OPTIONS = "1_1";
export const RAINVIEWER_REFRESH_INTERVAL_MS = 5 * 60_000;

// Iowa Environmental Mesonet's tile cache serves the national NEXRAD
// composite reflectivity mosaic (n0q) as a plain XYZ raster, no key.
export const NEXRAD_TILE_URL =
  "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png";
export const NEXRAD_MINZOOM = 2;
export const NEXRAD_MAXZOOM = 12;

// NOAA/NWS's own nowCOAST WMS, distinct from the IEM-hosted NEXRAD mosaic
// above per the acceptance criteria listing them as separate layers. WMS
// raster sources use MapLibre's `{bbox-epsg-3857}` template token.
export const NOAA_RADAR_WMS_BASE_URL =
  "https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows";
export const NOAA_RADAR_WMS_LAYER = "conus_base_reflectivity_mosaic";

// DWD (Deutscher Wetterdienst) RADOLAN precipitation radar composite —
// "RY", the quality-controlled 5-minute national mosaic (Germany-only
// coverage). Layer name confirmed live against this endpoint's own
// GetCapabilities (`RADOLAN-RY`, no workspace prefix needed within the
// already-`dwd`-scoped WMS path).
export const DWD_RADOLAN_WMS_BASE_URL = "https://maps.dwd.de/geoserver/dwd/wms";
export const DWD_RADOLAN_WMS_LAYER = "RADOLAN-RY";

// FAA's own ArcGIS-hosted feature service (same org as FAA_SECTIONAL_TILE_URL
// above) — confirmed live via its REST directory. Polygon geometry; `CLASS`/
// `TYPE_CODE` fields distinguish restricted/prohibited/warning/alert/MOA.
export const SUA_FEATURE_SERVICE_QUERY_URL =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";
export const SUA_REFRESH_INTERVAL_MS = 10 * 60_000;

// No live public feed was found for day-to-day TFRs at implementation time
// (FAA/ArcGIS only host static/permanent restricted-airspace layers, not
// TFRs, which change daily and require a NOTAM-based or FAA SWIM source).
// Left unset so `tfr.ts` serves an empty FeatureCollection until a real feed
// is wired in — the layer, toggle, and refresh loop are otherwise complete.
export const TFR_FEED_URL: string | undefined = undefined;
export const TFR_REFRESH_INTERVAL_MS = 5 * 60_000;

// VATSIM's `vatspy-data-project` publishes global FIR/UIR/oceanic ATC
// boundary polygons as a public, unauthenticated GeoJSON feed — confirmed
// live: a `FeatureCollection` of `MultiPolygon` features, each with
// `properties.id`/`oceanic`/`region`/`division`/`label_lon`/`label_lat`.
// Always fetched live at request time (never vendored) per the acceptance
// criteria; hourly refresh matches how rarely the boundary set changes.
export const AIRSPACE_BOUNDARIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/refs/heads/master/Boundaries.geojson";
export const AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS = 60 * 60_000;

// No free/no-key NOAA GOES infrared satellite tile source was confirmed at
// implementation time. Left unset so the layer no-ops (like OpenAIP without
// a key) until a real tile/WMS source is wired in.
export const NOAA_INFRARED_TILE_URL: string | undefined = undefined;
export const NOAA_INFRARED_MINZOOM = 2;
export const NOAA_INFRARED_MAXZOOM = 10;

// User's own ADS-B feeder (readsb/dump1090-fa/tar1090-compatible
// aircraft.json). Optional — the aircraft layer no-ops when unset, same
// pattern as NEXT_PUBLIC_OPENAIP_API_KEY. Unlike every other feed in this
// file, this is fetched from the user's own device (often LAN-local), not a
// public third-party service.
export function getFeederUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_FEEDER_URL;
}

// The feeder's own decoder typically refreshes aircraft.json roughly every
// 1s; this is a LAN-local/user-owned endpoint (not a rate-limited public
// API like the other feeds in this file), so — unlike their 5-60 minute
// intervals — this polls fast enough for smooth-looking live motion.
export const AIRCRAFT_FEED_REFRESH_INTERVAL_MS = 1_000;

// How long a per-aircraft track trail (built client-side from successive
// polls, see aircraft.ts) is retained before its oldest points are pruned.
export const AIRCRAFT_TRACK_RETENTION_MS = 10 * 60_000;

// Matches tar1090's own `actualOutline.refresh` polling interval
// (`html/script.js`, ~line 2936) for `data/outline.json`.
export const RANGE_OUTLINE_REFRESH_INTERVAL_MS = 15_000;

// Radar-sweep beam rotation speed for the actual-range-outline layer's
// animated overlay (radarSweep.ts) — purely decorative (design.md Decision
// 5): fast enough to read as "live," slow enough that aircraft
// flash-highlights and hex labels stay legible as the beam passes. One full
// revolution every 8 seconds.
export const RANGE_OUTLINE_SWEEP_PERIOD_MS = 8_000;

// ADS-B emitter category (as reported in aircraft.json's `category` field,
// values "A0"-"D7" per DO-260B) -> vendored fallback silhouette under
// public/aircraft-silhouettes/, used by aircraftIcons.ts when no
// type-specific shape matches the aircraft's `t` field. Resolved from
// pw-silhouettes' generics/<name>.json "aliasOf" mappings (see
// scripts/vendor-aircraft-icons.mjs for the source of each entry) — not
// every category has a pw-silhouettes generic (e.g. B5, C3-C7 are
// unmapped), those fall through to the plain-marker fallback instead.
// Selected-aircraft glow highlight (components/map/aircraftLayer.ts's
// ScatterplotLayer, see design.md Decision 4) — radius comfortably larger
// than the 40px icon size in aircraftLayer.ts (kept at roughly the same
// ~1.6x ratio as when the icon was 28px/glow was 22px) so the glow reads as
// a highlight around the icon rather than being fully hidden underneath it;
// alpha kept low (~47%) so it doesn't obscure the icon or nearby traffic.
export const AIRCRAFT_SELECTION_GLOW_RADIUS_PIXELS = 32;
export const AIRCRAFT_SELECTION_GLOW_ALPHA = 120;

// Selection-glow pulse (components/map/selectionPulse.ts, see
// aircraft-selection-pulse's design.md Decision 3) — the two constants above
// are the pulse's baseline/midpoint; these add oscillation on top: one full
// cycle every PERIOD_MS, growing by up to RADIUS_AMPLITUDE_PIXELS while
// fading by up to ALPHA_AMPLITUDE at the wave's peak, then back down.
export const AIRCRAFT_SELECTION_PULSE_PERIOD_MS = 1400;
export const AIRCRAFT_SELECTION_PULSE_RADIUS_AMPLITUDE_PIXELS = 10;
export const AIRCRAFT_SELECTION_PULSE_ALPHA_AMPLITUDE = 50;

// Always-on icon/track glow (components/map/aircraftLayer.ts's icon-glow and
// track-glow layers, see design.md Decisions 2-4) — distinct from and
// unrelated to the selected-aircraft AIRCRAFT_SELECTION_GLOW_* block above:
// this glow renders for every rendered aircraft/track segment (not just the
// selected one), colored as a brightened variant of that element's own
// active-color-mode draw color (not a fixed rarity color). Alpha'd subtler
// than the selection glow so a selected aircraft's own rarity-colored ring
// still stands out layered outside it.
export const AIRCRAFT_GLOW_BRIGHTEN_AMOUNT = 0.4;
// Icon glow renders the aircraft's own blurred silhouette (aircraftIcons.ts's
// glowIconKey atlas entries), not a circle — sized larger than the 40px
// crisp icon so the pre-baked blur reads as a halo around it rather than
// being hidden underneath.
export const AIRCRAFT_ICON_GLOW_SIZE_PIXELS = 64;
export const AIRCRAFT_ICON_GLOW_ALPHA = 90;
export const AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS = 6;
export const AIRCRAFT_TRACK_GLOW_ALPHA = 90;

// Track age-fade and ground droplines (enhance-aircraft-tracks' design.md
// Decisions 1-4) — the most-recent track segment always renders at full
// alpha (255) regardless of AIRCRAFT_TRACK_FADE_MIN_ALPHA; older segments
// fade linearly by wall-clock age toward this floor rather than reaching 0,
// so the oldest still-retained segment never fully disappears before it's
// pruned.
export const AIRCRAFT_TRACK_FADE_MIN_ALPHA = 60;
// Minimum wall-clock spacing between the decimated "track marker" points
// (selectTrackMarkers()) that the droplines are built from — kept coarser
// than the trail line's own per-poll resolution to bound their draw cost
// against the uncapped, per-poll-resolution point buffer.
export const AIRCRAFT_TRACK_MARKER_INTERVAL_MS = 15_000;
// Bumped from the original 5/2px/90-alpha defaults (enhance-aircraft-tracks
// design.md's Open Questions left these to visual tuning) — verified against
// a live feeder that at those values the dropline was imperceptible: a 2px,
// ~35%-alpha dot is well under a pixel of effective coverage once
// anti-aliased, especially for the low-altitude GA/rotorcraft traffic that
// dominates a typical view, where the dropline's real-world extent is only a
// few hundred meters to begin with.
export const AIRCRAFT_TRACK_DROPLINE_DOT_COUNT = 8;
export const AIRCRAFT_TRACK_DROPLINE_DOT_RADIUS_PIXELS = 4;
export const AIRCRAFT_TRACK_DROPLINE_ALPHA = 230;

// "Follow selected aircraft" per-poll recenter duration (design.md Decision
// 13) — short enough to track a ~1s-polled aircraft without visibly lagging
// behind it, long enough to still read as an eased pan rather than a jump.
export const FOLLOW_SELECTED_AIRCRAFT_EASE_MS = 800;

// Guard window (design.md Decision 3) between an aircraft `IconLayer` click
// (deck.gl) and MapLibre's own unscoped `map.on("click", ...)` handler
// firing for the same pointer event — both fire for a click that lands on
// an aircraft icon, since deck.gl overlays the same canvas MapLibre owns.
// Small enough to never mistake a genuinely separate, deliberate second
// click as the same event.
export const AIRCRAFT_DESELECT_CLICK_GUARD_MS = 50;

// Airspeed color mode's "hot pink above Mach 1" threshold (aircraftIcons.ts's
// airspeedToColor) — approximated as a fixed sea-level speed-of-sound knots
// value, NOT a real Mach computation. True Mach depends on true airspeed,
// altitude, and outside air temperature, none of which this feeder's
// aircraft.json exposes (only ADS-B ground speed).
export const MACH1_APPROX_KTS = 660;

export const AIRCRAFT_CATEGORY_FALLBACK_ICON: Record<string, string> = {
  A1: "/aircraft-silhouettes/A1.svg", // light
  A2: "/aircraft-silhouettes/A2.svg", // medium 1 (7,000-34,000 kg)
  A3: "/aircraft-silhouettes/A3.svg", // medium 2 (34,000-136,000 kg)
  A4: "/aircraft-silhouettes/A4.svg", // high vortex large
  A5: "/aircraft-silhouettes/A5.svg", // heavy
  A6: "/aircraft-silhouettes/A6.svg", // high performance
  A7: "/aircraft-silhouettes/A7.svg", // rotorcraft
  B1: "/aircraft-silhouettes/B1.svg", // glider/sailplane
  B2: "/aircraft-silhouettes/B2.svg", // lighter-than-air
  B3: "/aircraft-silhouettes/B3.svg", // parachutist/skydiver
  B4: "/aircraft-silhouettes/B4.svg", // ultralight/hang-glider/paraglider
  B6: "/aircraft-silhouettes/B6.svg", // unmanned aerial vehicle
  B7: "/aircraft-silhouettes/B7.svg", // space/transatmospheric vehicle
  C1: "/aircraft-silhouettes/C1.svg", // surface emergency vehicle
  C2: "/aircraft-silhouettes/C2.svg", // surface service vehicle
};

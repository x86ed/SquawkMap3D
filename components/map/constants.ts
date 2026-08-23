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

// No free/no-key NOAA GOES infrared satellite tile source was confirmed at
// implementation time. Left unset so the layer no-ops (like OpenAIP without
// a key) until a real tile/WMS source is wired in.
export const NOAA_INFRARED_TILE_URL: string | undefined = undefined;
export const NOAA_INFRARED_MINZOOM = 2;
export const NOAA_INFRARED_MAXZOOM = 10;

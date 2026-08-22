export const DEFAULT_VIEW = {
  center: [-98.5795, 39.8283] as [number, number], // geographic center of the contiguous US
  zoom: 4,
};

export const GEOLOCATION_ZOOM = 11;
export const INITIAL_PITCH = 60;
export const MAX_PITCH = 85;
export const INITIAL_BEARING = 0;
export const TERRAIN_EXAGGERATION = 1.5;

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

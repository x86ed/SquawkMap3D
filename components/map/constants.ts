export const DEFAULT_VIEW = {
  center: [-98.5795, 39.8283] as [number, number], // geographic center of the contiguous US
  zoom: 4,
};

export const GEOLOCATION_ZOOM = 11;
export const INITIAL_PITCH = 60;
export const MAX_PITCH = 85;
export const INITIAL_BEARING = 0;
export const TERRAIN_EXAGGERATION = 1.5;

export const CHARTBUNDLE_SECTIONAL_TILE_URL =
  "https://wms.chartbundle.com/tms/1.0.0/sec/{z}/{x}/{y}.png?origin=nw";

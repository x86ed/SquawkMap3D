## Why

SquawkMap3D is currently the default Next.js starter page with no map. The product is an ADS-B map, so it needs a real, interactive 3D map as its landing experience before any aircraft/airport data can be layered on top.

## What Changes

- Add `maplibre-gl` as a dependency and wire it into the Next.js App Router (client component, since MapLibre requires the DOM).
- Replace the starter `app/page.tsx` content with a full-viewport MapLibre map as the main view on load.
- Configure a 3D perspective (pitch/bearing enabled, terrain exaggeration) with a topographic terrain source (hillshade/DEM raster-dem).
- Add light/dark style switching that follows the OS `prefers-color-scheme` (and can be toggled manually).
- Add geolocation-based centering: request the browser's location on load and fly/center the map there, with a sane fallback view when permission is denied or unavailable.
- Add an airports layer (point layer) styled in a color that contrasts with both the light and dark base styles.
- Add a military base layer loaded from a local KML or GeoJSON file, rendered distinctly from the airports layer.
- Add a "pilot map" mode: a user-toggleable basemap/style option that presents an aviation-chart-like styling (vs. the default topographic style).
- **BREAKING**: `app/page.tsx` no longer renders the Next.js starter template — it becomes the map view.

## Capabilities

### New Capabilities
- `map-view`: Core MapLibre map rendered as the app's main view — 3D perspective, topographic terrain, light/dark theme support, and geolocation-based centering.
- `airports-layer`: Displays airports as a point layer on the map in a contrasting color.
- `military-bases-layer`: Loads and renders a military base boundary/point layer from a bundled KML/GeoJSON file.
- `pilot-map-mode`: A user-selectable map mode that swaps the base style to an aviation-chart-style presentation.

### Modified Capabilities
(none — no existing specs)

## Impact

- **Dependencies**: adds `maplibre-gl` (and its CSS) to `package.json`.
- **Code**: `app/page.tsx` (rewritten to render the map view), new client component(s) under `app/` or a new `components/` directory, new map style/config module, new data files for airports and military bases under `public/`.
- **Assets**: bundled airports GeoJSON and military-base KML/GeoJSON data files ship with the app (static, loaded client-side).
- **Browser APIs**: introduces use of the Geolocation API, requiring user permission handling and a fallback UX.

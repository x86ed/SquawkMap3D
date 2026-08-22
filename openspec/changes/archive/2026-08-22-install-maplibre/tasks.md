## 1. Setup

- [x] 1.1 Add `maplibre-gl` to `package.json` dependencies and install it
- [x] 1.2 Add `@turf/turf` (or `mapshaper`) as a dev dependency for the military-base simplification script
- [x] 1.3 Add `NEXT_PUBLIC_MAPTILER_KEY` to `.env.example`, and document it in the README
- [x] 1.4 Import `maplibre-gl`'s CSS globally (e.g., in `app/layout.tsx` or `app/globals.css`)

## 2. Data preparation

- [x] 2.1 Generate `public/data/airports.geojson` from OurAirports data, filtered to public-use/large/medium airports
- [x] 2.2 Copy the source MIRTA GeoJSON (`/Users/adamsiegel/Downloads/mirta_5936110678248491280.json`, 825 features, ~23MB) into the repo as raw source data (e.g. `data/sources/mirta.geojson`, gitignored or kept out of `public/`)
- [x] 2.3 Write `scripts/simplify-military-bases.mjs` to filter/simplify the raw MIRTA GeoJSON (drop unused properties, simplify polygon geometry) down to a reasonable bundle size
- [x] 2.4 Run the script and commit the resulting `public/data/military-bases.geojson`

## 3. Map shell and client boundary

- [x] 3.1 Create `components/map/MapView.tsx` as a `'use client'` component that mounts a MapLibre `Map` instance in a `useEffect`, sized to fill the viewport
- [x] 3.2 Update `app/page.tsx` to render `MapView` as the page's main content, removing the Next.js starter template markup
- [x] 3.3 Add/adjust CSS so the map container fills the full viewport (no scroll, no starter-page layout remnants)

## 4. Base style, theme, and 3D terrain

- [x] 4.1 Create `components/map/mapStyles.ts` defining the MapTiler light and dark style URLs (using `NEXT_PUBLIC_MAPTILER_KEY`)
- [x] 4.2 Implement initial theme selection from `window.matchMedia('(prefers-color-scheme: dark)')`
- [x] 4.3 Add a theme toggle control and persist the user's manual choice (e.g., `localStorage`)
- [x] 4.4 Add the MapTiler `terrain-rgb` raster-DEM source and call `map.setTerrain({ source, exaggeration })`
- [x] 4.5 Set initial `pitch`/`maxPitch`/`bearing` for a 3D perspective and add a `sky` layer (maplibre-gl 6.5.0: via `map.setSky()`, not an `addLayer({type:"sky"})` call — see Notes)
- [x] 4.6 Implement `addCustomLayers(map)` and wire it to run on initial load and on every `style.load` (post `setStyle`) so airports/military-base layers survive theme and pilot-mode switches
- [x] 4.7 Render a clear inline error state in `MapView` when `NEXT_PUBLIC_MAPTILER_KEY` is missing or style/terrain loading fails

## 5. Center on user

- [x] 5.1 Implement a `useGeolocation`-style helper that calls `navigator.geolocation.getCurrentPosition` on mount
- [x] 5.2 On success, `flyTo`/center the map on the returned coordinates
- [x] 5.3 Define a fixed default view (center + zoom) used on permission denial, timeout, or unsupported browsers
- [x] 5.4 Verify the map renders and is fully interactive in the fallback case (no hang waiting on geolocation)

## 6. Airports layer

- [x] 6.1 Add the `airports.geojson` source and a circle/point layer in `addCustomLayers`
- [x] 6.2 Style the airport layer with a fixed accent color (+ halo) chosen for contrast against both light and dark styles
- [x] 6.3 Verify visually against both light and dark styles

## 7. Military bases layer

- [x] 7.1 Add the `military-bases.geojson` source and layer(s) (points and/or polygons as the data requires) in `addCustomLayers`
- [x] 7.2 Style the military base layer with a color/symbol distinct from both the airports layer and the basemap
- [x] 7.3 Verify airports and military bases are simultaneously visible and visually distinguishable
- [x] 7.4 Add a UI control to toggle the military base layer on/off, independent of theme and pilot mode (`setMilitaryBasesVisibility` in `layers.ts`, wired in `MapView.tsx`); persist the toggle choice across style swaps by passing it through to `addCustomLayers` on re-add

## 8. Pilot map mode

- [x] 8.1 Add a FAA sectional raster source/layer (`https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}`, zoom 8-12 — replaces the originally-planned ChartBundle URL, confirmed permanently dead/NXDOMAIN during verification) in `addCustomLayers`, added but hidden by default
- [x] 8.2 Add a UI control to toggle pilot mode on/off, showing/hiding the FAA sectional raster layer (and dimming/hiding base-style layers underneath as needed)
- [x] 8.3 Confirm airports and military-base layers stay visible above the FAA sectional raster layer when pilot mode is on
- [x] 8.4 Handle FAA sectional tile load failures gracefully (layer just doesn't render; rest of the map stays functional)
- [x] 8.5 Verify toggling pilot mode on and back off correctly shows/hides the sectional overlay without breaking the base style

## 9. Verification

- [x] 9.1 Run `npm run build` and confirm no SSR errors from `maplibre-gl` (map only touches `window`/WebGL client-side)
- [x] 9.2 Manually smoke-test in a browser: initial load shows the map as the main view, 3D drag/pitch works, terrain is visible, light/dark follows OS and toggles manually, geolocation prompt centers the map (and fallback works when denied), airports and military bases render distinctly, pilot mode toggles correctly (verified in real non-headless Chrome via CDP after fixing the worker-URL bug — see design.md)
- [x] 9.3 Run `npm run lint`

## 1. Setup

- [ ] 1.1 Add `maplibre-gl` to `package.json` dependencies and install it
- [ ] 1.2 Add `@tmcw/togeojson` (and `@xmldom/xmldom` if required) as a dev dependency for the KML→GeoJSON build script
- [ ] 1.3 Add `NEXT_PUBLIC_MAPTILER_KEY` to `.env.example`, and document it in the README
- [ ] 1.4 Import `maplibre-gl`'s CSS globally (e.g., in `app/layout.tsx` or `app/globals.css`)

## 2. Data preparation

- [ ] 2.1 Source/create `public/data/airports.geojson` (placeholder subset acceptable pending real dataset confirmation per design.md Open Questions)
- [ ] 2.2 Source/create the military base source file (KML or GeoJSON; placeholder acceptable pending confirmation per design.md Open Questions)
- [ ] 2.3 Write `scripts/kml-to-geojson.mjs` to convert a KML source into `public/data/military-bases.geojson`
- [ ] 2.4 Run the conversion script (if source is KML) and commit the resulting `public/data/military-bases.geojson`

## 3. Map shell and client boundary

- [ ] 3.1 Create `components/map/MapView.tsx` as a `'use client'` component that mounts a MapLibre `Map` instance in a `useEffect`, sized to fill the viewport
- [ ] 3.2 Update `app/page.tsx` to render `MapView` as the page's main content, removing the Next.js starter template markup
- [ ] 3.3 Add/adjust CSS so the map container fills the full viewport (no scroll, no starter-page layout remnants)

## 4. Base style, theme, and 3D terrain

- [ ] 4.1 Create `components/map/mapStyles.ts` defining the MapTiler light and dark style URLs (using `NEXT_PUBLIC_MAPTILER_KEY`)
- [ ] 4.2 Implement initial theme selection from `window.matchMedia('(prefers-color-scheme: dark)')`
- [ ] 4.3 Add a theme toggle control and persist the user's manual choice (e.g., `localStorage`)
- [ ] 4.4 Add the MapTiler `terrain-rgb` raster-DEM source and call `map.setTerrain({ source, exaggeration })`
- [ ] 4.5 Set initial `pitch`/`maxPitch`/`bearing` for a 3D perspective and add a `sky` layer
- [ ] 4.6 Implement `addCustomLayers(map)` and wire it to run on initial load and on every `style.load` (post `setStyle`) so airports/military-base layers survive theme and pilot-mode switches
- [ ] 4.7 Render a clear inline error state in `MapView` when `NEXT_PUBLIC_MAPTILER_KEY` is missing or style/terrain loading fails

## 5. Center on user

- [ ] 5.1 Implement a `useGeolocation`-style helper that calls `navigator.geolocation.getCurrentPosition` on mount
- [ ] 5.2 On success, `flyTo`/center the map on the returned coordinates
- [ ] 5.3 Define a fixed default view (center + zoom) used on permission denial, timeout, or unsupported browsers
- [ ] 5.4 Verify the map renders and is fully interactive in the fallback case (no hang waiting on geolocation)

## 6. Airports layer

- [ ] 6.1 Add the `airports.geojson` source and a circle/point layer in `addCustomLayers`
- [ ] 6.2 Style the airport layer with a fixed accent color (+ halo) chosen for contrast against both light and dark styles
- [ ] 6.3 Verify visually against both light and dark styles

## 7. Military bases layer

- [ ] 7.1 Add the `military-bases.geojson` source and layer(s) (points and/or polygons as the data requires) in `addCustomLayers`
- [ ] 7.2 Style the military base layer with a color/symbol distinct from both the airports layer and the basemap
- [ ] 7.3 Verify airports and military bases are simultaneously visible and visually distinguishable

## 8. Pilot map mode

- [ ] 8.1 Define a pilot-mode style patch (suppress POI/road labels, emphasize terrain/airport symbology, aviation-chart-like color wash)
- [ ] 8.2 Add a UI control to toggle pilot mode on/off
- [ ] 8.3 Apply the patch via the same `addCustomLayers`/`style.load` mechanism used for theme swaps, confirming airports and military-base layers remain visible
- [ ] 8.4 Verify toggling pilot mode on and back off returns to the correct light/dark topographic style

## 9. Verification

- [ ] 9.1 Run `npm run build` and confirm no SSR errors from `maplibre-gl` (map only touches `window`/WebGL client-side)
- [ ] 9.2 Manually smoke-test in a browser: initial load shows the map as the main view, 3D drag/pitch works, terrain is visible, light/dark follows OS and toggles manually, geolocation prompt centers the map (and fallback works when denied), airports and military bases render distinctly, pilot mode toggles correctly
- [ ] 9.3 Run `npm run lint`

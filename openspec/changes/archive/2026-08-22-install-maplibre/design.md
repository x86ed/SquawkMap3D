## Context

SquawkMap3D is a brand-new Next.js 16 App Router project (React 19) with no existing map, data layers, or design system. This change introduces MapLibre GL JS as the core of the app and establishes the conventions (client-component boundary, style-swapping, data-layer pattern) that later ADS-B/aircraft-tracking work will build on. MapLibre requires direct DOM/WebGL access, so it cannot run during Next.js server rendering.

## Goals / Non-Goals

**Goals:**
- Render a full-viewport, interactive 3D MapLibre map as `app/page.tsx`'s content.
- Support light/dark theme (following OS preference, swappable at runtime) without losing custom layers.
- Show real topographic terrain (3D hillshade/DEM) globally.
- Center the initial view on the user's location when permitted, with a sensible static fallback.
- Render airports and military bases as distinct, visually contrasting layers.
- Provide a "pilot map" mode the user can toggle to.

**Non-Goals:**
- Live ADS-B aircraft tracking/rendering (separate future change).
- Sourcing/serving licensed FAA sectional chart raster tiles for a fully authentic pilot chart (see Open Questions).
- A full design system or settings/persistence framework — theme and mode state are local/localStorage only for now.
- Editing or authoring the airports/military-base datasets — this change only loads and displays them.

## Decisions

- **Plain `maplibre-gl` + a thin React client wrapper, not `react-map-gl`.** The app needs low-level control over terrain, sky layer, and imperative `setStyle`/`setTerrain` calls; a wrapper library adds an abstraction we'd fight. A single `MapView` client component (`'use client'`) owns the `maplibre-gl.Map` instance via `useRef`/`useEffect`; child concerns (layers, geolocation, theme, mode) are plain functions/hooks that operate on that instance, not separate React-bound map primitives.
- **MapTiler as the vector style + terrain-DEM provider.** MapTiler's free tier ships matched light/dark vector styles and a `terrain-rgb` DEM tileset from one account/key, which covers three acceptance criteria (theme, terrain, 3D) with one integration instead of stitching together separate basemap and elevation providers (e.g., OpenFreeMap + AWS opendata terrain tiles). Trade-off: requires an API key (`NEXT_PUBLIC_MAPTILER_KEY`) — see Risks and Open Questions.
- **3D via `pitch`/`maxPitch` + `map.setTerrain()` + a `sky` layer**, not a custom 3D engine. This is MapLibre's built-in terrain path (`RASTERDEM` source → `setTerrain({source, exaggeration})`), the standard/lowest-risk way to get extruded topography.
- **Theme swap re-adds custom layers on `style.load`.** `map.setStyle()` on MapLibre discards custom sources/layers unless diffed, and diffing is unreliable across MapTiler's light/dark styles (different underlying layer sets). Instead, on every style swap we listen once for `style.load` and re-run the same "add sources + layers" routine used at initial mount, driven by a single `addCustomLayers(map)` function that is idempotent.
- **Airports and military bases are bundled static GeoJSON under `public/data/`, fetched client-side, not imported into the JS bundle.** Keeps the JS bundle small and lets the data update without a rebuild. The military-base source data is the DoD MIRTA (Military Installations, Ranges, and Training Areas) dataset — already GeoJSON (Polygon/MultiPolygon), so no KML→GeoJSON conversion step is needed; it is instead filtered/simplified **once, at authoring/build time** via a small Node script (`scripts/simplify-military-bases.mjs`, using `@turf/turf` or `mapshaper`) to cut the raw ~23MB/825-feature file down to something reasonable to ship client-side. `@tmcw/togeojson` stays available for any future KML-sourced layer but isn't needed for this data.
- **Airports styled with a single fixed accent color (not theme-dependent)**, chosen for contrast against both the light and dark MapTiler styles (e.g., a saturated orange circle with a thin halo whose color flips with theme). Military bases get a distinct fixed color family (e.g., olive/drab) so the two overlay layers never visually collide with each other or the basemap.
- **"Pilot map" mode overlays real FAA VFR sectional chart tiles from FAA's own Esri-hosted tile service** (`https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}`, public, no key required, zoom 8-12) as a raster source/layer toggle, rather than restyling the vector basemap. ChartBundle — the original free sectional-tile host most open-source EFB projects used — was the initial pick but turned out to be permanently shut down (domain no longer resolves; confirmed dead, unmaintained/security-vulnerability retirement); this FAA-hosted service is the live replacement. Enabling pilot mode adds the raster layer above the base style (and can dim/hide base-style layers underneath it) and disabling it removes the raster layer, leaving the current light/dark topographic style; airports and military bases stay on top via the same `addCustomLayers` re-apply pattern used for theme swaps.
- **Geolocation centers the map once on load**, via `navigator.geolocation.getCurrentPosition` → `map.flyTo`. On denial, timeout, or an unsupported browser, the map falls back to a static default view (configurable constant) rather than blocking render or retrying silently.
- **MapView mounts only on the client.** `app/page.tsx` stays a server component shell (keeps metadata/layout conventions intact) that renders `MapView` from a child client component file; `MapView` guards all `maplibre-gl` usage inside `useEffect` so nothing touches `window`/WebGL during SSR.

## Notes (found during implementation)

- **maplibre-gl's Web Worker fails to load under Next.js/Turbopack by default.** maplibre-gl 6.5.0 resolves its worker script URL relative to its own bundled module's `import.meta.url`; under Turbopack that module is served from a hashed `_next/static/chunks/...` path, so the computed worker URL doesn't correspond to a real asset, the request falls back to the HTML shell, and the `{type: 'module'}` worker is killed by MIME-type checking. All vector-tile and GeoJSON-source parsing happens in that worker, so this silently broke the entire vector basemap, airports, and military-base layers while raster sources (terrain-RGB DEM, FAA sectional) — fetched/decoded on the main thread — kept working, which read as a giant blank/flat "3D block" rather than an obvious error. Fixed by vendoring `maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` into `public/` and calling `setWorkerUrl("/maplibre-gl-worker.mjs")` before constructing the `Map`.

## Risks / Trade-offs

- **[Risk]** MapTiler requires an API key → app is non-functional out of the box. **Mitigation**: `NEXT_PUBLIC_MAPTILER_KEY` read from env, `.env.example` documents it, `MapView` renders a clear inline error state (not a silent blank map) when the key is missing/invalid.
- **[Risk]** `setStyle` between light/dark/pilot wipes and re-adds all custom layers, which can cause a visible flicker/flash of missing airports/bases. **Mitigation**: keep the re-add routine synchronous and fast (data already fetched/cached in memory after first load, not re-fetched per style swap).
- **[Risk]** Geolocation permission prompts on load can feel intrusive and will be denied by many users/browsers in headless or CI test contexts. **Mitigation**: fallback default view is always fully functional; permission is requested, never required.
- **[Risk]** Military base source data (DoD MIRTA, 825 features) ships at ~23MB raw. **Mitigation**: filtered/simplified at build time (see Decisions) before landing in `public/data/`; raw source file is not committed as-is.
- **[Risk]** Airports dataset (thousands of points, e.g. OurAirports' ~80k rows) could be heavy if bundled unfiltered. **Mitigation**: filter to a reasonable subset (e.g., public-use/large/medium airports) when generating `public/data/airports.geojson`, keep it as a build-time-generated static asset rather than hand-maintained.
- **[Risk]** Even an official FAA-hosted endpoint could go down, rate-limit, or change its URL scheme/zoom range without notice (this already happened once — the originally-planned ChartBundle host is permanently dead). **Mitigation**: pilot mode fails gracefully (raster layer just doesn't load) rather than breaking the rest of the map; the base topographic map remains fully functional either way; `minzoom`/`maxzoom` set to the service's documented 8-12 range to avoid requesting tiles it doesn't serve.

## Migration Plan

Greenfield addition — no data/schema migration. Rollout is: add dependency → add env var → add data files → replace `app/page.tsx` → verify `next build` and manual smoke test in a browser (light/dark, 3D drag/pitch, terrain visible, geolocation prompt, airports/military-base layers visible, pilot mode toggle). Rollback is a plain revert of the commit(s), since nothing else in the app depends on the map yet.

## Resolved Questions

- **Airports source**: OurAirports (CC0, public-domain), filtered to public-use/large/medium airports.
- **Military base source**: DoD MIRTA (Military Installations, Ranges, and Training Areas), 825 Polygon/MultiPolygon features, public-domain federal data. Raw source file provided at authoring time; filtered/simplified before bundling (see Risks).
- **Pilot map mode**: real FAA VFR sectional chart tiles via FAA's own Esri-hosted tile service (ChartBundle, the original pick, is confirmed permanently dead — domain doesn't resolve), not a restyled vector basemap.

## Open Questions

- Who provisions the MapTiler account/API key, and where is it stored for deployment (e.g., Vercel project env vars)? — in progress.

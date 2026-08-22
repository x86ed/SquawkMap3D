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
- **Airports and military bases are bundled static GeoJSON under `public/data/`, fetched client-side, not imported into the JS bundle.** Keeps the JS bundle small and lets the data update without a rebuild. If the source dataset is KML (as it will be for at least the initial military-base data), it is converted to GeoJSON **once, at authoring/build time** via a small Node script (`scripts/kml-to-geojson.mjs` using `@tmcw/togeojson`), not parsed as XML in the browser — cheaper at runtime and avoids shipping an XML-DOM dependency to the client.
- **Airports styled with a single fixed accent color (not theme-dependent)**, chosen for contrast against both the light and dark MapTiler styles (e.g., a saturated orange circle with a thin halo whose color flips with theme). Military bases get a distinct fixed color family (e.g., olive/drab) so the two overlay layers never visually collide with each other or the basemap.
- **"Pilot map" mode is a restyled variant of the same vector tiles**, not sourced FAA sectional raster tiles: a `pilot` mode toggle applies a style patch (suppress POI/road labels, emphasize contour/terrain and airport symbology, add an airspace-like color wash) on top of the current light/dark style, using the same `addCustomLayers` re-apply pattern as theme swaps. Real sectional charts are out of scope for this change (see Open Questions).
- **Geolocation centers the map once on load**, via `navigator.geolocation.getCurrentPosition` → `map.flyTo`. On denial, timeout, or an unsupported browser, the map falls back to a static default view (configurable constant) rather than blocking render or retrying silently.
- **MapView mounts only on the client.** `app/page.tsx` stays a server component shell (keeps metadata/layout conventions intact) that renders `MapView` from a child client component file; `MapView` guards all `maplibre-gl` usage inside `useEffect` so nothing touches `window`/WebGL during SSR.

## Risks / Trade-offs

- **[Risk]** MapTiler requires an API key → app is non-functional out of the box. **Mitigation**: `NEXT_PUBLIC_MAPTILER_KEY` read from env, `.env.example` documents it, `MapView` renders a clear inline error state (not a silent blank map) when the key is missing/invalid.
- **[Risk]** `setStyle` between light/dark/pilot wipes and re-adds all custom layers, which can cause a visible flicker/flash of missing airports/bases. **Mitigation**: keep the re-add routine synchronous and fast (data already fetched/cached in memory after first load, not re-fetched per style swap).
- **[Risk]** Geolocation permission prompts on load can feel intrusive and will be denied by many users/browsers in headless or CI test contexts. **Mitigation**: fallback default view is always fully functional; permission is requested, never required.
- **[Risk]** Military base location data can be sensitive/sourced from third parties with unclear licensing. **Mitigation**: flagged explicitly in Open Questions — dataset source/accuracy must be confirmed before real data is committed; a small placeholder/sample GeoJSON is used until then.
- **[Risk]** Airports dataset (thousands of points, e.g. OurAirports' ~80k rows) could be heavy if bundled unfiltered. **Mitigation**: filter to a reasonable subset (e.g., public-use/large/medium airports) when generating `public/data/airports.geojson`, keep it as a build-time-generated static asset rather than hand-maintained.

## Migration Plan

Greenfield addition — no data/schema migration. Rollout is: add dependency → add env var → add data files → replace `app/page.tsx` → verify `next build` and manual smoke test in a browser (light/dark, 3D drag/pitch, terrain visible, geolocation prompt, airports/military-base layers visible, pilot mode toggle). Rollback is a plain revert of the commit(s), since nothing else in the app depends on the map yet.

## Open Questions

- Where does the airports GeoJSON come from — OurAirports (CC0, public-domain) filtered by type, or another source? Needs confirmation before committing real data (a placeholder subset will be used otherwise).
- Where does the military-base KML/GeoJSON come from, and what's its accuracy/licensing? This is sensitive data — needs explicit source confirmation before real data is committed.
- Who provisions the MapTiler account/API key, and where is it stored for deployment (e.g., Vercel project env vars)?
- Is the restyled-vector-tiles "pilot map" acceptable long-term, or should a future change integrate licensed FAA sectional chart tiles?

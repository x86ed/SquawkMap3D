## Context

The map (`components/map/MapView.tsx` + `components/map/layers.ts`) has no data-driven layer registry — each layer is hand-wired: a source/layer pair added in `addCustomLayers()`, a `set<Layer>Visibility()` setter, a state/ref pair and toggle button in `MapView.tsx`, and constants (tile URL, zoom bounds) in `constants.ts`. Existing layers fall into two integration shapes:
- **Static raster TMS** (FAA sectional): a plain `{z}/{x}/{y}` tile URL template, no runtime fetch beyond MapLibre's own tile requests.
- **Static bundled GeoJSON** (military bases, airports): a file under `public/data/`, loaded once via `type: "geojson", data: "/data/<file>.geojson"`.

None of the 8 new layers fit purely into the bundled-GeoJSON shape — most are either raster tile services or GeoJSON that must be fetched live (TFRs and SUA change over time; a bundled snapshot would go stale). This design keeps the existing per-layer wiring convention (no new registry abstraction) but introduces two new integration shapes.

## Goals / Non-Goals

**Goals:**
- Add all 8 layers from the proposal, each independently toggleable, following the existing add/set-visibility/toggle-button convention.
- Keep each layer's failure (missing API key, network error, unavailable tile) non-fatal — the map and other layers keep working.
- Reuse one provider across layers where reasonable (e.g. one IEM tile scheme for both NEXRAD and infrared) to minimize new integration surface.

**Non-Goals:**
- No generic/data-driven layer registry or plugin system — out of scope for this change; the existing imperative pattern is kept.
- No layer opacity/animation controls beyond RainViewer's inherent frame timestamp (no full time-scrubber UI).
- No offline/bundled fallback data for the live-fetched layers (TFR, SUA) — if the upstream feed is unreachable, the layer is simply empty until it is.

## Decisions

**1. Layer sourcing, one per acceptance-criteria item:**

| Layer | Type | Source (to confirm exact endpoint at implementation time) |
|---|---|---|
| OpenAIP TMS | raster tile | OpenAIP tile service, requires an API key (`NEXT_PUBLIC_OPENAIP_API_KEY`) |
| RainViewer Radar | raster tile, dynamic timestamp | RainViewer public API (`api.rainviewer.com/public/weather-maps.json`) for the current frame, then RainViewer's tile template |
| US TFRs | GeoJSON, fetched live | FAA-published TFR feature service (ArcGIS FeatureServer) |
| US Special Use Airspace | GeoJSON, fetched live | FAA-published SUA feature service (ArcGIS FeatureServer) |
| US NEXRAD | raster tile | Iowa Environmental Mesonet (IEM) NEXRAD composite reflectivity tile cache — no key required |
| US NOAA InfraredSat | raster tile | IEM GOES infrared tile cache (same provider infra as NEXRAD, different layer) |
| US NOAA Radar | raster tile | NOAA/NWS-hosted radar mosaic tile service, kept as a source distinct from the IEM-hosted NEXRAD mosaic per the acceptance criteria listing them separately |
| Europe DWD RADOLAN | raster tile (WMS-backed) | DWD GeoServer WMS (RADOLAN RX product), wrapped as a MapLibre raster source |

**2. Two new integration shapes added to `layers.ts`:**
- **Static raster tile** (OpenAIP, NEXRAD, NOAA InfraredSat, NOAA Radar, DWD RADOLAN): same shape as the existing FAA sectional — a `raster` source with a `tiles: [URL_TEMPLATE]` and `minzoom`/`maxzoom` constants. No new abstraction needed.
- **Dynamic-timestamp raster tile** (RainViewer): needs an async init step to fetch the current frame timestamp before the tile URL can be built. New module `components/map/rainviewer.ts` exposes a function to resolve the current tile URL; `addCustomLayers` (or a follow-up effect) calls it and adds/updates the source once resolved, and can poll on `TERMINATOR_REFRESH_INTERVAL_MS`-style interval to keep the radar frame current.
- **Live-fetched GeoJSON** (TFR, SUA): unlike military-bases' static bundled file, these sources are set via `map.addSource(id, { type: "geojson", data: <fetched-or-refetched-URL-or-object> })`, refetched periodically (e.g. every few minutes) rather than bundled at build time, since both change frequently and staleness has real operational consequences for a flight-planning tool.

**3. Per-layer failure isolation:** each new layer's add/fetch step is wrapped so a failure (missing key, network error, malformed response) logs and leaves that one layer absent/empty rather than throwing and breaking map init — matching the existing pattern where `addCustomLayers` guards each `addSource`/`addLayer` call with `if (!map.getSource(...))`/`if (!map.getLayer(...))` idempotency checks.

**4. Toggle UI:** each layer gets its own state/ref pair and toggle button in `MapView.tsx`, consistent with the existing military-bases/airports/terminator toggles. No grouping/menu redesign — buttons are simply added to the existing toggle row.

**5. Attribution:** each raster source's `attribution` field (as already set for FAA sectional) carries the required attribution text per provider's terms (OpenAIP, RainViewer, IEM, NOAA/NWS, DWD).

## Risks / Trade-offs

- **[Risk]** OpenAIP requires an API key; the layer is unusable without one configured → **Mitigation**: layer toggle simply has no effect (or is hidden) when the key env var is unset, matching "fail non-fatal" goal above.
- **[Risk]** TFR/SUA upstream feature services are third-party ArcGIS endpoints whose schema/availability isn't controlled by this project → **Mitigation**: isolate the fetch/parse behind a small per-layer module so a schema change is a contained fix, not a map-wide regression.
- **[Risk]** RainViewer's dynamic-timestamp flow adds an async dependency MapLibre's static raster sources don't need → **Mitigation**: keep it isolated in `rainviewer.ts`; if the frame-timestamp fetch fails, the layer stays off rather than requesting an invalid tile URL.
- **[Risk]** NEXRAD and NOAA Radar being visually near-duplicate (both US national radar mosaics) may confuse users toggling both on → **Mitigation**: distinct attribution/labeling in the toggle button text; visual styling difference is a task-level implementation detail, not a design blocker.
- **[Trade-off]** No new registry/config-driven layer system — 8 more copy-pasted add/set-visibility/toggle blocks. Accepted to stay consistent with the existing codebase convention rather than introduce a bigger refactor as a side effect of this change.

## Migration Plan

Purely additive — no existing layer, source, or API changes. Each new layer can be implemented and merged independently; a partial rollout (e.g. only the raster-tile layers first) leaves the map fully functional. No rollback beyond reverting the specific layer's commit.

## Open Questions

- Exact production tile/API endpoints and required attribution strings for each provider — to be confirmed against each provider's current terms of use at implementation time (endpoints above are the intended providers, not yet verified live).
- Whether OpenAIP's tile layer requires a paid tier for this usage volume, or if the free tier suffices.
- Refresh interval for the live-fetched TFR/SUA GeoJSON (proposed: a few minutes) — to be tuned based on upstream feed's own update cadence.

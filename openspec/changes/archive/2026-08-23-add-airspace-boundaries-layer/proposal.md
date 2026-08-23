## Why

SquawkMap3D has no layer showing FIR/UIR/oceanic ATC boundaries (the divisions VATSIM controllers and pilots use to reason about airspace responsibility). This is different context from the existing airspace-related layers: `openaip-airspace-layer` shows controlled-airspace/TMA raster tiles, `special-use-airspace-layer` shows US restricted/prohibited/warning/alert/MOA polygons, and `tfr-layer` shows US Temporary Flight Restrictions. None of these show FIR/UIR/oceanic control-area boundaries, which VATSIM publishes as a global GeoJSON feed. Adding it gives pilots and controllers global airspace-division context the other layers don't cover.

## What Changes

- Add an **Airspace Boundaries** layer: global FIR/UIR/oceanic control-area boundary polygons, fetched live at runtime from VATSIM's `vatspy-data-project` feed (`https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/refs/heads/master/Boundaries.geojson`) — never vendored/bundled, so the map always draws from the live source.
- The layer follows the existing toggle pattern used by other layers: a source/layer registration in `components/map/layers.ts`, a `setAirspaceBoundariesVisibility()` setter, and a toggle button in `MapView.tsx`, persisting across theme (light/dark) and pilot-mode switches like every other custom layer.
- Styled as a distinct thin boundary line (no fill) so it doesn't visually compete with the existing filled-polygon layers (military bases, TFR, special use airspace).

## Capabilities

### New Capabilities
- `airspace-boundaries-layer`: global FIR/UIR/oceanic ATC boundary polygons fetched live from VATSIM's `vatspy-data-project` Boundaries.geojson feed, rendered as a toggleable line layer.

### Modified Capabilities
(none — existing layer capabilities are unchanged; this layer is additive)

## Impact

- `components/map/layers.ts`: new source/layer registration (`AIRSPACE_BOUNDARIES_SOURCE_ID`, `AIRSPACE_BOUNDARIES_LINE_LAYER_ID`), `setAirspaceBoundariesVisibility()` setter, `refreshAirspaceBoundaries()` fetch/update function, added to `CUSTOM_LAYER_IDS` so it survives pilot-mode style swaps like the other custom layers.
- `components/map/airspaceBoundaries.ts` (new file): fetch/parse module for the VATSIM Boundaries.geojson feed, mirroring the existing `specialUseAirspace.ts` / `tfr.ts` pattern — returns an empty `FeatureCollection` (not an error) on failure.
- `components/map/constants.ts`: new `AIRSPACE_BOUNDARIES_GEOJSON_URL` and `AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS` constants.
- `components/map/MapView.tsx`: new visibility state/ref pair, a fetch-on-enable + periodic-refresh effect (mirroring the existing SUA effect), and a toggle button added to the existing toggle row.
- No breaking changes to existing layers, sources, or map behavior.
- New external runtime dependency: `raw.githubusercontent.com` (GitHub raw content CDN serving the VATSIM `vatspy-data-project` repo) — a public, unauthenticated, no-API-key feed.

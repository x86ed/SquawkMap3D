## Why

SquawkMap3D shows live aircraft (`aircraft-tracks-layer`) but gives no sense of the feeder's actual ADS-B reception coverage — the polygon-shaped envelope of the farthest range at which the feeder has ever actually received a signal in each direction, which is the core "how good is my antenna/site" visualization every tar1090 install already offers ("actual range outline"). This change adds that as its own toggleable layer, filled solid (not tar1090's thin stroke), with an animated radar-sweep beam over it so the layer reads as a live radar scope rather than a static shape, and shows currently-tracked aircraft as hex-labeled dots on that scope.

## What Changes

- Add an **Actual Range Outline** layer: fetches the feeder's own server-generated `data/outline.json` (readsb's `--write-json`-produced range-outline file, the same file tar1090's own `drawOutlineJson()` in `html/script.js` reads) and renders it as a **solid-filled** MapLibre polygon layer — this is a deliberate style deviation from tar1090's own default (`actual_range_outline_color`/`width`/`dash`, a thin stroked outline), per this change's explicit "fill as solid color" acceptance criterion.
- Parses all three response shapes tar1090's own client handles for version compatibility: `data.points` (single ring), `data.actualRange.last24h.points`, and `data.multiRange` (already multi-ring) — each ring is an array of `[lat, lon]` pairs, converted to GeoJSON `[lon, lat]` polygon rings.
- `outline.json` is **not** covered by ultrafeeder's own CORS-patched nginx block (only `aircraft.json`'s location block is patched, per this repo's existing `getFeederLocation()`/`receiver.json` precedent) — add a same-origin proxy route (`/data/outline.json`) to `scripts/squawkmap3d.nginx.conf`, mirroring the existing `receiver.json` proxy block, so the browser fetch is same-origin instead of blocked cross-origin.
- Add an **animated radar-sweep** overlay on top of the filled polygon: a plain `<canvas>` element absolutely positioned over the MapLibre map container, redrawn every `requestAnimationFrame` — directly modeled on the technique in the provided reference (`radar-sweep_4.html`): a rotating beam from the site position (the feeder's surveyed antenna location, reusing the existing `getFeederLocation()` helper), clipped to the outline polygon via `ctx.clip()` (screen-space, reprojected from `map.project()` every frame so it tracks pan/zoom/rotation), with a fading trailing wedge (phosphor-persistence via `destination-out` compositing) and a bright leading edge — the first non-MapLibre, non-deck.gl rendering technique in this codebase.
- Currently-tracked aircraft (reusing the existing feeder `aircraft.json` poll, independent of the separate `aircraft-tracks-layer` toggle) are painted on that same canvas as small dots at their lat/lon, each labeled with its ICAO 24-bit hex address (`hex`), and flash brighter for a moment as the sweep beam passes their bearing — mirroring the reference file's `paintEvents`/`flashContactRow` mechanic (there: vessel callsign + shape; here: aircraft hex + dot).
- The whole layer (fill + sweep + dots) is a single toggle in the existing layer-toggle row (`MapView.tsx`'s `.controls` button list — this app's "layer menu"), following the established visibility ref/state pair pattern used by every other layer, and survives theme/pilot-mode style swaps.

## Capabilities

### New Capabilities
- `actual-range-outline-layer`: the feeder's actual ADS-B reception-range polygon, loaded from `outline.json`, rendered as a solid-filled toggleable layer with an animated radar-sweep beam and hex-labeled aircraft dots.

### Modified Capabilities
(none — additive layer; existing map-view/aircraft-tracks/feeder-deployment capabilities are unchanged, aside from the new nginx proxy route noted below, which extends `feeder-deployment`'s existing proxy pattern without changing its documented behavior)

## Impact

- `components/map/rangeOutline.ts` (new): `fetchRangeOutline(): Promise<GeoJSON.FeatureCollection<Polygon | MultiPolygon>>` — fetches `/data/outline.json` (same-origin, proxied), parses the three response shapes above, returns an empty `FeatureCollection` on any failure/unset feeder/unsupported feeder (readsb-only feature — plain dump1090-fa feeders never populate this file), mirroring `tfr.ts`/`specialUseAirspace.ts`'s "fail to empty, never error" convention.
- `components/map/radarSweep.ts` (new): owns the sweep `<canvas>` — mount/resize/teardown, the `requestAnimationFrame` draw loop (polygon-clipped rotating beam, phosphor-persistence trail), and painting aircraft dots/hex labels/sweep-pass flash from the same `Aircraft[]` shape `aircraft.ts` already defines.
- `components/map/layers.ts`: `RANGE_OUTLINE_SOURCE_ID`/`RANGE_OUTLINE_FILL_LAYER_ID` MapLibre `fill` layer (added to `addCustomLayers`/`CustomLayerVisibility`/`CUSTOM_LAYER_IDS`, same pattern as military bases/TFR/SUA), `setRangeOutlineVisibility`, `refreshRangeOutline`.
- `components/map/constants.ts`: `RANGE_OUTLINE_REFRESH_INTERVAL_MS` (15000 — matches tar1090's own `actualOutline.refresh` polling interval), `RANGE_OUTLINE_SWEEP_PERIOD_MS` (sweep rotation speed), `RANGE_OUTLINE_FILL_COLOR` (tar1090's own `actual_range_outline_color`, `#00596b`, reused as the fill base for stylistic parity with the reference project).
- `components/map/MapView.tsx`: new visibility ref/state pair, toggle button ("Hide/Show actual range outline"), refresh interval effect, canvas mount alongside the map container, rAF loop start/stop tied to the toggle.
- `scripts/squawkmap3d.nginx.conf`: new `location = /data/outline.json` proxy block (`proxy_pass http://host.docker.internal:8080/data/outline.json;`), mirroring the existing `receiver.json` block.
- No breaking changes to any existing layer, the `aircraft-tracks-layer` capability, or feeder deployment behavior; no new npm dependencies (plain Canvas 2D API + existing MapLibre `map.project()`, no deck.gl needed for this layer).

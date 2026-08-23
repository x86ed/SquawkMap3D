## Context

`components/map/layers.ts` + `components/map/MapView.tsx` already have a "live-fetched GeoJSON" integration shape used by `special-use-airspace-layer` (`components/map/specialUseAirspace.ts`) and `tfr-layer` (`components/map/tfr.ts`):

- A small module exports `fetch<Thing>(): Promise<FeatureCollection>` that wraps the request in try/catch and returns an empty `FeatureCollection` (never throws) on any failure.
- `layers.ts` adds a `type: "geojson"` source seeded with an empty `FeatureCollection`, plus one or more style layers (fill/line), each guarded with `if (!map.getSource(...))` / `if (!map.getLayer(...))` for idempotency.
- A `refresh<Thing>(map)` function in `layers.ts` calls the fetch module and pushes the result into the source via `(map.getSource(id) as GeoJSONSource).setData(data)`.
- `MapView.tsx` holds a visibility `useState`/`useRef` pair, calls `refresh<Thing>()` once on map init (if default-visible) and again whenever the layer is toggled on, and runs a `setInterval` while enabled to keep the data current — cleared on toggle-off/unmount.
- The layer's style/line/fill layer IDs are added to `CUSTOM_LAYER_IDS` in `layers.ts` so they're preserved across the raster style swap pilot mode performs (see `applyPilotMode`/`CUSTOM_LAYER_IDS` usage around `layers.ts:70` and `layers.ts:488`).

The VATSIM `Boundaries.geojson` feed fits this shape directly: it's a public, unauthenticated GeoJSON `FeatureCollection` of `MultiPolygon` features (one per FIR/UIR/oceanic control area), each with `properties.id` (ICAO-ish FIR/division code), `properties.oceanic` (`"0"`/`"1"`), `properties.region`, `properties.division`, and `properties.label_lon`/`label_lat` (a suggested label anchor, unused by this change — see Non-Goals).

## Goals / Non-Goals

**Goals:**
- Add the Airspace Boundaries layer, independently toggleable, following the existing add-source/set-visibility/toggle-button/refresh convention used by `special-use-airspace-layer` and `tfr-layer`.
- Always fetch from the live VATSIM URL at runtime — never vendor/bundle a static copy of `Boundaries.geojson` under `public/data/`, per the acceptance criteria ("draw from source every time").
- Keep the layer's failure mode non-fatal: a fetch failure leaves the map (and other layers) working, with the boundaries layer empty or showing its last-known data.
- Style the layer so it's visually distinguishable from the other airspace/boundary layers already on the map (military bases, TFR, special use airspace, OpenAIP).

**Non-Goals:**
- No FIR/UIR text labels at each `label_lon`/`label_lat` anchor — that requires a `symbol` layer with label-collision handling, which is a separate, non-trivial styling feature. Left as a natural follow-up.
- No client-side filtering by `region`/`division`/`oceanic` (e.g. "show only VATEUD") — the whole feed is rendered as one layer, consistent with how every other polygon layer in this app (SUA, TFR, military bases) renders its whole feed unfiltered.
- No offline/bundled fallback — if `raw.githubusercontent.com` is unreachable, the layer is simply empty (for a first load) or stale (after a successful prior load), same behavior as SUA/TFR today.

## Decisions

**1. New module `components/map/airspaceBoundaries.ts`, mirroring `specialUseAirspace.ts`:**
```ts
export async function fetchAirspaceBoundaries(): Promise<FeatureCollection> {
  try {
    const response = await fetch(AIRSPACE_BOUNDARIES_GEOJSON_URL);
    if (!response.ok) return EMPTY_FEATURE_COLLECTION;
    return await response.json();
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}
```
`AIRSPACE_BOUNDARIES_GEOJSON_URL` is a new constant in `constants.ts`, hardcoded to the raw GitHub URL from the acceptance criteria (no env var / API key needed — the feed is public).

**2. Render as a line-only layer, no fill.** The feed's `MultiPolygon` geometries represent FIR/UIR/oceanic control-area boundaries, not enclosed regions the user needs filled context for (unlike SUA/TFR, where "am I inside this restricted area" is the point). A worldwide filled-polygon layer would also visually overwhelm the map at low zoom (every FIR on Earth rendered as a translucent fill at once). A single `line` layer (`AIRSPACE_BOUNDARIES_LINE_LAYER_ID`) sourced from the same polygon data via MapLibre's standard line-from-polygon rendering satisfies "visually distinct" (no other layer on this map is fill-less) while staying legible at world zoom.

**3. Color: cool blue/cyan (`#2fd0ff`), distinct from the existing warm palette.** Military bases use magenta (`#ed6bff`/`#e12afb`), TFR uses red (`#ff3b30`/`#d1001f`), SUA uses orange (`#ff9500`/`#c96f00`) — all warm hues. A cool blue keeps the new layer legible against both light and dark base styles and doesn't collide with the existing warm-hued set.

**4. Refresh cadence: fetch on layer enable (map init if default-visible, and again on every toggle-on), plus a 1-hour periodic refresh while enabled.** Unlike TFRs (change daily) or SUA boundaries (FAA amendments), VATSIM's FIR/UIR boundary set changes rarely — only when VATSIM restructures a division's airspace. A short poll interval (SUA's 10 minutes, TFR's 5 minutes) would be wasted requests against GitHub's raw-content CDN for data that's effectively static session-to-session. An hourly refresh keeps the "always draw from the live source, never a stale bundle" intent of the acceptance criteria (a long-lived tab won't drift indefinitely) without the request volume of the shorter-interval layers. `AIRSPACE_BOUNDARIES_REFRESH_INTERVAL_MS = 60 * 60_000`.

**5. `CUSTOM_LAYER_IDS` inclusion + `MapLayerVisibility` field:** `AIRSPACE_BOUNDARIES_LINE_LAYER_ID` is added to `CUSTOM_LAYER_IDS` (same list `SUA_FILL_LAYER_ID`/`SUA_LINE_LAYER_ID` are in) so the layer survives the raster-style swap pilot mode performs. A new `airspaceBoundaries?: boolean` field is added to the `MapLayerVisibility` type in `layers.ts`, following the `specialUseAirspace?: boolean` precedent.

**6. Toggle default: on**, matching the existing precedent (SUA, TFR, military bases all default to visible) rather than requiring an opt-in click to see the new layer.

## Risks / Trade-offs

- **[Risk]** `raw.githubusercontent.com` is a general-purpose CDN, not a dedicated GIS/tile API — no documented rate-limit or uptime SLA for this specific file. **Mitigation**: failure is non-fatal (empty/stale layer, no thrown error), consistent with how this app already treats every other live third-party feed (SUA, TFR, RainViewer).
- **[Risk]** The feed is large (worldwide FIR/UIR polygon coverage, several MB of coordinate data) — fetching it on every map load/toggle-on adds a non-trivial payload. **Mitigation**: browser HTTP caching applies normally to the raw GitHub CDN response (it sets standard cache headers); no additional caching layer is introduced by this change, matching the "fetch live every time, don't hand-roll a cache" reading of the acceptance criteria.
- **[Trade-off]** No FIR/UIR labels (Non-Goal above) means the boundaries are visible but not identified by name/code without a follow-up change. Accepted to keep this change scoped to "load the layer + toggle it," matching the acceptance criteria exactly.

## Migration Plan

Purely additive — no existing layer, source, or API changes. Implemented and merged as a single self-contained layer (unlike the 8-layer `add-missing-map-layers` change, this is one layer with one straightforward live GeoJSON source). No rollback beyond reverting this change's commit(s).

## Open Questions

- None outstanding — the feed URL, format, and required behavior are all fully specified by the acceptance criteria and confirmed live (see proposal.md).

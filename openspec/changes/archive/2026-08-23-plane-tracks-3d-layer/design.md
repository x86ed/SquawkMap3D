## Context

SquawkMap3D (Next.js 16 App Router, React 19, MapLibre GL JS 6, client-only map component in `components/map/MapView.tsx`) currently has zero aircraft data — every existing layer (`layers.ts`) is airspace/weather context. This change adds the app's actual reason for existing: live planes, in 3D, from the user's own feeder.

Three external references anchor the design:
- **tar1090** (readsb/dump1090-fa web UI) — not fetched or embedded; it defines the `aircraft.json` schema/semantics we replicate for feeder parity (hex, flight, lat/lon, `alt_baro`/`alt_geom`, `gs`, `track`, `baro_rate`, `squawk`, `category`, `t`). tar1090's optional trace-history files (`--write-globe-history`) require decoder-side config most feeders don't enable, so this design does not depend on them.
- **aeris** (kewonit/aeris) — reference for the *visual* result: MapLibre base + deck.gl overlay, altitude-driven z-elevation and color, `PathLayer` trails, pitched camera. We are not adopting its data-aggregator fallback chain (adsb.lol/adsb.fi/airplanes.live/OpenSky) — this app's acceptance criteria is explicitly "from the feeder," i.e., the user's own receiver, not a public aggregator.
- **AircraftShapesSVG** / **pw-silhouettes** — vendored static icon sets, keyed by ICAO type designator and ADS-B emitter category respectively.

## Goals / Non-Goals

**Goals:**
- Poll a user-configured feeder's `aircraft.json` and render current aircraft as 3D, altitude-positioned icons over the existing terrain/map.
- Render a recent flight-track trail per aircraft, colored by altitude.
- Resolve a per-type aircraft icon where possible, falling back to a category silhouette, falling back to a generic marker — never nothing.
- Fit the existing layer-toggle conventions (`MapView.tsx` toggle row, visibility ref/state pair) and survive theme/pilot-mode style swaps.
- No-op gracefully (empty layer, no errors) when no feeder is configured, matching the `NEXT_PUBLIC_OPENAIP_API_KEY`-unset pattern.

**Non-Goals:**
- Server-side/persisted flight-history (readsb globe-history trace files, MLAT multilateration nuance, historical playback/scrubbing). Tracks are session-local, built client-side from successive polls.
- Multi-feeder aggregation or feeder discovery — one configured feeder URL.
- Full tar1090 UI parity (aircraft list table, filters, range rings tied to aircraft, replay). Only the data-model parity needed to plot positions/tracks.
- 3D glTF aircraft meshes (what aeris itself renders). The acceptance criteria specifies 2D top-down SVG shapes (AircraftShapesSVG/pw-silhouettes) as the aircraft representation, not 3D models — those are rendered as billboarded icons, not scenegraph meshes.

## Decisions

### 1. Rendering via a deck.gl overlay, not MapLibre native layers
MapLibre's `symbol`/`circle`/`line` layers drape onto the ground or terrain surface; there's no per-feature "float this marker N meters above the terrain" property. Placing an aircraft icon at its real barometric altitude — the core of the aeris look — needs a renderer with per-feature elevation. `@deck.gl/mapbox`'s `MapboxOverlay` composites deck.gl layers into an existing MapLibre `Map` instance. `IconLayer` (elevation baked into `getPosition`'s third coordinate) renders the aircraft icons; `PathLayer` (elevation per path vertex) renders the altitude-colored trails.
- **Alternative considered**: pure MapLibre, faking altitude with an icon-size/vertical-offset hack keyed to zoom. Rejected — no real 3D depth, breaks as soon as the camera pitches/rotates, doesn't match the aeris reference.
- **Alternative considered**: raw Three.js custom layer (MapLibre supports custom WebGL layers). Rejected — deck.gl already solves icon-atlas batching, path-smoothing, and MapLibre interleaving; reimplementing that is unnecessary scope.
- **Correction from implementation/live testing**: originally specified `interleaved: true` (shared WebGL context with MapLibre, correct depth-sorting against terrain/3D buildings). Verified live that this crashes the app's render loop entirely (blank map) — `@deck.gl/mapbox` 9.3.10's interleaved-mode `centerCameraOnTerrain` throws `Cannot read properties of undefined (reading 'elevation')` against MapLibre GL JS 6.5's terrain internals (a real upstream version gap between these two libraries' current releases, not an app bug), and since interleaved mode runs inside MapLibre's own custom-layer render call, the exception aborts that frame. Shipped as `interleaved: false` instead (deck.gl draws to its own overlay canvas layered on top) — verified working. Trade-off: deck.gl content no longer depth-sorts against the 3D terrain mesh, so an aircraft icon isn't occluded by a mountain in front of it; acceptable for small overhead icons/tracks. See Risks below.

### 2. Overlay lifecycle is independent of MapLibre style swaps
Existing custom layers (military bases, TFR, SUA, etc.) live *inside* the MapLibre style and must be re-added in `addCustomLayers` on every `style.load` (theme toggle, pilot mode both call `setStyle`, which wipes style-owned sources/layers — see `terrain.ts`'s comment on the same issue). A deck.gl `MapboxOverlay` is *not* part of the style; it's added once via `map.addControl(overlay)` and persists across `setStyle` calls, only needing its `layers` prop updated (via `overlay.setProps`) when aircraft data refreshes or visibility toggles. This means the aircraft layer's mount code is simpler than the other layers' (no `style.load` re-registration), which should be called out in code comments so a future contributor doesn't assume it needs the same pattern.

### 3. Feeder polling: client-side fetch, configurable base URL, no proxy
`aircraft.json` is fetched directly from the browser against `NEXT_PUBLIC_FEEDER_URL` (e.g., `http://192.168.1.50:8080/data/aircraft.json` or a public feeder URL), the same way `airspaceBoundaries.ts`/`rainviewer.ts` fetch third-party feeds — no Next.js API-route proxy. This mirrors how tar1090 itself works (browser fetches its own decoder's JSON directly) and keeps the feeder reachable purely by network config (LAN, VPN, reverse proxy) without adding server-side plumbing. Feeders commonly serve `aircraft.json` without CORS headers configured for arbitrary origins — this is a known limitation, called out in Risks below, not solved by this change.
- **Alternative considered**: Next.js API route (`app/api/aircraft/route.ts`) proxying the feeder. Would sidestep CORS (server-to-server fetch has none) but only works when the feeder is reachable from wherever the Next server runs, which breaks the common case of a feeder on the user's home LAN and the app accessed from elsewhere. Left as a documented option in Open Questions rather than the default.

### 4. Poll interval: fast, fixed, not adaptive
tar1090 polls roughly every 1-5s depending on view state; aeris throttles 30s-5min against rate-limited third-party APIs. Since this design talks to the user's own feeder (no rate limit, LAN-local), default to a fixed `AIRCRAFT_FEED_REFRESH_INTERVAL_MS = 1000` (1s) — fast enough for smooth-looking motion without the adaptive-throttling complexity aeris needs for shared public APIs. This is a large departure from every other layer's refresh interval (5-60 minutes for slow-changing weather/airspace data) and should be visually obvious in `constants.ts` so it isn't "corrected" to match the others later.

### 5. Track trails: client-accumulated ring buffer, not server trace files
Each polled position for a hex is appended to an in-memory per-aircraft array, capped at `AIRCRAFT_TRACK_MAX_POINTS` (time- or count-bounded — e.g., last 10 minutes), building the trail from the moment the layer is enabled. This avoids depending on readsb's `--write-globe-history` (not universally enabled) and matches the Non-Goal of skipping historical playback. Trails reset on page reload; this is an accepted limitation, not a bug.

### 6. Icon resolution chain: type designator → emitter-category generic → dot
1. Look up `aircraft.t` (ICAO type designator, e.g. `A320`) directly against vendored `public/aircraft-shapes/<TYPE>.svg` (AircraftShapesSVG's filenames are ICAO type designators, confirmed against the repo listing — e.g. `A320.svg`, `A20N.svg`, `B738.svg`). All 182 vendored; which are actually present is read from a `manifest.json` the vendor script writes alongside them (no directory-listing API for Next's `public/`).
2. If no file matches, map `aircraft.category` (ADS-B emitter category, `A0`-`D7`) to a vendored fallback SVG under `public/aircraft-silhouettes/<category>.svg` via a static table in `constants.ts`.
3. If `category` is absent/unrecognized too, fall back to a simple rotated triangle/dot (existing-style inline icon, no external asset).
SVGs are rasterized into a deck.gl `IconLayer` icon-atlas at build/load time (deck.gl's `IconLayer` takes a `getIcon` mapping into an atlas image + mapping JSON, not raw SVG per-feature) — `aircraftIcons.ts` owns building that atlas once from the vendored SVGs, not per-frame.
- **Vendoring, not live fetch**: unlike the boundary/weather feeds, these are static icon sets with infrequent upstream changes; vendoring avoids a runtime fetch dependency and rate-limit/availability risk for something that should never visibly fail. Matches how `flag-icons` is already vendored into the project (see `package.json`/`scripts/copy-flag-icons.mjs`).
- **Correction from implementation**: pw-silhouettes turned out to have no `generics/*.svg` directory as originally assumed — `generics/<category>.json` are metadata files mapping each category to an `aliasOf` type designator (or, for a few categories, an inline `art.frames` SVG path), pointing into the repo's `silhouettes/` directory of per-airframe SVGs. Resolved all 15 mappings by hand against that metadata (documented in `scripts/vendor-aircraft-icons.mjs`) and vendored just those 15 resulting SVGs, renamed to their ADS-B category code (`A1.svg`..`C2.svg`) — same net effect (one fallback silhouette per category), different source-repo mechanics than assumed.

### 7. Altitude-to-color mapping
Reuse aeris's cyan-low/gold-high gradient as the default (interpolate `alt_baro` across a fixed range, e.g. 0-45,000ft) for both the icon tint and the `PathLayer` trail color, giving the "altitude at a glance" read the reference calls out.

## Risks / Trade-offs

- **[Risk] Feeder CORS**: many dump1090-fa/readsb/tar1090 setups don't send `Access-Control-Allow-Origin` for the browser-direct fetch to succeed from a different origin than the feeder's own web UI. → *Mitigation*: document the required feeder-side CORS header (or reverse-proxy config) in the layer's setup notes; treat fetch failure as "empty feed," same as every other feed module, so it degrades to a no-op layer rather than an error.
- **[Risk] New major dependency (deck.gl family)**: first non-MapLibre rendering dependency in the app; bundle size and an additional WebGL-integration surface to maintain. → *Mitigation*: only `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` — scope strictly to `IconLayer`/`PathLayer`, not deck.gl's wider layer catalog (`@deck.gl/geo-layers` was pulled in during proposal/design but dropped once implementation showed the two base layers sufficed).
- **[Risk, materialized] deck.gl 9.3.10 × MapLibre GL JS 6.5 interleaved-terrain incompatibility**: `MapboxOverlay`'s `interleaved: true` mode crashes this app's render loop (blank map) against MapLibre's terrain internals — see Decision 1's correction. → *Mitigation*: shipped `interleaved: false` (verified working); the same code path still logs one caught, non-fatal `TypeError` per MapLibre render/resize event (console noise, not a functional break) — revisit both if a future deck.gl/MapLibre release fixes the underlying incompatibility.
- **[Risk] pw-silhouettes is CC BY-NC-SA 4.0 (non-commercial)**: constrains reuse of the vendored fallback assets if SquawkMap3D were ever used commercially, despite the app's own MIT license. → *Mitigation*: vendor with LICENSE/attribution intact, document the constraint plainly in the impact/README, don't relicense or imply MIT coverage over those specific assets.
- **[Risk] AircraftShapesSVG is GPL-3.0**: applying a copyleft code license to static image assets is legally ambiguous, but the safe read is to comply as if it applies — include the LICENSE file, don't strip attribution, treat the vendored SVGs as GPL-encumbered assets. → *Mitigation*: same as above — isolate under their own LICENSE file in `public/aircraft-shapes/`.
- **[Risk] Aircraft count / render performance**: a busy feeder (major hub, dense airspace) can report hundreds of aircraft; per-frame `IconLayer` re-render plus growing `PathLayer` trails could get expensive. → *Mitigation*: cap track length (`AIRCRAFT_TRACK_MAX_POINTS`), let deck.gl's GPU-instanced `IconLayer` handle icon count (it's designed for this), revisit viewport-culling only if real usage shows it's needed — not built preemptively.
- **[Trade-off] No historical trace on layer-enable**: tracks start empty and grow from the moment the layer turns on, rather than showing "where this plane has been for the last hour" immediately like tar1090 can with globe-history enabled. Accepted per Non-Goals; callable out as a known gap, not silently different behavior.

## Migration Plan

Purely additive — new files, new optional env var, new dependency. No existing layer, data, or behavior changes. Rollback is deleting the new files/toggle and the deck.gl dependency; nothing else depends on this layer existing.

## Open Questions

- Should a server-side proxy route be offered later for feeders unreachable from wherever the Next server runs from a browser session (e.g., a feeder only reachable server-side via VPN)? Left as a follow-up, not blocking this change (see Decision 3).
- Exact `AIRCRAFT_TRACK_MAX_POINTS`/retention window (point-count vs. wall-clock cutoff) — left to implementation to tune against real feeder output rather than fixed here.

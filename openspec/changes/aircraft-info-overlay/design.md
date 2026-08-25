## Context

Aircraft are rendered as a deck.gl `IconLayer` + `PathLayer` (`components/map/aircraftLayer.ts`) inside a `MapboxOverlay` (`deckOverlayRef` in `MapView.tsx`), refreshed on a ~1Hz poll of the feeder's `aircraft.json` (`fetchAircraft()` in `aircraft.ts`). The `IconLayer` is currently `pickable: false` — there is no selection concept anywhere in the codebase today.

The only prior "click a map feature, see details" precedent is `airport-details-popup` (archived 2026-08-23): a MapLibre `symbol` layer with `map.on("click", LAYER_ID, ...)` opening a `maplibregl.Popup`. That pattern does **not** transfer directly here:
1. The aircraft layer is a deck.gl layer inside a `MapboxOverlay`, not a MapLibre style layer — there is no `map.on("click", AIRCRAFT_ICON_LAYER_ID)` to hook; deck.gl layers get picking via their own `onClick` prop (or a top-level `onClick` on the `MapboxOverlay`/`Deck` instance).
2. A `maplibregl.Popup` is anchored to a fixed `LngLat` at open time and does not track a moving feature. Aircraft move every poll; a popup would visibly detach from the icon within seconds. This change therefore uses a persistent, non-anchored **bottom drawer** (as specified in the feature request) rather than a popup.

`aircraft.json`'s documented field set (readsb's own reference, already partially adopted in this codebase — see `aircraft.ts`'s file-level comment) includes several fields this codebase does not yet map: `r` (registration), `desc` (manufacturer/model description string), `ownOp` (operator name), `year`, `seen` (seconds since the last message from that aircraft). Like `t` (type designator), every one of these is populated **only** when the feeder loads a tar1090-db `aircraft.csv.gz` — they are omitted entirely otherwise, so they must stay optional/`undefined`-safe exactly like the existing `t` field.

There is **no rarity/tier concept anywhere in this codebase** (confirmed via `grep -ril rarity`/`tier` across the repo, excluding this change, before writing this design). The feature request's mockup assumes an adsb.win-style rarity system exists to "reuse or align with" — it does not. This design introduces one from scratch: originally scoped to fields already collected by this app (see the now-superseded placeholder table this document previously carried); **as of this amendment, rarity is instead computed from a vendored snapshot of a real per-aircraft-type rarity dataset** (`taildragger`, a sibling game project — see Decision 5), keyed by the `typeDesignator` field this app already collects, rather than invented from ADS-B category/squawk signals.

## Goals / Non-Goals

**Goals:**
- Clicking an aircraft selects it; selection drives a map glow highlight and a bottom-drawer overlay, both colored/labeled by a computed rarity tier.
- A toggleable, default-on "follow" control pins the selected aircraft at a fixed on-screen position and pans the map viewport underneath it as it moves (see Decision 13) — framed as "the aircraft stays put on screen, the map moves," not the reverse.
- The drawer is composed of four independently-defined components (`PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane`), each fed a shared, real (not fabricated) view-model derived from this app's actual `Aircraft`/track-buffer/feeder-site data (plus, for rarity, the vendored `taildragger` snapshot — see Decision 5).
- Every field the drawer displays either comes from real feeder data, is computed client-side from real feeder data or the vendored rarity snapshot (distance, sparkline, rarity), is sourced from the feeder's own tar1090 route database via server-side proxy (route/ETA, when tar1090 has a match), or is an explicit, honest "no data" state — never a mocked/placeholder value presented as real.

**Non-Goals:**
- Reproducing adsb.win's actual (undisclosed, likely frequency-database-backed) rarity algorithm. This change's rarity value/tier is sourced from a different real dataset (`taildragger`'s own game-balance `rareness` field, not adsb.win's), which is a deliberate, documented substitution — see Decision 5's residual risk.
- Persisting selection across page reloads, or supporting multi-aircraft selection.
- Pausing "follow" on manual user pan/drag (follow simply recenters every poll while on; a user who drags the map while following is on will see it snap back on the next ~1s poll). Confirmed as accepted v1 behavior (not merely deferred) — see Decision 13. This can be revisited in a follow-up if it proves annoying in practice.
- Persisting telemetry/track history beyond this session (mirrors `aircraft-tracks-layer`'s own existing non-goal for its track trails — same in-memory, non-persisted buffer).

## Decisions

### 1. Selection state lives in `MapView.tsx`, not a new context/store
`MapView.tsx` already owns every other piece of map interaction state (theme, pilot mode, a dozen layer-visibility booleans, `userLocationRef`, etc.) as local `useState`/`useRef` pairs (state for render, ref for the mount-effect's stable closures — the established pattern throughout this file, e.g. `militaryVisible`/`militaryVisibleRef`). Selection (`selectedAircraftHex: string | null` + `selectedAircraftHexRef`) follows the identical pattern rather than introducing React Context or an external store, for consistency and because nothing outside `MapView`'s own tree needs this state except the new `AircraftOverlay`, which `MapView` renders directly as a child and can hand props to.

### 2. Picking: per-layer `onClick` on the `IconLayer`, not a `Deck`-level handler
deck.gl v9 layers accept their own `onClick` prop (`{ object, ... } | null` per pick). Setting it directly on the `IconLayer` in `buildAircraftLayers()` (passed through via a new `onAircraftClick` param) keeps the click handler colocated with the layer definition, avoids needing to distinguish aircraft-layer picks from track-layer picks in a shared top-level handler, and requires no change to `MapboxOverlay` construction. `pickable: true` is required on the `IconLayer` for this to fire at all (currently `false`); the `PathLayer` (track trails) stays `pickable: false` — track segments aren't selectable.

### 3. Deselection: click-elsewhere via the `Deck` layer's own empty-pick, same-aircraft click toggles off, Escape key
- Clicking empty map area: deck.gl's `onClick` on a pickable layer only fires when a pick hits that layer; a MapLibre-level `map.on("click", ...)` (not scoped to a layer id) fires for *every* click, so it's used as the "clicked elsewhere" fallback — but it must not fire when the click actually hit the aircraft icon (which the `IconLayer`'s own `onClick` already handled). deck.gl's pick info includes a `layer`/`object` — the `IconLayer.onClick` handler, when it fires, calls `event.srcEvent?.stopPropagation?.()`-equivalent isn't available for MapLibre's synthetic click, so instead this uses a one-tick guard ref (`lastAircraftClickAtRef`, a timestamp) that the map-level click handler checks and skips if a matching aircraft click just handled the same pointer event (mirrors no existing precedent exactly, but is the standard workaround for deck.gl-inside-MapLibre click-bubbling — documented as a known interaction in deck.gl's `MapboxOverlay` issues).
- Clicking the already-selected aircraft's icon again: the `IconLayer.onClick` handler itself toggles off (`hex === selectedAircraftHexRef.current ? null : hex`) rather than always selecting.
- Escape key: a `keydown` listener (added in the mount effect, removed on unmount, same lifecycle as the other `map.on(...)` listeners) clears selection when `event.key === "Escape"`.

### 4. Glow highlight: a second deck.gl layer, not a CSS/DOM effect
The aircraft icon is a deck.gl `IconLayer` texel, not a DOM element — no CSS `filter: drop-shadow` target exists. A glow is instead a second, larger, semi-transparent circle rendered *underneath* the icon at the same position, using `ScatterplotLayer` — precedent: `radarSweep.ts` already builds `ScatterplotLayer` dots for the same aircraft data. `buildAircraftLayers()` gains a `selectedHex: string | null` param; when set and matching a currently-positioned aircraft, a one-element `ScatterplotLayer` is added (radius in pixels, `getFillColor` from `RARITY_TIER_COLORS[computeRarityTier(aircraft)]` at reduced alpha, stacked below the existing `trackLayer`/`iconLayer` in the returned array so it renders first/underneath). No animation/pulsing in this change (Non-Goal-adjacent — kept simple; a `requestAnimationFrame` pulse can follow later without changing this shape).

### 5. Rarity value and tier: computed from a vendored `taildragger` rareness snapshot, bucketed by data-derived octile cutpoints, styled with adsb.win's real, verified 9-tier taxonomy

**This decision replaces this document's original placeholder heuristic (an ordered squawk/category/icon-shape signal table) entirely, and its own first revision (an invented 5-tier taxonomy with hand-approximated colors), which this amendment corrects.** Rarity is no longer computed from ADS-B category or squawk, and it no longer uses a 5-tier taxonomy this project made up. It is sourced from a real per-aircraft-type "rareness" field from `taildragger`, a sibling game project (`/Users/adamsiegel/Workspace/git/taildragger/aircraft-data.json` on the machine this design was authored on — **not part of this repo and not a runtime dependency**; see the data-delivery subsection below) for *which numeric bucket an aircraft type falls into*, combined with adsb.win's own real, **verified-exact** tier names and CSS (fetched directly from `https://adsb.win/assets/tailwind-255296c3.css` and independently re-fetched/re-diffed byte-for-byte during this amendment — not approximated, not guessed) for *what those buckets are called and how they're styled*.

**Rarity value:**
- `taildragger`'s dataset is `{ updatedAt, count, rows: [...] }`; each row has an `id` field confirmed to be a standard ICAO type designator (e.g. `"B738"`, `"A320"`, `"A339"`), matching this codebase's own `Aircraft.typeDesignator` (readsb's `t` field, Decision 6). Of `taildragger`'s 2707 rows, 1679 have a defined `rareness` field (the rest are catalog entries the game itself hasn't scored yet) — only those 1679 are usable.
- `computeRarityValue(aircraft): number | undefined` returns `row.rareness / 100`, where `row` is the vendored-snapshot row whose `id` matches `aircraft.typeDesignator`, or `undefined` when `typeDesignator` is unset or has no matching row. **This is a behavior change from this document's prior revision**, which returned a fixed fallback value (`15`) for an unmatched aircraft and treated it as "assume it's above-median rare." That framing was wrong: an unmatched aircraft isn't a rare *value* on the scale at all — adsb.win itself has no rarity classification for it (see the `unidentified` tier below), so there is no meaningful numeric value to report. Callers that need a display value MUST check `computeRarityTier(aircraft) === "unidentified"` (or that `computeRarityValue` returned `undefined`) rather than treating an `undefined`/absent value as "unusually rare."
- Verified distribution of `rareness / 100` across the 1679 scored rows: min `0.28`, max `20.49`, mean `10.07`, median `10.26`.

**The `unidentified` tier is not on the numeric scale.** On adsb.win, `unidentified` is what an aircraft gets when adsb.win has no rarity classification for its type at all — confirmed by inspecting two owned adsb.win cards with "UNKNOWN MANUFACTURER": their wrapper element carried no `aircraft-rarity--*` modifier class at all (just the bare `.aircraft-rarity` base rule), and their tier-badge span rendered with empty text. `computeRarityTier` mirrors this exactly: it SHALL return `"unidentified"` directly whenever `computeRarityValue` is `undefined` (no `typeDesignator`, or no matching vendored-snapshot row) — `unidentified` is never reached by bucketing a numeric value against a threshold.

**Tier bucketing for the other 8 named tiers (octile-derived, not invented):** the same 1679-value distribution was sorted and cut at its 12.5th/25th/37.5th/50th/62.5th/75th/87.5th percentiles (equal-population octiles — 7 cutpoints for 8 buckets, same linear-interpolation methodology as this document's prior 4-cutpoint/5-bucket revision, just recomputed for 8 buckets instead of 5) to produce eight tiers of roughly equal dataset share, in adsb.win's own confirmed low→high order:

| Tier | `rarityValue` range | Approx. share of the 1679-row dataset |
|---|---|---|
| `standard` | `< 5.84` | ~12.5% (lowest octile) |
| `prime` | `5.84 ≤ v < 7.55` | ~12.5% |
| `remarkable` | `7.55 ≤ v < 8.98` | ~12.5% |
| `exceptional` | `8.98 ≤ v < 10.26` | ~12.5% |
| `epic` | `10.26 ≤ v < 11.45` | ~12.5% |
| `legendary` | `11.45 ≤ v < 12.66` | ~12.5% |
| `mythic` | `12.66 ≤ v < 14.00` | ~12.5% |
| `apex` | `≥ 14.00` | ~12.5% (highest octile) |

These seven cutpoints (`5.84`, `7.55`, `8.98`, `10.26`, `11.45`, `12.66`, `14.00`) are pinned as constants (`RARITY_TIER_OCTILE_THRESHOLDS` in `aircraftRarity.ts`, replacing the prior revision's 4-cutpoint `RARITY_TIER_THRESHOLDS`), computed once from the vendored snapshot and hardcoded — **not recomputed at runtime**. Note `epic` and `legendary` are reused as tier *names* here (adsb.win happens to name its 5th/6th tiers the same as two of this document's originally-invented 5 tiers) but now sit at different positions (5th/6th of 8, not 4th/5th of 5) with different cutpoints and different colors — this is coincidental name overlap with adsb.win's real taxonomy, not a holdover from the prior revision's invented one.

**Tier → style (verified-exact, not approximated):** each of the 8 named tiers maps to adsb.win's own `{ color, highlight, glow }` CSS custom-property triple, exactly as extracted from the live stylesheet (`.aircraft-rarity--<tier>`'s `--rarity-color`/`--rarity-highlight`/`--rarity-glow`); `unidentified` uses the base `.aircraft-rarity` rule's own defaults, which are close to but *not identical to* `standard`'s override — notably a different glow (`unidentified` glow `#64748b33` vs. `standard` glow `#94a3b83d`), preserved exactly rather than treated as redundant:

| Tier | `color` | `highlight` | `glow` |
|---|---|---|---|
| `unidentified` (base rule defaults) | `#64748b` | `#cbd5e1` | `#64748b33` |
| `standard` | `#64748b` | `#cbd5e1` | `#94a3b83d` |
| `prime` | `#0891b2` | `#67e8f9` | `#06b6d46b` |
| `remarkable` | `#2563eb` | `#93c5fd` | `#3b82f675` |
| `exceptional` | `#7c3aed` | `#c4b5fd` | `#8b5cf680` |
| `epic` | `#db2777` | `#f9a8d4` | `#ec489985` |
| `legendary` | `#d97706` | `#fde68a` | `#f59e0b8f` |
| `mythic` | `#db2777` | `#f0abfc` | `#d946ef9e` |
| `apex` | `#bae6fd` | `#fff` | `#cffafed1` |

`RARITY_TIER_STYLES: Record<RarityTier, { color: string; highlight: string; glow: string }>` replaces the prior revision's single-string `RARITY_TIER_COLORS`. Any consumer that only wants one accent color (the map glow-highlight layer, `components/map/aircraftLayer.ts`) uses `RARITY_TIER_STYLES[tier].color`.

**Card frame CSS (the two-layer gradient-border-frame technique, `PlaneCard` only — not needed by the map glow layer):**
```css
/* Base rule (all tiers except mythic/apex use this formula verbatim,
   substituting each tier's own --rarity-color/--rarity-highlight/--rarity-glow) */
.aircraftRarityFrame {
  --rarity-color: #64748b;   /* per-tier, see table above */
  --rarity-highlight: #cbd5e1;
  --rarity-glow: #64748b33;
  /* Base formula (no color-mix() support): */
  background: linear-gradient(135deg, var(--rarity-highlight), var(--rarity-color) 35%, var(--rarity-color));
  border-radius: 1.65rem; /* 26.4px */
  padding: 2px 2px 22px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 14px 32px #02061747, 0 0 22px var(--rarity-glow);
  transition: transform .16s ease-out, box-shadow .2s;
}
/* @supports (color: color-mix(in lab, red, red)) upgrade: */
@supports (color: color-mix(in lab, red, red)) {
  .aircraftRarityFrame {
    background: linear-gradient(135deg, var(--rarity-highlight), color-mix(in srgb, var(--rarity-color) 30%, #070b14) 35%, var(--rarity-color));
  }
}
.aircraftRarityFrame:hover {
  box-shadow: 0 22px 44px #02061761, 0 0 34px var(--rarity-glow);
}
.aircraftTierCard { /* the inner card sitting on top of the frame */
  border-radius: 1.5rem; /* 24px */
}
/* mythic and apex override `background` directly instead of using the
   shared linear-gradient formula above */
.aircraftRarityFrame[data-tier="mythic"] {
  background: conic-gradient(from 210deg, #22d3ee, #8b5cf6, #ec4899, #f59e0b, #22d3ee);
}
.aircraftRarityFrame[data-tier="apex"] {
  box-shadow: 0 14px 32px #02061747, 0 0 14px #ffffffb8, 0 0 34px var(--rarity-glow);
  background: linear-gradient(120deg, #fff, #ecfeff 18%, #bae6fd 46%, #e0e7ff 72%, #fff);
}
```
This is a gradient-border-frame technique: the outer element's own `background` *is* the border color; the inner card sits on top, covering all but a ~2px ring plus 22px at the bottom where floating tier/rarity badges sit (`padding: 2px 2px 22px` on the outer, matched by the inner card filling the remaining space). `PlaneCard.module.css` implements this with a `data-tier` attribute selector (matching the existing `[data-tier="..."]` pattern already used in that file) rather than adsb.win's `--rarity-*` custom-property-per-class approach, since this app sets the three custom properties inline from `RARITY_TIER_STYLES` (Decision 10's existing `--tier-color`-via-inline-style precedent, extended to three properties).

**Data delivery (build-time vendored snapshot, not a runtime dependency on the other repo):**
- `taildragger`'s `aircraft-data.json` is 3.2MB and lives in a sibling repo at a local-dev-machine path (`/Users/adamsiegel/Workspace/git/taildragger/aircraft-data.json`) — that path does not exist on a deployed feeder and **must never be fetched or read at runtime** by this app.
- Following the exact precedent already established in this codebase for `/data/airports.geojson`/`/data/military-bases.geojson` (static data snapshots vendored into the repo rather than fetched live), this change vendors a trimmed snapshot — only the `id` and `rareness` fields (no `doc8643`/`markers`/`cardCategory`/`xp`/other game-specific fields) for the 1679 rows that have a defined `rareness` — as `components/map/data/aircraftRareness.json` (trimmed size ≈ 56KB for all 1679 rows, vs. the source's 3.2MB).
- Unlike `airports.geojson`/`military-bases.geojson` (which are handed to MapLibre/deck.gl as a *URL* for those libraries to fetch themselves, since they're consumed as map data sources), this snapshot is consumed synchronously inside `computeRarityTier(aircraft: Aircraft): RarityTier` — a plain function called on every aircraft-layer rebuild (per poll, per aircraft, including the hot path in `buildAircraftLayers()`). A runtime `fetch()` would force that function to become async, which none of its callers are structured for and which isn't needed for a ≈56KB file. So `aircraftRareness.json` is instead **imported directly as a module** (`import aircraftRareness from "./data/aircraftRareness.json"`, natively supported by Next.js/webpack's JSON loader) and converted once, at module load, into a `Map<string, number>` (`typeDesignator → rareness`) for O(1) synchronous lookups — still "vendored static data snapshot," just bundled via `import` instead of served via `public/` + `fetch`, because the consumption pattern (synchronous, in a hot path) differs from the GeoJSON map-source case.
- Generation is a **one-time (or periodically re-run) manual step, not a live dependency and not part of `npm run build`/CI** (CI has no access to the sibling repo's local path). A small script (e.g. `scripts/generate-aircraft-rareness.mjs`, run manually by a developer with the `taildragger` repo checked out locally) reads `taildragger`'s `aircraft-data.json`, filters to rows with a defined `rareness`, maps each to `{ id, rareness }`, sorts by `id`, and writes `components/map/data/aircraftRareness.json`, which is committed to this repo like any other vendored data asset. Re-run and re-commit whenever `taildragger`'s dataset meaningfully changes (no fixed cadence — this is a manual refresh, not scheduled).

### 6. New `Aircraft` fields: extend the existing optional-field pattern, don't fork the type
`registration` (from `r`), `manufacturerModel` (from `desc`), `operator` (from `ownOp`), `year` (from `year`), `secondsSinceLastMessage` (from `seen`) are added directly to `Aircraft`/`RawAircraftJson`/`normalize()`, all optional, all `undefined` when the raw field is absent — identical treatment to the existing `typeDesignator`/`t` handling, not a separate "extended aircraft" type. This keeps every consumer of `Aircraft` (icon resolution, track buffer, rarity) working against one shape.

### 7. Telemetry history: extend `TrackPoint`, don't add a parallel buffer
`TrackPoint` gains an optional `groundSpeed?: number`, populated in `updateTracks()` whenever the source `Aircraft` has one (independent of whether `lat`/`lon`/`altitude` gate recording a point at all — unchanged). `FlightInfoPane`'s sparkline reads `getTrack(hex)` (already exported) and plots `altitude`/`groundSpeed` per point. This reuses the exact retention/pruning/session-local semantics `aircraft-tracks-layer` already established (`AIRCRAFT_TRACK_RETENTION_MS`), rather than inventing a second buffer with its own lifecycle.

### 8. Distance (`DIST` in `TelemetryMarquee`): `turf.distance` from the resolved site, matching `radarSweep.ts` precedent
`radarSweep.ts` already computes `turf.bearing(siteCoord, [a.lon, a.lat])` from the feeder's surveyed site. `DIST` reuses the same site resolution (`getFeederLocation()`, falling back to `resolveUserLocation()`'s already-established chain in `MapView.tsx`) and adds `turf.distance(site, [aircraft.lon, aircraft.lat], { units: "nauticalmiles" })` — no new dependency, consistent units convention to introduce (nautical miles, matching aviation/ADS-B norms and this app's altitude-in-feet convention).

### 9. Component boundaries and props: one shared view-model, four dumb components
A single selector, `buildSelectedAircraftInfo(aircraft, track, site, rarityTier, route): SelectedAircraftInfo` (new, in `components/map/overlay/selectedAircraftInfo.ts`), assembles everything the four components need from an `Aircraft` + its track + the resolved site + its rarity tier + (per Decision 12) its resolved route/`null`, computed once per poll in `MapView.tsx` and passed down. `PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane` each take a slice of this view-model as props and render independently — no component reaches back into `MapView` state or re-fetches anything itself, keeping each trivially testable in isolation (per the acceptance criteria's explicit "create separate components" requirement) and keeping `AircraftOverlay` a pure layout/open-close/keyboard shell around the four.

### 10. Styling: CSS Modules, matching the existing (only) convention in this codebase
No Tailwind, styled-components, or other CSS-in-JS dependency exists in `package.json` — the one existing UI surface (`MapView.tsx`) uses a plain `.module.css` file. Every new overlay component gets a co-located `ComponentName.module.css` in the new `components/map/overlay/` directory, following that convention exactly rather than introducing the mockup's literal Tailwind-esque utility classes or CSS-custom-property token file. Rarity tier colors are still exposed as a small set of CSS custom properties (e.g. `--tier-color`) set inline per the selected aircraft's computed tier, so `PlaneCard`'s corner tag / accent border can reference `var(--tier-color)` without five hardcoded tier-color branches duplicated across component CSS.

### 11. Font: reuse `--font-geist-mono`, don't add JetBrains Mono
`app/layout.tsx` already loads `Geist_Mono` as `--font-geist-mono` (currently unused by any rendered UI). The mockup's literal spec calls for JetBrains Mono for `TelemetryMarquee`; this design substitutes the already-loaded geist mono family instead — visually equivalent (a monospace grotesque), zero new dependency, zero new font-loading cost. If product specifically wants JetBrains Mono's exact glyphs, that's a one-line follow-up (`next/font/google` already proven in this file for the other three families) — not worth blocking this change on.

### 12. Flight route/ETA data: proxy tar1090's own route-lookup endpoint through the nginx sidecar, mirroring `receiver.json`

**This decision replaces the original design's Open Question 1 (which assumed no route data was available and defaulted to a permanent "no route data" empty state, or floated an external `adsbdb.com` API call as an alternative).** Confirmed: this feeder already runs tar1090 (the `docker-tar1090`/ultrafeeder stack this codebase already integrates with — see `components/map/feederLocation.ts`'s `receiver.json` precedent), and tar1090's own UI already surfaces route data for aircraft it recognizes. That means route data is already present somewhere in the feeder stack this app talks to — **no new third-party service (e.g. `adsbdb.com`) is needed or used.**

- tar1090 most likely serves this as a static, per-callsign-prefix route database bundled with its own install (commonly under a `db/routes/`-style path in tar1090's served files), not a live network call to an external site — but the **exact endpoint path and response shape are unverified from this repo** (no access to the running feeder box from here). This design intentionally does **not** hardcode a guessed path.
- `feederLocation.ts` already establishes the exact pattern to follow: it does not fetch `receiver.json` directly cross-origin from the ultrafeeder container; it goes through `/data/receiver.json`, proxied server-side by this app's own nginx sidecar (`scripts/squawkmap3d.nginx.conf`), because ultrafeeder's own CORS patching (`docker-tar1090`'s `07-nginx-configure`) only covers `aircraft.json`'s location block, not `receiver.json` — and (per the already-implemented `outline.json` precedent in the same file) not `outline.json` either. Route data should get the identical treatment: once the real endpoint path is confirmed (see tasks.md's blocking discovery task), add a `location = /data/<confirmed-route-path>` block to `scripts/squawkmap3d.nginx.conf` proxying to `http://host.docker.internal:8080/<same-path>`, and a typed fetch helper (e.g. `components/map/flightRoute.ts`'s `getFlightRoute(callsign: string): Promise<FlightRoute | null>`) mirroring `getFeederLocation()`'s exact contract: **always resolves, never rejects** — no route endpoint configured, a network failure, a malformed response, or "tar1090 has no route for this callsign" (e.g. general aviation with no filed route) all resolve to `null`.
- `FlightInfoPane` renders real origin/destination/timeline fields when `getFlightRoute` resolves a route, and the existing "no route data available" empty state when it resolves `null`. **The empty state is now a legitimate per-aircraft fallback (some callsigns won't have a route tar1090 recognizes), not the default-for-everything behavior the original design shipped.**
- If tar1090's route response doesn't include a real departure timestamp, `FlightInfoPane` should substitute "first seen this session" (from the track buffer's oldest retained point) worded honestly as session-local rather than presented as the real departure time — same honesty discipline the original Open Question 1's option (a) already called for. A computed ETA (great-circle distance from current position to the route's destination airport, resolved against the already-bundled `/data/airports.geojson` via `@turf/turf`, divided by current ground speed) remains a reasonable derived value once a destination is known, worded as "estimated," not authoritative.

### 13. Follow-selected-aircraft camera model: aircraft pinned on screen, the map recenters underneath it

**This decision replaces the original design's Open Question 3.** Confirmed interaction model — close to, but more precise than, this document's original framing:

- **On selection (click):** the camera immediately moves/animates so the newly-selected aircraft is centered in view. Concretely, `handleAircraftClick` (Decision 2/3), when it results in a new selection (not a deselect) and follow is enabled, `easeTo`s the map to the just-clicked aircraft's current position (available directly from the deck.gl pick's `info.object`) right away — it does not wait for the next ~1s poll to first recenter.
- **While locked (follow enabled + an aircraft selected):** on every subsequent aircraft-feed poll, the map recenters to the aircraft's newly reported position (`refreshAircraft()`, mirroring the original per-poll `easeTo` call). The correct mental model for implementers is **"the aircraft is pinned at a fixed on-screen position (map center) and the map viewport pans underneath/around it"** — not "the map stays fixed and the aircraft icon moves across it." This matters structurally: the camera-update call recenters the *viewport* to the aircraft's latest lat/lon each poll; it is not a transform applied to the icon relative to a static camera.
- **The toggle and the click-to-lock behavior are the same mechanism, not two separate features.** The acceptance criteria's "toggleable map control to center view on aircraft (on by default)" *is* this follow toggle: when on (the default), making a new selection auto-engages the pin-and-follow camera behavior described above. When off, selecting an aircraft still highlights it (glow) and opens the drawer — it just does not move the camera. Toggling follow off while an aircraft is already locked stops further recentering without deselecting; toggling it back on does not itself recenter until the next poll (no explicit "jump now" side effect from the toggle alone, to avoid a surprise camera snap on a control most users will leave alone).
- **The lock is broken by exactly one thing:** the existing deselect-on-click-elsewhere path (identical to `aircraft-tracks-layer`'s selection requirement — clicking empty map area, clicking the selected aircraft again, or Escape). **Manual map panning/dragging while locked does not break the lock** — confirmed as accepted v1 behavior (see Non-Goals), not merely deferred pending confirmation. The map will snap back to the aircraft's position on the very next poll if the user drags away while locked; the toggle is the intended escape hatch for a user who wants to look around without fighting the recenter.

## Risks / Trade-offs

- **[Risk]** `taildragger`'s own `rareness` field reflects that game's own design/balance choices, not real-world ADS-B sighting frequency for this feeder's specific geographic location — a type "rare" in `taildragger`'s global scoring could be locally common near this feeder (or vice versa), and the unmatched-type default (`15`) landing in the `legendary` bucket (Decision 5) is a direct, non-adjusted consequence of the computed quantile cutpoints. → **Mitigation**: acceptable for v1 as a reasonable global proxy for "how unusual is this type of aircraft," clearly documented as sourced from a specific external dataset (not a bespoke or authoritative rarity model) in code comments on `aircraftRarity.ts`; the five-tier output and color mapping remain stable, so refining the source data or cutpoints later doesn't touch any consumer's props shape.
- **[Risk]** `registration`/`manufacturerModel`/`operator`/`year` are only populated when the feeder loads tar1090-db — most feeders may not have this, leaving `PlaneCard`/`RecordPanelHero` showing mostly blanks → **Mitigation**: every one of these fields renders an explicit "Unknown"/em-dash placeholder rather than blank space or `undefined`/`"null"` leaking into markup (same discipline `airportPopup.ts` already established for missing airport codes).
- **[Risk]** deck.gl-inside-MapLibre click bubbling (Decision 3) is a known rough edge, not a first-class supported pattern → **Mitigation**: the guard-timestamp approach is intentionally simple (single ref, single comparison) and covered by a manual verification task (tasks.md) clicking an aircraft directly followed by clicking empty map area, to catch any double-fire/never-fire regression before merge.
- **[Risk]** "Follow selected aircraft" recentering every ~1s poll while a user is trying to manually pan/zoom around a followed aircraft could feel like the map is fighting the user (confirmed as accepted v1 behavior, not a gap — see Decision 13/Non-Goals) → **Mitigation**: the toggle is right there to turn off; if this proves genuinely annoying in practice, pause-on-manual-interaction is a scoped follow-up, not a blocker for this change's acceptance criteria as written.
- **[Risk]** tar1090's actual route-lookup endpoint path/response shape (Decision 12) is unverified from this repo — the blocking discovery task (tasks.md) could find that the running feeder's tar1090 version has no such endpoint, or a shape too sparse/different to populate `FlightInfoPane`'s fields meaningfully → **Mitigation**: the discovery task blocks only `FlightInfoPane`'s route-dependent tasks, not the rest of this change; if no usable endpoint is found, `FlightInfoPane` falls back to the same explicit "no route data available" empty state the original design already specified — a graceful degrade, not a blocker for shipping the rest of the overlay.

## Migration Plan

No data migration. This is additive: new optional `Aircraft`/`TrackPoint` fields (existing consumers unaffected by new optional properties), a new deck.gl layer and a new component subtree, one behavior change to an existing layer (`pickable: false` → `true`, which only enables picking — no visual change when nothing is selected), a new committed static data snapshot (`components/map/data/aircraftRareness.json`), and — once the discovery task (tasks.md) resolves the real endpoint — a new nginx proxy location block mirroring `receiver.json`'s/`outline.json`'s. Both new data dependencies fail safe: `computeRarityTier` always resolves to a value (falling back to the fixed default of `15`/`legendary` when no vendored-snapshot match exists) and `getFlightRoute` always resolves (never rejects), defaulting to `null`/the empty state. Rollback is a straight revert; no persisted state to clean up (selection and follow-state are in-memory only).

## Open Questions

All three of this document's original open questions have been resolved as of this amendment:

1. ~~Flight route / ETA / departed-landed timestamps~~ — **Resolved.** See Decision 12: proxy tar1090's own route database through the nginx sidecar (mirroring `receiver.json`), rather than integrating a third-party API or shipping a permanent empty state. The exact endpoint path is still unverified from this repo and is covered by an explicit blocking discovery task in tasks.md (scoped to `FlightInfoPane`'s route tasks only).
2. ~~Rarity heuristic needs product review~~ — **Resolved.** See Decision 5: rarity is now sourced from a real, vendored per-type dataset (`taildragger`'s `rareness` field) with data-derived quantile tier cutpoints, not an invented signal table. This is a resolved, data-backed decision, not a placeholder pending sign-off — the residual risk (the dataset reflects a different game's design choices, not this feeder's actual sighting frequency) is documented in Risks above, not treated as a blocker.
3. ~~Follow-toggle interaction with manual panning~~ — **Resolved/confirmed.** See Decision 13 and Non-Goals: snapping back to the selected aircraft on every poll while locked is accepted v1 behavior; the lock is broken only by the existing deselect action (click elsewhere, re-click, Escape), never by manual panning/dragging. Pause-on-drag remains a possible follow-up, not part of this change's scope.

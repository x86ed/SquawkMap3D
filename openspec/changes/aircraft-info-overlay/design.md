## Context

Aircraft are rendered as a deck.gl `IconLayer` + `PathLayer` (`components/map/aircraftLayer.ts`) inside a `MapboxOverlay` (`deckOverlayRef` in `MapView.tsx`), refreshed on a ~1Hz poll of the feeder's `aircraft.json` (`fetchAircraft()` in `aircraft.ts`). The `IconLayer` is currently `pickable: false` — there is no selection concept anywhere in the codebase today.

The only prior "click a map feature, see details" precedent is `airport-details-popup` (archived 2026-08-23): a MapLibre `symbol` layer with `map.on("click", LAYER_ID, ...)` opening a `maplibregl.Popup`. That pattern does **not** transfer directly here:
1. The aircraft layer is a deck.gl layer inside a `MapboxOverlay`, not a MapLibre style layer — there is no `map.on("click", AIRCRAFT_ICON_LAYER_ID)` to hook; deck.gl layers get picking via their own `onClick` prop (or a top-level `onClick` on the `MapboxOverlay`/`Deck` instance).
2. A `maplibregl.Popup` is anchored to a fixed `LngLat` at open time and does not track a moving feature. Aircraft move every poll; a popup would visibly detach from the icon within seconds. This change therefore uses a persistent, non-anchored **bottom drawer** (as specified in the feature request) rather than a popup.

`aircraft.json`'s documented field set (readsb's own reference, already partially adopted in this codebase — see `aircraft.ts`'s file-level comment) includes several fields this codebase does not yet map: `r` (registration), `desc` (manufacturer/model description string), `ownOp` (operator name), `year`, `seen` (seconds since the last message from that aircraft). Like `t` (type designator), every one of these is populated **only** when the feeder loads a tar1090-db `aircraft.csv.gz` — they are omitted entirely otherwise, so they must stay optional/`undefined`-safe exactly like the existing `t` field.

There is **no rarity/tier concept anywhere in this codebase** (confirmed via `grep -ril rarity`/`tier` across the repo, excluding this change, before writing this design). The feature request's mockup assumes an adsb.win-style rarity system exists to "reuse or align with" — it does not. This design introduces one from scratch, scoped to what's computable from data this app already has.

## Goals / Non-Goals

**Goals:**
- Clicking an aircraft selects it; selection drives a map glow highlight and a bottom-drawer overlay, both colored/labeled by a computed rarity tier.
- A toggleable, default-on "follow" control keeps the map centered on the selected aircraft as it moves.
- The drawer is composed of four independently-defined components (`PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane`), each fed a shared, real (not fabricated) view-model derived from this app's actual `Aircraft`/track-buffer/feeder-site data.
- Every field the drawer displays either comes from real feeder data, is computed client-side from real feeder data (distance, sparkline, rarity), or is an explicit, honest "no data" state — never a mocked/placeholder value presented as real.

**Non-Goals:**
- Reproducing adsb.win's actual (undisclosed, likely frequency-database-backed) rarity algorithm. This change's tier heuristic is provisional and explicitly flagged for product review (Open Questions).
- Sourcing real flight-route (origin/destination) or ETA/departed/landed data. Not available from `aircraft.json`; deferred (Open Questions).
- Persisting selection across page reloads, or supporting multi-aircraft selection.
- Pausing "follow" on manual user pan/drag (follow simply recenters every poll while on; a user who drags the map while following is on will see it snap back on the next ~1s poll). This can be revisited in a follow-up if it proves annoying in practice — not part of the acceptance criteria as written.
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

### 5. Rarity tiers: new, explicit, provisional heuristic (`aircraftRarity.ts`)
Since no rarity system exists to reuse, this introduces the minimum viable, fully-explainable heuristic needed to satisfy the acceptance criteria (5 tiers, each with an accent color), computed only from fields already on `Aircraft`:

| Signal (checked in order, first match wins) | Tier |
|---|---|
| `squawk` is `"7500"`, `"7600"`, or `"7700"` (hijack/comm-failure/emergency) | `legendary` |
| `category` is one of `"A6"` (high performance), `"B1"` (glider/sailplane), `"B2"` (lighter-than-air), `"B3"` (parachutist/skydiver), `"B4"` (ultralight/hang-glider/paraglider), `"B6"` (UAV), or `"B7"` (space/transatmospheric) — the DO-260B categories `AIRCRAFT_CATEGORY_FALLBACK_ICON` (`constants.ts`) already documents as genuinely uncommon traffic, excluding ordinary rotorcraft (`A7`) and surface vehicles (`C1`/`C2`), which are common enough not to warrant an elevated tier | `epic` |
| `typeDesignator` is set but has **no** vendored icon shape (`resolveIconKey(aircraft).source !== "type"` while `typeDesignator` is non-empty — i.e. a known-but-unshaped type, a weak "uncommon type" signal) | `rare` |
| `typeDesignator` is set and **has** a vendored shape (`resolveIconKey(aircraft).source === "type"`) | `uncommon` |
| everything else (no usable type/category signal at all) | `common` |

Tier → color: `common` = slate `#64748b`, `uncommon` = green `#22c55e`, `rare` = cyan `#06b6d4`, `epic` = violet `#8b5cf6`, `legendary` = yellow `#eab308` (matching the acceptance criteria's named palette). **This table is a placeholder heuristic, not a researched rarity model** — see Open Questions.

### 6. New `Aircraft` fields: extend the existing optional-field pattern, don't fork the type
`registration` (from `r`), `manufacturerModel` (from `desc`), `operator` (from `ownOp`), `year` (from `year`), `secondsSinceLastMessage` (from `seen`) are added directly to `Aircraft`/`RawAircraftJson`/`normalize()`, all optional, all `undefined` when the raw field is absent — identical treatment to the existing `typeDesignator`/`t` handling, not a separate "extended aircraft" type. This keeps every consumer of `Aircraft` (icon resolution, track buffer, rarity) working against one shape.

### 7. Telemetry history: extend `TrackPoint`, don't add a parallel buffer
`TrackPoint` gains an optional `groundSpeed?: number`, populated in `updateTracks()` whenever the source `Aircraft` has one (independent of whether `lat`/`lon`/`altitude` gate recording a point at all — unchanged). `FlightInfoPane`'s sparkline reads `getTrack(hex)` (already exported) and plots `altitude`/`groundSpeed` per point. This reuses the exact retention/pruning/session-local semantics `aircraft-tracks-layer` already established (`AIRCRAFT_TRACK_RETENTION_MS`), rather than inventing a second buffer with its own lifecycle.

### 8. Distance (`DIST` in `TelemetryMarquee`): `turf.distance` from the resolved site, matching `radarSweep.ts` precedent
`radarSweep.ts` already computes `turf.bearing(siteCoord, [a.lon, a.lat])` from the feeder's surveyed site. `DIST` reuses the same site resolution (`getFeederLocation()`, falling back to `resolveUserLocation()`'s already-established chain in `MapView.tsx`) and adds `turf.distance(site, [aircraft.lon, aircraft.lat], { units: "nauticalmiles" })` — no new dependency, consistent units convention to introduce (nautical miles, matching aviation/ADS-B norms and this app's altitude-in-feet convention).

### 9. Component boundaries and props: one shared view-model, four dumb components
A single selector, `buildSelectedAircraftInfo(aircraft, track, site, rarityTier): SelectedAircraftInfo` (new, in `components/map/overlay/selectedAircraftInfo.ts`), assembles everything the four components need from an `Aircraft` + its track + the resolved site + its rarity tier, computed once per poll in `MapView.tsx` and passed down. `PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane` each take a slice of this view-model as props and render independently — no component reaches back into `MapView` state or re-fetches anything itself, keeping each trivially testable in isolation (per the acceptance criteria's explicit "create separate components" requirement) and keeping `AircraftOverlay` a pure layout/open-close/keyboard shell around the four.

### 10. Styling: CSS Modules, matching the existing (only) convention in this codebase
No Tailwind, styled-components, or other CSS-in-JS dependency exists in `package.json` — the one existing UI surface (`MapView.tsx`) uses a plain `.module.css` file. Every new overlay component gets a co-located `ComponentName.module.css` in the new `components/map/overlay/` directory, following that convention exactly rather than introducing the mockup's literal Tailwind-esque utility classes or CSS-custom-property token file. Rarity tier colors are still exposed as a small set of CSS custom properties (e.g. `--tier-color`) set inline per the selected aircraft's computed tier, so `PlaneCard`'s corner tag / accent border can reference `var(--tier-color)` without five hardcoded tier-color branches duplicated across component CSS.

### 11. Font: reuse `--font-geist-mono`, don't add JetBrains Mono
`app/layout.tsx` already loads `Geist_Mono` as `--font-geist-mono` (currently unused by any rendered UI). The mockup's literal spec calls for JetBrains Mono for `TelemetryMarquee`; this design substitutes the already-loaded geist mono family instead — visually equivalent (a monospace grotesque), zero new dependency, zero new font-loading cost. If product specifically wants JetBrains Mono's exact glyphs, that's a one-line follow-up (`next/font/google` already proven in this file for the other three families) — not worth blocking this change on.

## Risks / Trade-offs

- **[Risk]** The rarity heuristic (Decision 5) is arbitrary relative to any real "how rare is this aircraft" notion (e.g., a Cessna 172 with an unrecognized/unvendored type designator would rank "rare," while a common but well-vendored military transport ranks "uncommon") → **Mitigation**: documented plainly as provisional in this design and in code comments on `aircraftRarity.ts`; flagged as an Open Question for product sign-off before/soon-after this ships; five-tier output and color mapping are stable so a later swap to a better algorithm doesn't touch any consumer's props shape.
- **[Risk]** `registration`/`manufacturerModel`/`operator`/`year` are only populated when the feeder loads tar1090-db — most feeders may not have this, leaving `PlaneCard`/`RecordPanelHero` showing mostly blanks → **Mitigation**: every one of these fields renders an explicit "Unknown"/em-dash placeholder rather than blank space or `undefined`/`"null"` leaking into markup (same discipline `airportPopup.ts` already established for missing airport codes).
- **[Risk]** deck.gl-inside-MapLibre click bubbling (Decision 3) is a known rough edge, not a first-class supported pattern → **Mitigation**: the guard-timestamp approach is intentionally simple (single ref, single comparison) and covered by a manual verification task (tasks.md) clicking an aircraft directly followed by clicking empty map area, to catch any double-fire/never-fire regression before merge.
- **[Risk]** "Follow selected aircraft" recentering every ~1s poll while a user is trying to manually pan/zoom around a followed aircraft could feel like the map is fighting the user (explicitly accepted as a Non-Goal to fix here) → **Mitigation**: the toggle is right there to turn off; if this proves genuinely annoying in practice, pause-on-manual-interaction is a scoped follow-up, not a blocker for this change's acceptance criteria as written.

## Migration Plan

No data migration. This is additive: new optional `Aircraft`/`TrackPoint` fields (existing consumers unaffected by new optional properties), a new deck.gl layer and a new component subtree, one behavior change to an existing layer (`pickable: false` → `true`, which only enables picking — no visual change when nothing is selected). Rollback is a straight revert; no persisted state to clean up (selection and follow-state are in-memory only).

## Open Questions

1. **Flight route / ETA / departed-landed timestamps (flagged per the feature request's own acceptance criteria).** `aircraft.json` has no flight-plan data — a receive-only ADS-B feeder cannot know a flight's origin, destination, or scheduled/actual times. Two paths forward, **neither implemented in this change**:
   - **(a)** Integrate a free, keyless, third-party callsign→route lookup (e.g. `adsbdb.com`'s public `/api/v0/callsign/<callsign>` endpoint) at drawer-open time, architecturally identical to the existing Wikipedia-thumbnail-at-click pattern in `airportPopup.ts` (fetch on open, cache in-memory, graceful "not found" fallback) — then derive a *computed* (not authoritative) ETA from great-circle distance to the resolved destination airport's coordinates (already-bundled `/data/airports.geojson`, via `@turf/turf`, already a dependency) divided by current ground speed, and substitute "first seen this session" (from the track buffer's oldest point) for "departed," worded honestly as session-local rather than the real departure time.
   - **(b)** Ship `FlightInfoPane`'s route/timeline section as a permanent, explicit "no route data" empty state, and leave real route sourcing to a dedicated follow-up change once product decides whether a third-party dependency for this is acceptable (new external service, new failure mode, potentially stale/wrong route data for a given callsign).
   - **This design's default for the current change is (b)** — recommended because it introduces zero new external dependencies/failure modes into an already-large change, but **needs explicit product sign-off before tasks.md's `FlightInfoPane` tasks are implemented**, since it directly affects `FlightInfoPane`'s acceptance criteria (route progress bar, Timeline band) as described in the mockup.
2. **Rarity heuristic (Decision 5) needs product review.** Is the ordering/tier assignment in the table acceptable as a v1, or should specific signals (e.g. emergency squawks always `legendary`) be reconsidered? This does not block implementation — the heuristic is fully specified and testable as written — but should be revisited before this is treated as a "real" rarity feature rather than a placeholder.
3. **Follow-toggle interaction with manual panning** (see Non-Goals) — confirm the "just snaps back every poll" behavior is acceptable for v1, or whether pause-on-drag should be pulled into this change's scope instead of deferred.

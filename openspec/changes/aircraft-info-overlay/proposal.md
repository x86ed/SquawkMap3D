## Why

Clicking an aircraft on the map currently does nothing — `AIRCRAFT_ICON_LAYER_ID`'s deck.gl `IconLayer` is `pickable: false`, and there is no selection state, no way to identify a specific aircraft's registration/type/operator, and no way to keep the map centered on one aircraft while it moves. The airports layer already proved the "click a map feature, see a details surface" pattern (`airport-details-popup`); aircraft need the equivalent, but richer — identity, live telemetry, and flight-progress context — surfaced as a persistent bottom drawer rather than a transient popup, since aircraft move and a popup anchored to a moving point is awkward to read.

## What Changes

- Add click-to-select on the aircraft icon layer: clicking an aircraft's icon selects it (deselecting any previously-selected aircraft); clicking empty map area, clicking the selected aircraft again, or pressing Escape deselects it.
- Add a first-of-its-kind rarity-tier system for this codebase (`components/map/aircraftRarity.ts`) — no existing rarity/tier logic was found to reuse (confirmed: no `rarity`/`tier` grep hits anywhere outside this change). Computes one of `common`/`uncommon`/`rare`/`epic`/`legendary` from fields already present on `Aircraft` (ADS-B category, whether the type designator has a known vendored icon, and emergency squawks 7500/7600/7700), each tier mapped to an accent color (slate/green/cyan/violet/yellow, matching the acceptance criteria's adsb.win-style palette). Flagged in design.md as a provisional heuristic needing product sign-off — it is not a port of adsb.win's own (undisclosed) algorithm.
- Render a glow highlight around the selected aircraft's icon, colored by its computed rarity tier, on the existing aircraft deck.gl overlay; the glow tracks the aircraft's live position and clears on deselect or when the aircraft drops out of the feed.
- Add a "Follow selected aircraft" toggle control (default **on**, alongside the existing layer-toggle buttons) that, while enabled and an aircraft is selected, recenters the map on that aircraft's position on every aircraft-feed refresh.
- Extend `Aircraft`/`normalize()` in `components/map/aircraft.ts` to also map readsb's `r` (registration), `desc` (manufacturer/model description string), `ownOp` (operator name), `year`, and `seen` (seconds since last message) fields — same optional/`undefined`-when-omitted treatment already established for `t` (only populated when the feeder loads a tar1090-db `aircraft.csv.gz`).
- Extend the session-local track buffer (`TrackPoint` in `aircraft.ts`) to also retain `groundSpeed` per point, so a selected aircraft's recent altitude/speed history is available for a sparkline without a new parallel data structure.
- Add a full-width bottom drawer (`AircraftOverlay`, new `components/map/overlay/` directory) that opens when an aircraft is selected and closes on deselect, built from **four separate components** (own file each, each independently testable/reusable):
  - `PlaneCard`: identity card (registration, manufacturer/model, operator, rarity tier badge/accent).
  - `RecordPanelHero`: registration/callsign/ICAO hex + manufacturer/model/operator/age spec grid, with portrait/landscape reflow driven by the panel's own measured aspect ratio (`ResizeObserver`), not viewport size.
  - `TelemetryMarquee`: scrolling monospace ticker of live telemetry (altitude, ground speed, heading, vertical rate with trend, squawk, distance from the feeder/user site, seconds since last message), pausing on hover/focus.
  - `FlightInfoPane`: dual sparkline (altitude + ground speed, independently normalized) built from the extended track buffer, covering only this change's real, in-scope data.
- **Explicit non-goal / flagged gap (see design.md Open Questions)**: flight route (origin/destination) and ETA/departed/landed timestamps are **not available from readsb's `aircraft.json`** (a receive-only feeder has no flight-plan data) and are not sourced by this change. `FlightInfoPane`'s route/progress-bar and Timeline elements ship with an explicit "no route data" empty state rather than fabricated values; wiring a real route source (e.g. a third-party callsign→route API) is deferred to a follow-up change pending a product decision.

## Capabilities

### New Capabilities
- `aircraft-rarity`: computes a rarity tier + accent color for an aircraft from currently-available ADS-B fields; consumed by both the map glow highlight and the drawer's `PlaneCard`/`RecordPanelHero`.
- `aircraft-info-overlay`: the bottom-drawer UX (open/close/Escape/scrim/responsive stacking) and its four constituent components (`PlaneCard`, `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane`).

### Modified Capabilities
- `aircraft-tracks-layer`: aircraft icons become clickable/selectable (`pickable: true`), the selected aircraft renders a rarity-colored glow highlight, and a "Follow selected aircraft" toggle control is added.

## Impact

- `components/map/aircraft.ts`: extend `Aircraft`/`RawAircraftJson`/`normalize()` with `registration`, `manufacturerModel`, `operator`, `year`, `secondsSinceLastMessage`; extend `TrackPoint`/`updateTracks()` with `groundSpeed`.
- `components/map/aircraftLayer.ts`: `pickable: true` + `onClick` on the `IconLayer`; new glow-highlight layer (likely a `ScatterplotLayer`, mirroring `radarSweep.ts`'s existing use of that layer type) keyed off selected-aircraft state passed into `buildAircraftLayers`.
- New `components/map/aircraftRarity.ts`: pure `computeRarityTier(aircraft: Aircraft): RarityTier` + `RARITY_TIER_COLORS` map.
- `components/map/MapView.tsx`: selection state (`selectedAircraftHex`/ref), `onClick` wiring on the aircraft `IconLayer`, map-click/Escape-key deselect handling, "Follow selected aircraft" toggle state + `easeTo` recentering on each aircraft-feed poll, mounting `AircraftOverlay` with the selected aircraft's derived view-model.
- New `components/map/overlay/` directory: `AircraftOverlay.tsx` (+ `.module.css`), `PlaneCard.tsx`, `RecordPanelHero.tsx`, `TelemetryMarquee.tsx`, `FlightInfoPane.tsx` (each + its own `.module.css`, following the existing `MapView.module.css` CSS-Modules convention — this repo has no Tailwind/CSS-in-JS dependency).
- `components/map/constants.ts`: any new tunable constants (glow radius/opacity, marquee scroll speed, follow-toggle default).
- No new npm dependencies: distance-from-site (`DIST`) reuses the already-installed `@turf/turf` (precedent: `radarSweep.ts`'s `turf.bearing`/`turf.distance` usage); the marquee's monospace font reuses the already-loaded `--font-geist-mono` (no new font dependency, unlike the mockup's literal JetBrains Mono).

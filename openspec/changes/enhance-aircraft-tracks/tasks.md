## 1. Constants

- [ ] 1.1 In `components/map/constants.ts`, add a new comment block near the existing `AIRCRAFT_TRACK_*`/glow constants introducing:
  - `AIRCRAFT_TRACK_FADE_MIN_ALPHA` (suggest `60`) — alpha floor for the oldest visible track segment; the most-recent segment always renders at `255` regardless of this value (design.md Decision 1)
  - `AIRCRAFT_TRACK_MARKER_INTERVAL_MS` (suggest `15_000`) — minimum wall-clock spacing between decimated "track marker" points used for the new droplines/curtain (design.md Decision 2)
  - `AIRCRAFT_TRACK_DROPLINE_DOT_COUNT` (suggest `5`), `AIRCRAFT_TRACK_DROPLINE_DOT_RADIUS_PIXELS` (suggest `2`), `AIRCRAFT_TRACK_DROPLINE_ALPHA` (suggest `90`), `AIRCRAFT_TRACK_DROPLINE_COLOR` (suggest `[200, 200, 200]`, a fixed neutral grey — not color-mode-driven, design.md Decision 4)
  - `AIRCRAFT_TRACK_CURTAIN_BAND_COUNT` (suggest `6`), `AIRCRAFT_TRACK_CURTAIN_TOP_ALPHA` (suggest `70`), `AIRCRAFT_TRACK_CURTAIN_WIDTH_PIXELS` (suggest `2`) (design.md Decision 3)

## 2. Track marker decimation helper

- [ ] 2.1 In `components/map/aircraftLayer.ts`, add `selectTrackMarkers(points: TrackPoint[]): TrackPoint[]` — walks `points` (oldest first, as returned by `getAllTracks()`) keeping one point at least `AIRCRAFT_TRACK_MARKER_INTERVAL_MS` after the previously-kept point's `timestamp`, and always appends the final point of the array even if it falls short of a full interval since the last kept marker (design.md Decision 2)
- [ ] 2.2 Add a unit test in `test/` (new or existing aircraft-layer test file) covering: an empty array returns `[]`; a single point returns that point; points spaced closer than the interval are decimated down to roughly one per interval; the last point is always included even when it arrives less than a full interval after the previous kept marker

## 3. Age-based track segment fade

- [ ] 3.1 In `components/map/aircraftLayer.ts`, add `alpha: number` to the `TrackSegment` interface
- [ ] 3.2 In the existing `for (const [hex, points] of tracks)` segment-building loop, compute each segment's `alpha`: `ageFraction = clamp((now - b.timestamp) / AIRCRAFT_TRACK_RETENTION_MS, 0, 1)`, `alpha = lerp(255, AIRCRAFT_TRACK_FADE_MIN_ALPHA, ageFraction)`, **except** when `i === points.length - 1` (the segment ending at the track's current/most-recent point), which is always `alpha = 255` (design.md Decision 1). Import `AIRCRAFT_TRACK_RETENTION_MS` and the new `AIRCRAFT_TRACK_FADE_MIN_ALPHA` from `constants.ts`; capture `now = Date.now()` once per `buildAircraftLayers()` call, not per segment
- [ ] 3.3 Update `trackLayer.getColor` from `(d) => d.color` to `(d) => [...d.color, d.alpha]`
- [ ] 3.4 Update `trackGlowLayer.getColor` so the glow's alpha scales with the same segment's fade: `(d) => { const [r,g,b] = brightenColor(d.color, AIRCRAFT_GLOW_BRIGHTEN_AMOUNT); return [r, g, b, Math.round(AIRCRAFT_TRACK_GLOW_ALPHA * (d.alpha / 255))]; }`

## 4. Ground curtain layer

- [ ] 4.1 In `components/map/aircraftLayer.ts`, define a `CurtainBand` interface (`path: [[number, number, number], [number, number, number]]`, `color: [number, number, number, number]`)
- [ ] 4.2 Add curtain-band generation to the existing per-track loop (reusing `aircraftByHex`/`typeDesignator` lookup already built for track color resolution): for each track, `markers = selectTrackMarkers(points)`; for each consecutive marker pair `(a, b)`, for `i` from `0` to `AIRCRAFT_TRACK_CURTAIN_BAND_COUNT - 1`, compute `f = i / (AIRCRAFT_TRACK_CURTAIN_BAND_COUNT - 1)`, push a `CurtainBand` with `path` at `[a.lon, a.lat, altitudeToRenderMeters(a.altitude) * f]` → `[b.lon, b.lat, altitudeToRenderMeters(b.altitude) * f]` and `color = [...resolveTrackPointColor(b, colorMode, typeDesignator), lerp(AIRCRAFT_TRACK_CURTAIN_TOP_ALPHA, 0, f)]`
- [ ] 4.3 Add `export const AIRCRAFT_TRACK_CURTAIN_LAYER_ID = "aircraft-track-curtain";` alongside the other exported layer-id constants
- [ ] 4.4 Build a new `PathLayer<CurtainBand>` (`curtainLayer`) from the flat array of all tracks' curtain bands: `getPath: (d) => d.path`, `getColor: (d) => d.color`, `getWidth: AIRCRAFT_TRACK_CURTAIN_WIDTH_PIXELS`, `widthUnits: "pixels"`, `pickable: false`

## 5. Dotted ground droplines layer

- [ ] 5.1 Import `ScatterplotLayer` from `@deck.gl/layers` in `aircraftLayer.ts`
- [ ] 5.2 Add a `DroplineDot` interface (`position: [number, number, number]`)
- [ ] 5.3 Add dropline-dot generation to the same per-track loop: for each marker in `markers` (from task 4.2's `selectTrackMarkers` call, reused rather than recomputed), generate `AIRCRAFT_TRACK_DROPLINE_DOT_COUNT` evenly-spaced `DroplineDot`s between `altitudeToRenderMeters(marker.altitude)` and `0` at `[marker.lon, marker.lat, height]`
- [ ] 5.4 Add `export const AIRCRAFT_TRACK_DROPLINE_LAYER_ID = "aircraft-track-dropline";` alongside the other exported layer-id constants
- [ ] 5.5 Build a new `ScatterplotLayer<DroplineDot>` (`droplineLayer`) from the flat array of all tracks' dropline dots: `getPosition: (d) => d.position`, `getFillColor: [...AIRCRAFT_TRACK_DROPLINE_COLOR, AIRCRAFT_TRACK_DROPLINE_ALPHA]`, `getRadius: AIRCRAFT_TRACK_DROPLINE_DOT_RADIUS_PIXELS`, `radiusUnits: "pixels"`, `pickable: false`

## 6. Wire tracksVisible through buildAircraftLayers

- [ ] 6.1 Add `tracksVisible: boolean` to `buildAircraftLayers()`'s params
- [ ] 6.2 When `tracksVisible` is `false`, skip building `trackLayer`, `trackGlowLayer`, `curtainLayer`, and `droplineLayer` entirely (skip the segment/band/dot-building loops too, not just omit the layers from the return array, to avoid the wasted work every poll)
- [ ] 6.3 Update the returned layer array/paint-order comment: `[iconGlowLayer, curtainLayer, trackGlowLayer, droplineLayer, trackLayer, rotorLayer, iconLayer]` (curtain and droplines painted beneath the crisp track line and glow, consistent with "ground reference" elements sitting furthest back; exact relative order between `trackGlowLayer`/`curtainLayer`/`droplineLayer` left to visual tuning during implementation if it reads better swapped)

## 7. MapView toggle

- [ ] 7.1 In `components/map/MapView.tsx`, add `tracksVisibleRef = useRef(true)` and `const [tracksVisible, setTracksVisible] = useState(true)`, matching the existing `aircraftVisibleRef`/`aircraftVisible` pattern
- [ ] 7.2 Add `handleTracksToggle` — flips both the ref and state, does **not** call `clearTracks()` or touch polling (design.md Decision 5), then calls `void refreshAircraft()` so the change is visible immediately rather than waiting for the next scheduled poll
- [ ] 7.3 Pass `tracksVisible: tracksVisibleRef.current` into every `buildAircraftLayers()` call site (`refreshAircraft`)
- [ ] 7.4 Add a new `<LayerToggleRow name="Aircraft tracks" checked={tracksVisible} onToggle={handleTracksToggle} />` in the drawer's layer list, next to the existing `<LayerToggleRow name="Aircraft" .../>` row (exact ordering/indentation per design.md's Open Questions — match whatever reads clearest against `Accordion.tsx`'s existing rows)

## 8. Verification

- [ ] 8.1 Manually verify each rendered track's most recent segment (connecting the aircraft's current position to its immediately prior one) always renders fully solid/opaque, in each of the three color modes
- [ ] 8.2 Manually verify older track segments visibly fade toward `AIRCRAFT_TRACK_FADE_MIN_ALPHA` as they approach the 10-minute retention cutoff, and that the track glow fades in lockstep rather than staying constant brightness under a fading line
- [ ] 8.3 Manually verify a dotted vertical line renders from a decimated subset of each track's points down to the ground, always including the aircraft's current position, in a fixed neutral color independent of the active color mode
- [ ] 8.4 Manually verify a gradient curtain renders beneath the trail, fading from the trail's own color near the top to fully transparent near the ground, and that its color updates when the active color mode changes
- [ ] 8.5 Manually verify the "Aircraft tracks" toggle hides/shows the trail (line, glow, droplines, curtain) independently of the "Aircraft" (icon) toggle — aircraft icons remain visible and continue updating while tracks are hidden, and re-enabling tracks shows the full uninterrupted trail rather than restarting empty
- [ ] 8.6 Spot-check a dense-traffic view and tune `AIRCRAFT_TRACK_FADE_MIN_ALPHA` / `AIRCRAFT_TRACK_MARKER_INTERVAL_MS` / dropline dot count/alpha / curtain band count/top-alpha if the new elements visually blur together into an illegible haze (design.md Open Questions)
- [ ] 8.7 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

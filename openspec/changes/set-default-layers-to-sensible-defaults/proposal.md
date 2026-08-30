## Why

On a fresh page load, `MapView.tsx` currently defaults every single toggleable
layer to visible: `militaryVisible`, `airportsVisible`, `openAipVisible`,
`rainViewerVisible`, `tfrVisible`, `suaVisible`, `airspaceBoundariesVisible`,
`rangeOutlineVisible`, `terrainOutlineVisible`, `nexradVisible`,
`noaaInfraredVisible`, `noaaRadarVisible`, and `dwdRadolanVisible` are all
initialized `true` (both the `useState` driving the UI and the paired
`useRef` driving the mount-effect's `addCustomLayers` call in
`components/map/MapView.tsx`), and `components/map/layers.ts`'s
`addCustomLayers` falls back to `visibility.<key> ?? true` for every one of
those keys too. With five overlapping weather raster overlays, special use
airspace, military bases, and the terrain-based range outline all painted on
top of each other and the base map simultaneously, the initial view is
visually noisy and slow to make sense of — a new user has to manually turn
off eight different toggles before the map is legible. There's no
`localStorage` persistence for any of this state today (only the light/dark
theme persists, in `components/map/theme.ts`), so every fresh load hits this
same noisy default.

## What Changes

- On initial load (and on every fresh page load with no prior in-session
  toggle interaction), the following eight layers default to **off** instead
  of **on**:
  - Military Bases
  - Special Use Airspace
  - Terrain-Based Range Outline
  - RainViewer
  - NEXRAD
  - NOAA Radar
  - DWD RADOLAN
  - NOAA Infrared
- Every other toggleable layer keeps its existing default-on behavior,
  unchanged: Airports, OpenAIP TMS, TFRs, Airspace Boundaries, Aircraft,
  Transponder Location, Actual Range Outline, Range Rings, and Day/Night
  Terminator.
- A user's own toggle choice, made during the current session (e.g. turning
  Military Bases back on), continues to work exactly as it does today and
  is not affected by this change — this is purely a change to the
  first-paint default, not to toggle behavior, persistence, or any new
  "remember my choice across reloads" feature (none exists today, and this
  change doesn't add one).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `military-bases-layer`: the military base layer now defaults to hidden on
  initial load, instead of visible.
- `special-use-airspace-layer`: the special use airspace layer now defaults
  to hidden on initial load, instead of visible.
- `terrain-based-outline-layer`: the terrain-based outline layer now
  defaults to hidden on initial load, instead of visible.
- `rainviewer-radar-layer`: the RainViewer layer now defaults to hidden on
  initial load, instead of visible.
- `nexrad-layer`: the NEXRAD layer now defaults to hidden on initial load,
  instead of visible.
- `noaa-radar-layer`: the NOAA Radar layer now defaults to hidden on
  initial load, instead of visible.
- `dwd-radolan-layer`: the DWD RADOLAN layer now defaults to hidden on
  initial load, instead of visible.
- `noaa-infrared-satellite-layer`: the NOAA infrared satellite layer now
  defaults to hidden on initial load, instead of visible.

## Impact

- `components/map/MapView.tsx`: flips the initial value of 8 matched
  `useState`/`useRef` pairs — `militaryVisible`/`militaryVisibleRef`,
  `suaVisible`/`suaVisibleRef`, `terrainOutlineVisible`/
  `terrainOutlineVisibleRef`, `rainViewerVisible`/`rainViewerVisibleRef`,
  `nexradVisible`/`nexradVisibleRef`, `noaaRadarVisible`/
  `noaaRadarVisibleRef`, `dwdRadolanVisible`/`dwdRadolanVisibleRef`, and
  `noaaInfraredVisible`/`noaaInfraredVisibleRef` — from `true` to `false`.
  No other state in this file changes.
- `components/map/layers.ts`: flips the same 8 keys' fallback default inside
  `addCustomLayers` from `visibility.<key> ?? true` to
  `visibility.<key> ?? false`, and updates the `CustomLayerVisibility` doc
  comment accordingly, so the fallback stays consistent with
  `MapView.tsx`'s actual defaults even though today's only caller always
  passes every key explicitly.
- `test/layers.test.ts` (new): a fake-`MapLibreMap` regression test (same
  pattern as `test/userLocation.test.ts`) asserting `addCustomLayers(map,
  theme, {})`'s resulting layer visibilities match this change's acceptance
  criteria exactly — the 8 layers above `"none"`, every other toggleable
  layer `"visible"`.
- No changes to any toggle handler, any layer's rendering/refresh/fetch
  logic, the layer-control drawer's UI or its on-count badges (those are
  already derived purely from this same state, per
  `openspec/specs/layer-control-drawer/spec.md`), or to any persistence
  behavior.

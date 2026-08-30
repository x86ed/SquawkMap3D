## Context

`components/map/MapView.tsx` owns one `useState`/`useRef` pair per
toggleable layer (e.g. `militaryVisible`/`militaryVisibleRef`). The `useState`
half drives the `LayerToggleRow` checkboxes and the `AccordionGroup` on-count
badges rendered in the layer-control drawer; the `useRef` half is read inside
the mount-effect's `setupStyleDependentState` closure (and re-read on every
`style.load`, i.e. every theme swap) to build the `CustomLayerVisibility`
object passed into `components/map/layers.ts`'s `addCustomLayers`, which is
what actually sets each MapLibre layer's initial `layout.visibility`. Both
halves of every pair are currently initialized to the literal `true`, and
`addCustomLayers` itself falls back to `visibility.<key> ?? true` for every
key of `CustomLayerVisibility` it wasn't given. There is no `localStorage` (or
any other) persistence of layer-toggle state — `components/map/theme.ts` is
the only piece of map state that survives a reload — so "the default" and
"what a brand-new visitor sees" are the same thing today, and will remain the
same thing after this change (this change doesn't add persistence).

## Goals / Non-Goals

**Goals:**
- On first paint, exactly these 8 layers render hidden: Military Bases,
  Special Use Airspace, Terrain-Based Range Outline, RainViewer, NEXRAD, NOAA
  Radar, DWD RADOLAN, NOAA Infrared.
- Every other toggleable layer (Airports, OpenAIP TMS, TFRs, Airspace
  Boundaries, Aircraft, Transponder Location, Actual Range Outline, Range
  Rings, Day/Night Terminator) keeps rendering visible on first paint,
  unchanged.
- The two places a layer's default currently lives —
  `MapView.tsx`'s `useState`/`useRef` initializers, and `layers.ts`'s
  `addCustomLayers` per-key `?? true` fallback — stay in agreement with each
  other for all 13 keys, not just the 8 being flipped, so a future reader
  can trust either one without cross-checking the other.
- Toggling a layer on/off during a session, and that toggle's behavior
  across theme swaps and pilot-mode switches, is completely unchanged — this
  is a first-paint-default-only change.

**Non-Goals:**
- No `localStorage` (or other) persistence of the user's toggle choices
  across page reloads. Today, reloading the page always resets every layer
  to its default regardless of what the user toggled last visit; this change
  doesn't alter that — it only changes what the default itself is. Adding
  "remember my layer choices" is a separate, future change.
- No change to which layers exist, how any layer fetches/refreshes/renders
  its data, or the layer-control drawer's grouping, labels, or on-count
  badge math (`aviationOnCount`/`locationOnCount`/`weatherOnCount`/
  `environmentalOnCount` in `MapView.tsx` are already pure derivations of
  this same state — they display different initial numbers as a side effect
  of this change, but the formulas themselves don't change).
- No change to `setPilotModeVisibility`'s own base-style hide/restore
  behavior, or to any layer's z-order/stacking.
- Not introducing a shared "defaults" constant/module. See Decision 2 below
  for why this change keeps the literal `true`/`false` values inline at each
  of the two existing sites rather than factoring out a third, new,
  single-source-of-truth module.

## Decisions

### Decision 1: Flip only the 8 named layers' defaults, nothing else

The acceptance criteria is explicit and exhaustive: turn off Terrain-Based
Range Outline, Special Use Airspace, Military Bases, and all five weather
layers (RainViewer, NEXRAD, NOAA Radar, DWD RADOLAN, NOAA Infrared); leave
everything else on. That maps 1:1 onto 8 of the 13 keys `layers.ts`'s
`CustomLayerVisibility` already models, plus the matching `MapView.tsx`
state — the other 5 keys of that interface (`airports`, `openAip`, `tfr`,
`airspaceBoundaries`, `rangeOutline`) and the 4 layers `MapView.tsx` tracks
outside that interface (`aircraft`, `userLocation`, `rangeRings`,
`terminator`) are untouched. Rationale: minimizes the diff to exactly what
the acceptance criteria calls for, and avoids any risk of accidentally
changing a layer's default that wasn't named (e.g. Airspace Boundaries or
TFRs, both airspace-adjacent to Special Use Airspace and Military Bases but
explicitly *not* listed as "turn off").

### Decision 2: Keep the defaults as inline literals at the existing two sites, not a new shared constant

`MapView.tsx`'s `useState(true)`/`useRef(true)` pair and `layers.ts`'s
`visibility.<key> ?? true` fallback are two independent places that already
encode "this layer's default is on" today, and will independently need to
encode "off" for 8 of the 13 keys after this change. An alternative design
would introduce a single exported `DEFAULT_LAYER_VISIBILITY` constant in
`layers.ts` and have `MapView.tsx` import it for both its `useState` and
`useRef` initializers, collapsing 3 literal sites down to 1. This change
does *not* do that: `MapView.tsx`'s only caller of `addCustomLayers` already
always passes every key explicitly (never relies on the `?? true`/`?? false`
fallback at runtime — see `setupStyleDependentState` in `MapView.tsx`), so
the fallback's only real job is to keep `addCustomLayers` safe for a caller
that omits a key (e.g. a future test, or a future second call site). Given
that, introducing a shared constant module purely to deduplicate 8 boolean
literals is more machinery than this change's scope justifies; it would also
touch more of `MapView.tsx`'s existing structure (replacing two separate
`useState`/`useRef` initializer call sites per key with a shared lookup) than
the minimal 8-boolean-literal flip this ticket asks for. Both sites are
covered by the new `test/layers.test.ts` (Decision 3) and by inspection
during review, so drift between them is caught either way.

### Decision 3: Add a fake-map regression test asserting `addCustomLayers`'s own defaults, following `test/userLocation.test.ts`'s pattern

`components/map/layers.ts` has no existing test file, and its `addCustomLayers`
function is exactly where every layer's default `layout.visibility` is
decided (via the `visibility.<key> ?? true`/`?? false` fallback chain) — the
most direct, cheapest place to pin this change's acceptance criteria as a
regression test, independent of React/MapView rendering. `test/userLocation.test.ts`
already establishes the pattern this repo uses for this kind of test: a
minimal fake `MapLibreMap` object exposing just `getLayer`/`addLayer`/
`getSource`/`addSource`/`setLayoutProperty`, enough surface area for the
function under test, with no real MapLibre GL instance or DOM. `test/layers.test.ts`
follows that same pattern: build a fake map, call
`addCustomLayers(fakeMap, "light", {})` (an empty `visibility` object, so
every key falls through to its own default), and assert each of the 13
tracked layer IDs' resulting `layout.visibility` — `"none"` for the 8 flipped
layers, `"visible"` for the other 5 modeled by `CustomLayerVisibility`
(`airports`, `openAip`, `tfr`, `airspaceBoundaries`, `rangeOutline`). This
also incidentally guards Decision 2's "both sites stay in agreement" goal for
the `layers.ts` half; `MapView.tsx`'s `useState`/`useRef` initializers aren't
covered by this test (no existing React-rendering test harness in this repo
to hang that off of) and are instead a plain code-review-visible 8-line diff.

## Risks / Trade-offs

- **Risk:** A returning user who relied on the old "everything on by
  default" behavior sees fewer layers after this ships, with no setting to
  restore the old behavior automatically. Mitigation: none needed beyond
  what's already true today — every layer is still one click away in the
  layer-control drawer, and the acceptance criteria explicitly calls for
  this reduced default set as the intended fix for a too-busy first paint.
- **Trade-off:** Not introducing a shared defaults constant (Decision 2)
  means a future change that touches a layer's default again will still
  need to update two sites by hand. Accepted as proportionate to this
  change's scope; revisit if a third call site or a persistence feature
  ever gets added, at which point deduplication would pay for itself.

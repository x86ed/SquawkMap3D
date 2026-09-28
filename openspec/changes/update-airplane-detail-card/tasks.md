## 1. Study source implementation

- [ ] 1.1 Re-read `iconizer/3D-modeler/src/card.ts`'s `buildAircraftCard` and `iconizer/3D-modeler/src/style.css`'s `.card-*` rules (lines ~44-165) as the port source for markup structure and flip mechanics.
- [ ] 1.2 Map each `iconizer` class (`card-frame`, `card-inner`, `card-face`, `card-face-front`, `card-face-back`, `card-front-*`, `card-*`) to a camelCase CSS Modules name for `PlaneCard.module.css`.

## 2. CSS: flip frame and both faces

- [ ] 2.1 Add `.cardFrame` (perspective, `data-tier`-driven gradient border/glow, `mythic`/`apex` sheen) to `PlaneCard.module.css`, replacing/renaming the current `.aircraftRarityFrame` rule set as needed while preserving all existing tier-color CSS custom properties and selectors.
- [ ] 2.2 Add `.cardInner` with `transform-style: preserve-3d`, a `transition`, and a **base** `transform: rotateY(180deg)` (back face shown by default).
- [ ] 2.3 Add `.cardFrame:hover .cardInner { transform: rotateY(0deg); }` to flip to the front face on hover.
- [ ] 2.4 Add `.cardFace` (shared: `position: absolute`, `backface-visibility: hidden`, border-radius, shared border/background) plus `.cardFaceFront` (`transform: rotateY(180deg)` per the flip technique) and `.cardFaceBack` (`transform: rotateY(0deg)`), matching `iconizer`'s CSS structure so the base/hover swap in 2.2/2.3 correctly shows the back face by default.
- [ ] 2.5 Port front-face-only styles (pills, `card-front-header`, `card-front-art`, `card-front-xp-panel`, `card-front-grid` background) as new CSS Modules classes.
- [ ] 2.6 Reduced-motion: keep (or add, if missing) a `@media (prefers-reduced-motion: reduce)` rule disabling the `.cardInner` transition, matching `iconizer`'s existing rule.

## 3. PlaneCard.tsx: restructure into two faces

- [ ] 3.1 Wrap the existing `.aircraftTierCard` content in the new `.cardFrame > .cardInner > (.cardFaceFront, .cardFaceBack)` structure, keeping the outer `.cardScaleWrap`/`ResizeObserver` contain-fit logic unchanged.
- [ ] 3.2 Move the current identity header + `renderStatRegion` content onto `.cardFaceBack`, unchanged in content/logic.
- [ ] 3.3 Add new `.cardFaceFront` JSX: identity header (type badge/manufacturer/model), rarity-tier pill, adsb.win tier pill (from `cardStats`, mirroring `levelPillContent` in `iconizer/3D-modeler/src/card.ts`), the existing silhouette `<svg>` (`useTightAircraftShapeViewBox`/`getAircraftShape`, reused as-is — no 3D wireframe), and an XP panel (XP count + tier/progress label + `computeTierProgress`-driven bar, reusing the same helpers `renderStatRegion` already uses).
- [ ] 3.4 Move the whole-card `onClick` handler (open `https://adsb.win/dashboard/aircraft/{TYPE}`, skipping `form, input, button, a` targets) onto a container that wraps both faces (e.g. `.cardInner` or `.cardFrame`) so it applies regardless of which face is currently visible.
- [ ] 3.5 Confirm the click handler still no-ops when `typeDesignator` is falsy (`cursor: pointer` and the `onClick` stay conditional on `typeDesignator`, as today).

## 4. Verify against specs

- [ ] 4.1 Manually verify (dev server, `AircraftOverlay` with a selected aircraft) that the back face renders by default and the front face appears only on hover, per `aircraft-info-overlay`'s "PlaneCard is a two-face flip card" requirement.
- [ ] 4.2 Manually verify clicking either face opens the correct `adsb.win/dashboard/aircraft/{TYPE}` tab, and that clicking the feeder-UUID form's input/button does not navigate.
- [ ] 4.3 Manually verify all five `cardStats` states (empty, not-configured, invalid-token, error, ok+progress bar) still render correctly on the back face, and the front-face XP panel reflects the same `cardStats` value consistently.
- [ ] 4.4 Manually verify the `mythic`/`apex` tier gradient/sheen and all nine rarity-tier frame styles still render correctly on both faces.
- [ ] 4.5 Manually verify the existing `ResizeObserver` contain-fit scaling still works with the new nested flip structure (frame's natural `scrollWidth`/`scrollHeight` unaffected by the added 3D-transform layers).
- [ ] 4.6 Run the existing test suite (`test/aircraftModelCard.test.ts` and any `PlaneCard`-related tests) and fix any breakage caused by the DOM restructuring.

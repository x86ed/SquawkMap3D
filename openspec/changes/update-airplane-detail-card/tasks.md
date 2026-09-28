## 1. Study source implementation

- [x] 1.1 Re-read `iconizer/3D-modeler/src/card.ts`'s `buildAircraftCard` and `iconizer/3D-modeler/src/style.css`'s `.card-*` rules (lines ~44-165) as the port source for markup structure and flip mechanics.
- [x] 1.2 Map each `iconizer` class to this app's naming. **Deviation**: kept the existing `.aircraftRarityFrame`/`.aircraftTierCard` class names (rather than renaming to `.cardFrame`/`.cardFace`) since they're deeply cross-referenced by the byte-for-byte-ported adsb.win tier CSS (`:has()` selectors, 9 per-tier overrides, 6 material-tier overrides) — renaming risked breaking that pixel-exact styling for no functional benefit. Added only the new structural classes needed for the flip: `.cardInner`, `.cardFaceBack`, `.cardFaceFront`, `.frontXpPanel`.

## 2. CSS: flip frame and both faces

- [x] 2.1 Perspective added to the existing `.aircraftRarityFrame` (kept as the outer frame per 1.2's deviation) rather than a renamed `.cardFrame`; all existing tier-color custom properties/selectors untouched.
- [x] 2.2 Added `.cardInner` (`transform-style: preserve-3d`, `transition`). Resting `transform` needs no rule for `showBack=true` (the default) — `.cardFaceBack` is authored at `rotateY(0deg)`, so an un-rotated `.cardInner` already faces it forward; `[data-show-back="false"] .cardInner` rotates 180deg for front-forward-at-rest.
- [x] 2.3 Hover rules added: `[data-show-back="true"]:hover .cardInner` → `rotateY(180deg)` (reveals front); `[data-show-back="false"]:hover .cardInner` → `rotateY(0deg)` (reveals back).
- [x] 2.4 Added `.cardFaceBack`/`.cardFaceFront` (`backface-visibility: hidden`, correct resting `rotateY`, front absolutely positioned over the back). Both faces additionally carry the existing `.aircraftTierCard` class for shared background/padding/material-tier decoration, rather than a separate new shared `.cardFace` class — avoids duplicating that CSS.
- [x] 2.5 Front-face-only style added: `.frontXpPanel` (spacing wrapper around the shared XP block). **Deviation**: did not port `iconizer`'s pill/credit-row markup — the front face's rarity/tier badges are served by the existing shared floating `.badgeRow` (bottom of the frame, visible on both faces, unaffected by the flip), so no separate front-face pill markup was needed.
- [x] 2.6 Added `.cardInner { transition: none; }` to the existing `prefers-reduced-motion: reduce` block.

## 3. PlaneCard.tsx: restructure into two faces

- [x] 3.0 Added `showBack?: boolean` to `PlaneCardProps` (default `true` in the destructure); set `data-show-back={showBack}` on `.aircraftRarityFrame`.
- [x] 3.1 Wrapped content in `.aircraftRarityFrame > .cardInner > (.cardFaceBack, .cardFaceFront)`; `.cardScaleWrap`/`ResizeObserver` logic (targeting the outer frame ref) unchanged.
- [x] 3.2 Moved the identity header + `renderStatRegion(cardStats)` onto `.cardFaceBack`, unchanged in content/logic.
- [x] 3.3 Added `.cardFaceFront`: same identity header (extracted into a shared `identityHeader` JSX value used by both faces) plus a new `.frontXpPanel` driven by a new shared `renderXpSummary(cardStats)` helper (factored out of `renderStatRegion`'s previous inline XP block so both faces stay in sync). Reuses the existing silhouette `<svg>`, no 3D wireframe. Rarity/tier pills come from the existing shared `.badgeRow`, not new front-face-only pills (see 2.5's deviation note).
- [x] 3.4 Moved the whole-card `onClick` (adsb.win dashboard URL, skipping `form, input, button, a`) onto `.cardInner`, the shared ancestor of both faces.
- [x] 3.5 Confirmed: `cursor: pointer` and the `onClick` on `.cardInner` remain conditional on `typeDesignator` truthiness, unchanged from before.
- [x] 3.6 `AircraftOverlay.tsx`'s `<PlaneCard ... />` now passes `showBack={true}` explicitly.

## 4. Verify against specs

- [ ] 4.1 Manually verify (dev server, `AircraftOverlay` with a selected aircraft) that the back face renders by default and the front face appears only on hover, per `aircraft-info-overlay`'s "PlaneCard is a two-face flip card" requirement.
- [ ] 4.1a Manually verify `showBack={false}` (temporarily, e.g. via a local test tweak) flips the resting/hover faces, confirming the flag actually drives the CSS rather than the back-default being hardcoded.
- [ ] 4.2 Manually verify clicking either face opens the correct `adsb.win/dashboard/aircraft/{TYPE}` tab, and that clicking the feeder-UUID form's input/button does not navigate.
- [ ] 4.3 Manually verify all five `cardStats` states (empty, not-configured, invalid-token, error, ok+progress bar) still render correctly on the back face, and the front-face XP panel reflects the same `cardStats` value consistently.
- [ ] 4.4 Manually verify the `mythic`/`apex` tier gradient/sheen and all nine rarity-tier frame styles still render correctly on both faces.
- [ ] 4.5 Manually verify the existing `ResizeObserver` contain-fit scaling still works with the new nested flip structure (frame's natural `scrollWidth`/`scrollHeight` unaffected by the added 3D-transform layers).
- [x] 4.6 Ran the existing test suite (`npm test`): 173/173 pass, no failures introduced. No `PlaneCard`-specific unit tests exist in this repo (its correctness is manually/visually verified per the tasks above, consistent with how it was tested before this change). Also ran `npx tsc --noEmit`: no type errors.

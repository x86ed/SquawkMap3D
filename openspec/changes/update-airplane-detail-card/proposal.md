## Why

`PlaneCard` (`components/map/overlay/PlaneCard.tsx`) currently renders a single-face identity card: a static frame with a header row (type badge, manufacturer, model, silhouette) and a stat region below it, with no flip interaction and no front/back split. A newer, richer two-face flip-card design — front face (name, level/rarity pills, silhouette art, XP panel) and back face (identity, stat grid, XP bar, credits) with a pure-CSS 3D flip — already exists and is proven in the sibling `iconizer` project (`iconizer/3D-modeler/src/card.ts` + the `.card-frame`/`.card-inner`/`.card-face` rules in `iconizer/3D-modeler/src/style.css`), which itself was originally ported *from* this app's `PlaneCard.tsx` and has since been extended with the front face and flip mechanics matching the `plens-win/Card` library (https://github.com/plens-win/Card). This change ports that same flip-card markup/CSS back into `PlaneCard`, replacing the current single-face card, with two adjustments the current sighting flow needs: the back face (this app's existing identity+stats layout) shown by default instead of the front, and a click handler that opens the selected aircraft's real adsb.win page.

## What Changes

- Replace `PlaneCard`'s single-face DOM/CSS with the two-face flip-card structure ported from `iconizer/3D-modeler/src/card.ts`/`style.css`: `.card-frame` (perspective + tier-driven gradient border) containing `.card-inner` (the 3D-transformed flip container) containing `.card-face-front` and `.card-face-back`.
  - Front face: type badge/manufacturer/model header, rarity + tier pills, silhouette art, XP panel — new to this app's `PlaneCard`, ported as-is from `iconizer`'s implementation.
  - Back face: this app's existing identity header, stat grid (unique registrations, flights captured, observed time, highest altitude), XP/tier progress bar, and feeder-UUID inline form states — the current `PlaneCard` content, relaid out onto the back face rather than the card's only face.
- **BREAKING (visual/interaction only, not a props contract change)**: default orientation is reversed from the `iconizer`/`plens-win/Card` original — the back face (stats) shows by default and hovering flips to the front face (identity + silhouette + XP panel), rather than the library's own front-by-default behavior. This is a one-line CSS change (base `.card-inner` transform is `rotateY(180deg)`; `:hover` un-rotates to `0deg`) — no JS flip-state tracking either way.
- Card frame's tier-driven gradient border, glow, and `mythic`/`apex` special-tier treatments are preserved unchanged (already standardized between this app and `iconizer`; no rarity-tier logic changes).
- Clicking anywhere on the card (either face, excluding interactive children — the feeder-UUID form's input/button, and any link) SHALL navigate to `https://adsb.win/dashboard/aircraft/{TYPE_DESIGNATOR}` for the selected aircraft's ICAO type designator, in a new tab — the same destination `PlaneCard`'s current click handler already opens (this behavior is preserved from the existing implementation, now applying to both faces rather than only the current single face).
- No changes to `PlaneCardProps`'s public shape (`typeDesignator`, `category`, `manufacturerModel`, `rarityTier`, `cardStats`) — this is a rendering/markup change only.

## Capabilities

### Modified Capabilities

- `aircraft-info-overlay`: the "PlaneCard shows aircraft identity and rarity tier" and "PlaneCard shows optional fleet-wide stats when available, never fabricated" requirements are updated to describe the two-face flip card (back face shown by default, front face on hover/flip) instead of a single static face, and to state the click-to-adsb.win-dashboard behavior explicitly (previously implied by implementation only, not spec'd).

## Impact

- `components/map/overlay/PlaneCard.tsx`: restructured to render `.card-frame > .card-inner > (.card-face-front, .card-face-back)`, moving the current identity/stat JSX onto the back face and adding new front-face JSX (pills, silhouette slot reused from the existing shape-rendering logic, XP panel) ported from `iconizer/3D-modeler/src/card.ts`.
- `components/map/overlay/PlaneCard.module.css`: card-frame/flip rules (perspective, `rotateY`, `backface-visibility`, tier gradient border, `mythic`/`apex` sheen) ported from `iconizer/3D-modeler/src/style.css`'s `.card-*` rules, adapted to this app's CSS Modules class-naming convention; back-face-by-default achieved via the base/`:hover` transform swap described above.
- No new npm dependencies — this remains plain React + CSS, matching both `PlaneCard.tsx`'s and `iconizer`'s existing approach (the `plens-win/Card` GitHub library is a design/markup reference, already locally re-implemented in `iconizer`, not an npm package this change installs).
- No changes to `aircraftModelCard.ts`, `tierProgress.ts`, `feederUuid.ts`, `manufacturerModel.ts`, `aircraftShapes.ts`, or any data-fetching logic — this is a presentation-layer change to `PlaneCard` only.

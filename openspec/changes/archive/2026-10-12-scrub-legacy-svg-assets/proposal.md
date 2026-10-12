## Why

Two vendored 2D asset sets carry licenses this app can't live with: `public/aircraft-shapes/` (RexKramer1/AircraftShapesSVG, GPL-3.0) and `public/aircraft-silhouettes/` (pw-silhouettes, CC BY-NC-SA 4.0 — non-commercial). The app itself is MIT. The repo now has its own 3D models (`public/aircraft-models/*.glb`) and its own authored SVGs. Of the 207 files in `aircraft-shapes/`, 34 carry `data-author="squawk-7500"` — original work, not under those licenses. Keep those, scrub everything else, fill gaps from our own models, and drop the third-party licenses.

## What Changes

- **Keep** the 34 `public/aircraft-shapes/*.svg` files whose root has `data-author="squawk-7500"` (all have a matching `.glb`). They stay in place, untouched.
- **BREAKING (assets)** Delete the other 173 `public/aircraft-shapes/*.svg` (all GPL-derived, none authored, none with a model needed for fallback) and delete `public/aircraft-silhouettes/` entirely (pw-silhouettes, CC BY-NC-SA).
- Generate silhouettes from `.glb` models for the 21 models that have no authored SVG (`A21N A320 A321 A359 AS35 B744 B752 B789 BALL C172 F16 FFLO H60 P28A PC12 R44 SERV SF25 SHIP UNKN VFHC`), written to `public/aircraft-shapes/<TYPE>.svg` beside the authored ones, so every model has a 2D shape and 2D/3D stay consistent. Generated files carry no author.
- Add the special types in 3D: `PARA` (B3), `FALH` (B7), `FIRE` (C1), `PTUG` (C2), `TURB` (C3) exist; `UNKN` (unknown, flying saucer with spinning body) now exists. Extend the category fallback table so those categories and "no type, no category" resolve to modeled keys.
- Remove licenses/attribution tied to scrubbed assets: `public/aircraft-shapes/LICENSE`, `public/aircraft-silhouettes/LICENSE`, the README "Attribution" entries, `scripts/vendor-aircraft-icons.mjs`; replace the GPL text in `public/aircraft-shapes/README.md` with a provenance note (authored in-repo / generated from models).
- Re-point code: drop `AIRCRAFT_CATEGORY_FALLBACK_ICON` and the legacy-Inkscape handling; category/unknown fall back through `CATEGORY_FALLBACK_KEY` to modeled shapes.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `aircraft-tracks-layer`: "Aircraft rendered with per-type or fallback icons" — shapes come only from in-repo authored/generated SVGs; fallback chain adds special types (unknown/para/ground/etc.) before the generic marker.
- `aircraft-info-overlay`: "PlaneCard's front face shows a 3D model of the aircraft" — flat fallback resolves from the same shape set and the unknown special type; author credit applies to authored SVGs and `.glb` models, never to generated or fallback shapes.

## Impact

- Assets: 173 files deleted from `public/aircraft-shapes/`; `public/aircraft-silhouettes/` removed; 21 SVGs generated; `public/aircraft-shapes/manifest.json` regenerated.
- Code: `components/map/{aircraftShapes,aircraftIcons,constants,svgBBox,aircraftModels}.ts`, `components/map/overlay/PlaneCard.{tsx,module.css}`, `components/map/data/aircraftShapes.json`.
- Scripts: add `scripts/generate-aircraft-silhouettes.mjs`; delete `vendor-aircraft-icons.mjs`; adapt or delete `generate-aircraft-shapes-manifest.mjs`.
- Docs/licensing: `README.md` Attribution section, both `LICENSE` files, `public/aircraft-shapes/README.md`.
- Tests: `test/compassTrackModel.test.ts`, any test on category fallback keys.
- Visual: types with no model and no authored SVG fall to their category's representative shape. Intentional.

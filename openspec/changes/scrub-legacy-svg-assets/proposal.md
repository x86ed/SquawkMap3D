## Why

Two vendored 2D asset sets carry licenses this app can't live with: `public/aircraft-shapes/` (179 RexKramer1/AircraftShapesSVG files, GPL-3.0) and `public/aircraft-silhouettes/` (15 pw-silhouettes files, CC BY-NC-SA 4.0 — non-commercial). The app itself is MIT. The repo now has its own 3D models (`public/aircraft-models/*.glb`, ~50 types), so the SVGs are no longer needed as primary art — and most of them cover types with no model. Scrub them, derive all 2D art from the models we own, and drop the third-party licenses.

## What Changes

- **BREAKING (assets)** Delete every `public/aircraft-shapes/*.svg` whose type designator has no `public/aircraft-models/<TYPE>.glb`, then delete the rest of the directory (including `LICENSE`, `README.md`, `manifest.json`) once the generated silhouettes below replace it.
- Replace `public/aircraft-silhouettes/` (pw-silhouettes) with silhouettes **generated from the `.glb` models**: a build-time script projects each model top-down and writes `public/aircraft-silhouettes/<TYPE>.svg` plus a manifest. 2D icon, card flat fallback, and 3D model for a type now share one source of geometry, so a type's silhouette always matches its model.
- Add 3D models (and therefore silhouettes) for the special types that have none: unknown/unidentified, parachutist (B3), and ground vehicles (C1/C2); extend the category fallback table so B3/B4/C1/C2 and "no type, no category" resolve to a modeled key instead of the generic marker.
- Remove every license/attribution tied to the scrubbed assets: `public/aircraft-shapes/LICENSE`, `public/aircraft-silhouettes/LICENSE`, the README "Attribution" entries, `scripts/vendor-aircraft-icons.mjs`, `scripts/generate-aircraft-shapes-manifest.mjs`, and `components/map/data/aircraftShapes.json`.
- Re-point code at the new silhouette set: `aircraftShapes.ts`, `aircraftIcons.ts` (atlas), `constants.ts` (`AIRCRAFT_CATEGORY_FALLBACK_ICON`), `PlaneCard` flat fallback, `svgBBox.ts`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `aircraft-tracks-layer`: "Aircraft rendered with per-type or fallback icons" — icons resolve from model-derived silhouettes; fallback chain adds special types (unknown/para/ground) before the generic marker.
- `aircraft-info-overlay`: "PlaneCard's front face shows a 3D model of the aircraft" — flat fallback is the model-derived silhouette; the SVG-author credit scenarios go away (author comes only from the `.glb`).

## Impact

- Assets: `public/aircraft-shapes/` removed; `public/aircraft-silhouettes/` regenerated; new `.glb` files for special types in `public/aircraft-models/` + manifest.
- Code: `components/map/{aircraftShapes,aircraftIcons,constants,svgBBox,aircraftModels}.ts`, `components/map/overlay/PlaneCard.{tsx,module.css}`, `components/map/data/aircraftShapes.json`.
- Scripts: add `scripts/generate-aircraft-silhouettes.mjs`; delete `vendor-aircraft-icons.mjs`, `generate-aircraft-shapes-manifest.mjs`.
- Docs/licensing: `README.md` Attribution section, both asset-dir `LICENSE` files. The `.glb` models keep their own embedded author metadata.
- Tests: `test/compassTrackModel.test.ts` and any test asserting category fallback keys.
- Visual: types without a model lose their type-specific 2D icon and fall to the category's representative silhouette. Intentional.

## 1. Data model

- [x] 1.1 Add optional `variant?: string` field to `Aircraft` in `components/map/aircraft.ts`, doc-commented per the existing field style.
- [x] 1.2 Create `components/map/data/aircraftVariants.json` (`Record<registration, variantKey>`, registration uppercased, variant key `^[A-Z0-9]+(-[A-Z0-9]+)*$`) — empty/minimal seed entries are fine.
- [x] 1.3 In the aircraft normalization path (where `Aircraft` objects are built from feeder JSON in `components/map/aircraft.ts`), set `variant` from `aircraftVariants.json` by uppercased `registration` lookup; leave unset when missing/unmatched.

## 2. Manifest generation — 3D models

- [x] 2.1 Update `scripts/generate-aircraft-models-manifest.mjs` to detect `<TYPE>-<VARIANT>.glb` files alongside each `<TYPE>.glb` and emit a `variants?: string[]` array (variant keys with a vendored GLB) on that type's manifest entry.
- [ ] 2.2 Regenerate `public/aircraft-models/manifest.json` and confirm existing entries are unchanged aside from the new optional field.

## 3. Manifest generation — SVG shapes

- [x] 3.1 Update `scripts/generate-aircraft-shapes-manifest.mjs` to detect vendored `<TYPE>-<VARIANT>.svg` files and insert them into the generated manifest under a composite `${TYPE}-${VARIANT}` key alongside the existing `${TYPE}` key.
- [ ] 3.2 Regenerate `components/map/data/aircraftShapes.json` and confirm existing keys/entries are unchanged aside from the new composite keys.

## 4. Variant-aware 3D model resolution

- [x] 4.1 In `components/map/aircraftModels.ts`, add a variant-narrowing step applied after `resolveModelKey`'s existing exact/category-fallback result: prefer `${resolvedKey}-${variant}` when that key's manifest entry lists it under `variants`, else use `resolvedKey` unchanged.
- [x] 4.2 Extend `preloadModelScenegraphs`'s fan-out to also preload each manifest entry's declared `variants` (× gear-visibility), keyed consistently with `scenegraphGroupKey`.
- [x] 4.3 Update `resolveModelScenegraph`/`landingGearHideThresholdFeet` callers (`aircraftLayer.ts`) to pass the variant-resolved key rather than the bare type/category key.

## 5. Variant-aware SVG shape resolution

- [x] 5.1 In `components/map/aircraftShapes.ts`, update `getAircraftShape` (or add a variant-aware wrapper used by its callers) to try the composite `${resolvedKey}-${variant}` manifest entry before falling back to `${resolvedKey}`.
- [x] 5.2 Update `getAircraftShape` callers that have access to `Aircraft.variant` (`aircraftIcons.ts`, `PlaneCard.tsx`/`aircraftModelCard.ts`, any others found via the existing usage grep) to pass it through.

## 6. Tests

- [x] 6.1 Unit tests for the registration→variant lookup (match, missing registration, unmatched registration).
- [x] 6.2 Unit tests for variant-aware model key resolution: variant vendored, variant not vendored (falls back to type/category default), no variant set.
- [x] 6.3 Unit tests for variant-aware shape resolution: variant vendored, variant not vendored (falls back to default), no variant set.
- [x] 6.4 Regression test confirming an aircraft with no `variant` renders identically (same resolved keys) to current behavior.

## 7. Verification

- [x] 7.1 Run the full test suite and linter.
- [ ] 7.2 Manually verify in the running app: an aircraft mapped to a vendored variant renders the variant GLB+SVG; an aircraft mapped to a variant with no vendored assets still renders the type default.

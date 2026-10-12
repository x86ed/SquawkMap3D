## 1. Silhouette generator

- [ ] 1.1 Add `scripts/generate-aircraft-silhouettes.mjs`: load each `public/aircraft-models/*.glb`, project non-gear geometry top-down (skip `Rotor*` nodes except for `UNKN`, whose saucer body is a rotor node), trace outline, write filled single-path `public/aircraft-silhouettes/<TYPE>.svg` (square viewBox, bbox-cropped, nose up) and `manifest.json`
- [ ] 1.2 Run it for all existing models; visually spot-check every output (helicopters, floats, gear) and fix exclusion rules
- [ ] 1.3 Add a test asserting every `aircraft-models/manifest.json` entry has a silhouette file and manifest entry

## 2. Re-point code at generated silhouettes

- [ ] 2.1 `aircraftIcons.ts`: build atlas from `/aircraft-silhouettes/manifest.json`; drop `TYPE_SHAPE_URL` to `/aircraft-shapes`, drop `"category"` source and `AIRCRAFT_CATEGORY_FALLBACK_ICON` usage; re-check `ICON_ORIENTATION_OFFSET_DEG`
- [ ] 2.2 `constants.ts`: delete `AIRCRAFT_CATEGORY_FALLBACK_ICON`
- [ ] 2.3 `aircraftShapes.ts`: load silhouette from `/aircraft-silhouettes/<KEY>.svg`; remove `data/aircraftShapes.json`, `fetchLiveShape`, author parsing; keep `CATEGORY_FALLBACK_KEY`
- [ ] 2.4 `PlaneCard.tsx` / `PlaneCard.module.css`: use new shape source, drop `liveSvg`/legacy stroke override, credit from model only; remove `svgBBox.ts` if unused
- [ ] 2.5 Update `test/compassTrackModel.test.ts` and any test touching shape/category fallback or `resolveIconKey` sources

## 3. Special types in 3D

- [ ] 3.1 Models `PARA`, `FALH`, `FIRE`, `PTUG`, `TURB` are present in `public/aircraft-models/` and `manifest.json`; `UNKN` (flying saucer; body is a `Rotor*` node spinning about Y) added to `public/aircraft-models/` and `manifest.json`; owner may add embedded author metadata
- [ ] 3.2 Extend `CATEGORY_FALLBACK_KEY`: `B3→PARA`, `B4→ULAC`, `B6→VFHC`, `B7→FALH`, `C1→FIRE`, `C2→PTUG`, `C3→TURB`; add `UNKNOWN_FALLBACK_KEY="UNKN"` used by `resolveIconKey`, `resolveModelKeyForTypeAndCategory`, and `compassTrackModel.ts`
- [ ] 3.3 Regenerate silhouettes (1.1) so every special type gets 2D art
- [ ] 3.4 Tests: B3/B6/B7/C1/C2/C3 and no-category aircraft resolve to the mapped model key and silhouette
- [ ] 3.5 Decide `SERV`: remove from `public/aircraft-models/` or keep as a type-addressable model; remove from any `ROTORCRAFT`/special lists that reference it

## 4. Scrub assets and licenses

- [ ] 4.1 Delete (includes the untracked `public/aircraft-shapes/PARA.svg`, now superseded by `PARA.glb`) `public/aircraft-shapes/*.svg` with no matching model (confirm list before deleting)
- [ ] 4.2 Delete remainder of `public/aircraft-shapes/` (incl. `LICENSE`, `README.md`, `manifest.json`) and `components/map/data/aircraftShapes.json`
- [ ] 4.3 Delete pw-silhouettes files (`A1…C2.svg`, `wake-models.txt`) and `public/aircraft-silhouettes/LICENSE`; ensure only generated files remain
- [ ] 4.4 Delete `scripts/vendor-aircraft-icons.mjs` and `scripts/generate-aircraft-shapes-manifest.mjs`; update stale comments in `compass-card` vendor headers, `aircraftModels.ts`, `svgBBox.ts`
- [ ] 4.5 `README.md`: remove AircraftShapesSVG/pw-silhouettes Attribution entries; document `generate-aircraft-silhouettes.mjs`
- [ ] 4.6 `grep -rn "aircraft-shapes\|AircraftShapesSVG\|pw-silhouettes\|GPL" .` returns nothing outside `openspec/changes/archive` and `node_modules`

## 5. Verify

- [ ] 5.1 `npm run lint`, `npm test`, `npm run build` pass
- [ ] 5.2 Run app: modeled type, unmodeled type (category fallback), B3, C1, no-category aircraft all render at map zoom-out (2D) and close-in (3D); PlaneCard flat fallback and glow look right

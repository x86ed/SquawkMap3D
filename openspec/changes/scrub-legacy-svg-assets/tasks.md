## 1. Audit and silhouette generator

- [x] 1.1 Confirm the keep list: every `public/aircraft-shapes/*.svg` with root `data-author="squawk-7500"` (34 today) is kept; list the rest for deletion and get owner sign-off
- [x] 1.2 Add `scripts/generate-aircraft-silhouettes.mjs`: for each `public/aircraft-models/*.glb` with no authored SVG, project non-gear geometry top-down (rotor nodes included at rest, as the authored SVGs do), trace outline, write a filled `currentColor` single-path SVG with `data-generated="true"` to `public/aircraft-shapes/<TYPE>.svg`; never overwrite a file with `data-author`; regenerate `public/aircraft-shapes/manifest.json`
- [x] 1.3 Run it for the 21 models without authored SVGs (`A21N A320 A321 A359 AS35 B744 B752 B789 BALL C172 F16 FFLO H60 P28A PC12 R44 SERV SF25 SHIP UNKN VFHC`); visually spot-check each (helicopters, floats, saucer)
- [x] 1.4 Add a test: every `aircraft-models/manifest.json` entry has a shape file, and every file in `public/aircraft-shapes/*.svg` has `data-author` or `data-generated="true"`

## 2. Re-point code at the remaining shape set

- [x] 2.1 `aircraftIcons.ts`: atlas from `/aircraft-shapes/manifest.json` (now authored + generated only); drop the `"category"` icon source and `AIRCRAFT_CATEGORY_FALLBACK_ICON` usage; re-check `ICON_ORIENTATION_OFFSET_DEG` for the kept/generated keys
- [x] 2.2 `constants.ts`: delete `AIRCRAFT_CATEGORY_FALLBACK_ICON`
- [x] 2.3 `aircraftShapes.ts`: remove legacy-Inkscape handling and `data/aircraftShapes.json`; fetch `/aircraft-shapes/<KEY>.svg`; fall back to `UNKN`; keep `data-author` parsing for exact-match credit
- [x] 2.4 `PlaneCard.tsx` / `PlaneCard.module.css`: use the new source; drop the legacy stroke override (`computeTightViewBox`/`svgBBox.ts` kept: the icon atlas still crops each shape to its bbox)
- [x] 2.5 Update `test/compassTrackModel.test.ts` and any test touching shape/category fallback or `resolveIconKey` sources

## 3. Special types in 3D

- [x] 3.1 Models `PARA`, `FALH`, `FIRE`, `PTUG`, `TURB` and `UNKN` (flying saucer; body is a `Rotor*` node spinning about Y) are present in `public/aircraft-models/` and `manifest.json`; owner may add embedded author metadata to `UNKN`
- [x] 3.2 Extend `CATEGORY_FALLBACK_KEY`: `B3→PARA`, `B4→ULAC`, `B6→VFHC`, `B7→FALH`, `C1→FIRE`, `C2→PTUG`, `C3→TURB`; add `UNKNOWN_FALLBACK_KEY="UNKN"` used by `resolveIconKey`, `resolveModelKeyForTypeAndCategory`, and `compassTrackModel.ts`
- [x] 3.3 Regenerate silhouettes (1.1) so every special type gets 2D art
- [x] 3.4 Tests: B3/B6/B7/C1/C2/C3 and no-category aircraft resolve to the mapped model key and silhouette
- [x] 3.5 `SERV`: kept as a type-addressable model (no longer referenced by the category fallback table); its shape is generated

## 4. Scrub assets and licenses

- [x] 4.1 Delete the unauthored (153 removed; the other 20 of the original 173 were replaced in place by generated shapes) `public/aircraft-shapes/*.svg` (confirm list against 1.1 before deleting; `PARA.svg` and every other authored file stays)
- [x] 4.2 Delete `public/aircraft-shapes/LICENSE`, `components/map/data/aircraftShapes.json`, and replace `public/aircraft-shapes/README.md` GPL text with a provenance note (authored in-repo or generated from `.glb`)
- [x] 4.3 Delete `public/aircraft-silhouettes/` entirely (pw-silhouettes `A1…C2.svg`, `wake-models.txt`, `LICENSE`)
- [x] 4.4 Delete `scripts/vendor-aircraft-icons.mjs` and `scripts/generate-aircraft-shapes-manifest.mjs` (or reduce the latter to the new manifest step); update stale comments in `compass-card` vendor headers, `aircraftModels.ts`, `svgBBox.ts`, `PlaneCard.module.css`
- [x] 4.5 `README.md`: remove AircraftShapesSVG/pw-silhouettes Attribution entries; document `generate-aircraft-silhouettes.mjs`
- [x] 4.6 `grep -rn "AircraftShapesSVG\|pw-silhouettes\|RexKramer1\|GPL" .` returns nothing outside `openspec/changes/archive` and `node_modules`

## 5. Verify

- [x] 5.1 `npm run lint`, `npm test`, `npm run build` pass
- [ ] 5.2 Run app: modeled type, unmodeled type (category fallback), B3, C1, no-category aircraft all render at map zoom-out (2D) and close-in (3D); PlaneCard flat fallback and glow look right

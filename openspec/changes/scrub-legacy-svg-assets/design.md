## Context

2D art today comes from two vendored SVG sets:

- `public/aircraft-shapes/<TYPE>.svg` — 207 files. 173 are RexKramer1/AircraftShapesSVG (GPL-3.0). 34 are authored in-repo: root `data-author="squawk-7500"`, plain `currentColor` SVGs, each with a matching `.glb`. Read by `aircraftIcons.ts` (atlas via `/aircraft-shapes/manifest.json`), `aircraftShapes.ts` (card flat fallback, `data/aircraftShapes.json`), and `fetchLiveShape` (live fetch, author).
- `public/aircraft-silhouettes/<CAT>.svg` (pw-silhouettes, CC BY-NC-SA) — category fallback via `AIRCRAFT_CATEGORY_FALLBACK_ICON`.

3D art is `public/aircraft-models/<TYPE>.glb` + `manifest.json`, resolved by `aircraftModels.ts` with the same `CATEGORY_FALLBACK_KEY` table. Models carry embedded `extras.authorship.author`.

## Goals / Non-Goals

**Goals:** no GPL/NC assets shipped; authored work kept untouched; every modeled type has a 2D shape; special types (unknown/para/ground/etc.) render in 3D.
**Non-Goals:** authoring new airliner models; changing rarity, color modes, glow, or atlas cell layout; re-licensing the `.glb` or authored SVG files.

## Decisions

1. **Authorship decides what is kept.** An SVG is kept iff its root element has `data-author="squawk-7500"` (34 files today: `A1 A20N A319 A333 A339 A37 A388 AS50 B38M B738 B763 B77L B77W BE9L C150 C180 C180-PONTOON E75L FALH FH11 FIRE L101 MG17 PARA PRTS PRTS-POD PTUG SR22 TB20 TURB UH1 ULAC V22 VF35`). Everything else in `aircraft-shapes/` is deleted, as is all of `aircraft-silhouettes/`. A test asserts every file left in `public/aircraft-shapes/` has either a `data-author` or `data-generated="true"` root attribute, so an unlicensed file can't sneak back in.

2. **Gaps filled by a generator, committed output.** `scripts/generate-aircraft-silhouettes.mjs` (Node, `three` + `GLTFLoader` already dependencies) loads each `.glb` with no authored SVG, projects non-gear geometry top-down (skipping `Rotor*` nodes except for `UNKN`, whose saucer body is a rotor node), rasterizes, traces the outline, simplifies, and writes `public/aircraft-shapes/<TYPE>.svg`: one filled `currentColor` path, bbox-cropped, nose up, root `data-generated="true"` and no `data-author`. Never overwrites a file that has `data-author`. Output committed; not part of `npm run build`.

3. **Single shape directory.** Shapes stay in `public/aircraft-shapes/` (the existing authoring workflow already writes there); `public/aircraft-silhouettes/` goes away. `AIRCRAFT_CATEGORY_FALLBACK_ICON` is deleted; the atlas resolves category → `CATEGORY_FALLBACK_KEY[category]` → that type's shape; `resolveIconKey`'s `"category"` source disappears (`"type"`, `"category-type"`, `"generic"` remain).

4. **Special types as real models.** Category → key mapping, all resolved through `CATEGORY_FALLBACK_KEY`; one `.glb` yields both the 3D model and the silhouette:

   | Category | Key | Model status |
   |---|---|---|
   | B3 parachutist | `PARA` | exists |
   | B4 ultralight | `ULAC` | exists |
   | B6 UAV | `VFHC` | exists |
   | B7 space/transatmospheric | `FALH` | exists |
   | C1 emergency vehicle | `FIRE` | exists |
   | C2 service vehicle | `PTUG` | exists (pushback tug) |
   | C3 point obstacle | `TURB` | exists (turbine/wind turbine) |
   | no type and no category (incl. A0/B0/C0/D0) | `UNKN` | exists (flying saucer; body spins as a rotor) |

   Add `UNKNOWN_FALLBACK_KEY = "UNKN"`. C4/C5 (cluster/line obstacle) stay on the generic marker. Existing `SERV` was the C1 stand-in; once `FIRE` lands it is unreferenced by the fallback table (remove or keep as a directly addressable type — decide in task 3.5).

5. **Card flat fallback uses the same shape files.** With only plain authored/generated SVGs left, `aircraftShapes.ts` drops the legacy-Inkscape layer handling and the `currentColor`-rewriting manifest JSON (`data/aircraftShapes.json`); it fetches `/aircraft-shapes/<KEY>.svg` and inlines it. The `"Unidentified"` shape is replaced by `UNKN`. `.shapeIcon:not([data-live]) path` stroke override and `computeTightViewBox` are removed if the live-render path covers every file (authored SVGs are already tightly cropped); verify per task 2.4.

6. **Authorship stays attribute-driven.** Authored SVGs keep `data-author`; `.glb` models keep `extras.authorship`. Existing exact-match rule is unchanged: a shape/model is credited only for the aircraft's own exact type, never a category fallback, `UNKN`, or a generated shape (no author). Generated shapes are never credited.

7. **Deletion order.** (a) generate the 21 missing shapes, (b) re-point code, (c) delete the 173 unauthored SVGs and `aircraft-silhouettes/`, (d) delete licenses/scripts/docs. Each step keeps the app building.

## Risks / Trade-offs

- Top-down model projection can yield blobby silhouettes for helicopters (rotors) or gear-down models → exclude `Rotors`/`Landing gear` nodes by name; spot-check every output visually.
- Types with no model and no authored SVG lose their exact 2D icon (e.g. A124 shows as the A5 representative). Accepted per the goal; coverage grows by adding models.
- `UNKN`'s whole saucer body is a rotor node, so the silhouette generator must include rotor nodes for that model (blade-only rotors on other types stay excluded).
- `ICON_ORIENTATION_OFFSET_DEG` was tuned per old SVG; generated silhouettes face nose-up by construction, so offsets are expected to be dropped — verify per key.

## Open Questions

- "Rendered in 3d as well": interpreted as silhouette derived from the 3D asset so 2D and 3D match. If the intent is also to extrude/render the silhouette in the 3D layer for unmodeled types, that's a follow-up.
- Key for the unknown type (`UNKN` assumed) and `PARA` for parachutist are still proposals; the rest are owner-specified.

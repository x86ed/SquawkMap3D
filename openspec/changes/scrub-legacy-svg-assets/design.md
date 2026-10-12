## Context

2D art today comes from two vendored SVG sets:

- `public/aircraft-shapes/<TYPE>.svg` (GPL-3.0) — type-specific; read by `aircraftIcons.ts` (atlas via `/aircraft-shapes/manifest.json`), `aircraftShapes.ts` (card flat fallback, inlined from `components/map/data/aircraftShapes.json`), and `fetchLiveShape` (live fetch for author).
- `public/aircraft-silhouettes/<CAT>.svg` (CC BY-NC-SA) — category fallback via `AIRCRAFT_CATEGORY_FALLBACK_ICON`.

3D art is `public/aircraft-models/<TYPE>.glb` + `manifest.json`, resolved by `aircraftModels.ts` with the same `CATEGORY_FALLBACK_KEY` table. Models are authored in-repo (embedded `extras.authorship.author`).

## Goals / Non-Goals

**Goals:** no GPL/NC assets shipped; one geometry source (the `.glb`) for 3D, 2D icon and card fallback; special types (unknown/para/ground) render as 3D.
**Non-Goals:** authoring high-fidelity new airliner models; changing rarity, color modes, glow, or atlas cell layout; re-licensing the `.glb` models.

## Decisions

1. **Silhouettes generated from models, committed output.** `scripts/generate-aircraft-silhouettes.mjs` (Node, `three` + `GLTFLoader` already dependencies) loads each `.glb`, takes world-space triangles of non-rotor, non-gear meshes, projects onto the model's ground plane (nose-forward axis as in `aircraftModels.ts` orientation), rasterizes the union at fixed resolution, traces the outline (marching squares), simplifies, and writes a single filled `<path>` SVG in a square viewBox centered on the bbox. Output committed, like the current manifest scripts — not part of `npm run build`. Rationale: deterministic, no runtime cost, no new runtime deps. Alternative (project at runtime from the loaded scenegraph) rejected: the 2D atlas must exist before models finish parsing, and fallback exists precisely for when they don't.

2. **Silhouette key = model key.** Output `public/aircraft-silhouettes/<TYPE>.svg` for every manifest entry plus `manifest.json`. Category entries (`A1`…`C2`) are no longer separate files: the atlas resolves category → `CATEGORY_FALLBACK_KEY[category]` → that type's silhouette. `AIRCRAFT_CATEGORY_FALLBACK_ICON` is deleted; `resolveIconKey`'s `"category"` source disappears (`"type"`, `"category-type"`, `"generic"` remain).

3. **Special types as real models.** Category → key mapping, all resolved through `CATEGORY_FALLBACK_KEY`; one `.glb` yields both the 3D model and the silhouette:

   | Category | Key | Model status |
   |---|---|---|
   | B3 parachutist | `PARA` | exists |
   | B4 ultralight | `ULAC` | exists |
   | B6 UAV | `VFHC` | exists |
   | B7 space/transatmospheric | `FALH` | exists |
   | C1 emergency vehicle | `FIRE` | exists |
   | C2 service vehicle | `PTUG` | exists (pushback tug) |
   | C3 point obstacle | `TURB` | exists (turbine/wind turbine) |
   | no type and no category (incl. A0/B0/C0/D0) | `UNKN` | new |

   Add `UNKNOWN_FALLBACK_KEY = "UNKN"`. C4/C5 (cluster/line obstacle) stay on the generic marker. Existing `SERV` was the C1 stand-in; once `FIRE` lands it is unreferenced by the fallback table (remove or keep as a directly addressable type — decide in task 3.5).

4. **Card flat fallback loads the silhouette SVG, not the manifest JSON.** `aircraftShapes.ts` drops `data/aircraftShapes.json` and the GPL-era `currentColor` rewrite; generated silhouettes are already a single `<path fill="currentColor">`. `.shapeIcon:not([data-live]) path` stroke override and most of `svgBBox.ts`'s tight-crop become unnecessary because the generator already crops to bbox — keep `computeTightViewBox` only if the generator's padding isn't enough; otherwise delete.

5. **Authorship.** Flat silhouette is derived, so it never carries its own author; credit comes from the `.glb`'s metadata only (same exact-match rule). `fetchLiveShape`'s author parsing and `data-author` handling are removed.

6. **Deletion order.** (a) generate silhouettes, (b) re-point code, (c) delete `aircraft-shapes/` and old `aircraft-silhouettes` files, (d) delete licenses/scripts/docs. Each step keeps the app building.

## Risks / Trade-offs

- Top-down model projection can yield blobby silhouettes for helicopters (rotors) or gear-down models → exclude `Rotors`/`Landing gear` nodes by name; spot-check every output visually.
- Types with no model lose their exact 2D icon (e.g. A124 shows as the A5 representative). Accepted per the goal; coverage grows by adding models.
- Only `UNKN` is still to be authored by the repo owner; until it lands, the unknown case resolves to the generic marker.
- `ICON_ORIENTATION_OFFSET_DEG` was tuned per old SVG; generated silhouettes face nose-up by construction, so offsets are expected to be dropped — verify per key.

## Open Questions

- "Rendered in 3d as well": interpreted as silhouette derived from the 3D asset so 2D and 3D match. If the intent is also to extrude/render the silhouette in the 3D layer for unmodeled types, that's a follow-up.
- Key for the unknown type (`UNKN` assumed) and `PARA` for parachutist are still proposals; the rest are owner-specified.

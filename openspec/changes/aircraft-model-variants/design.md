## Context

`aircraftModels.ts` resolves a type designator (or its emitter-category fallback) to a manifest entry, then to a pre-parsed glTF scenegraph keyed `${type}|${gearHidden}`. `aircraftShapes.ts` resolves a type designator (or category fallback) to an SVG entry from a generated JSON manifest. Both are keyed only on type — there is no per-aircraft override today.

ADS-B feeds (readsb's `aircraft.json`) carry no "variant" field. Any variant signal has to come from a source this app controls. Registration (`Aircraft.registration`, readsb's `r`) is the natural key: it's stable per airframe and already populated when the feeder loads a tar1090-db `aircraft.csv.gz`.

Referenced for asset-authoring convention (not code dependency): `plens-win/icao-codex` defines variant keys as `^[A-Z0-9]+(-[A-Z0-9]+)*$`, ALL CAPS, dash-separated, and tags GLB node `extras.variant`. `plens-win/iconizer`'s Airframe tool is what produces a type's default GLB+SVG pair; the same tool, run again with a variant's reference drawings, produces the variant's GLB+SVG pair.

## Goals / Non-Goals

**Goals:**
- An aircraft with a known variant renders the variant's GLB and SVG when both are vendored.
- Falls back to the type's default GLB/SVG when the variant isn't vendored for that asset kind (GLB and SVG fall back independently — a type could vendor a variant SVG without a variant GLB, or vice versa).
- Zero behavior change for any aircraft with no resolved variant (the overwhelming majority).
- Variant resolution reuses the existing category-fallback shape (type → category) unchanged; variant only ever narrows *within* whichever type/category key was already going to be used.

**Non-Goals:**
- Not deriving variant from ADS-B data itself (squawk, category, etc.) — out of scope, and no such field exists upstream.
- Not building an in-browser variant authoring/tagging UI (that's icao-codex's/iconizer's job, run out-of-band by whoever vendors new models).
- Not doing node-level visibility toggling within one shared GLB (icao-codex's approach for its own viewer). This app already ships one full GLB per type; shipping one additional full GLB per *variant* is simpler and consistent with the existing manifest-driven, whole-file-per-key pattern in `aircraftModels.ts`/`aircraftShapes.ts`.

## Decisions

**Variant source: new local registration→variant JSON, not a live/remote lookup.**
Registrations with known non-default variants are rare and change slowly (a specific tail number's floatplane conversion doesn't change week to week). A static vendored file (`components/map/data/aircraftVariants.json`, `Record<registration, variantKey>`, registration uppercased) loaded once alongside the other `components/map/data/*.json` manifests keeps this consistent with the existing `aircraftShapeManifest`/`typeDescriptions.json` pattern, needs no network round-trip per aircraft, and needs no backend. Alternative considered: deriving variant from `manufacturerModel`/`desc` string matching — rejected, too unreliable (free-text, inconsistent across feeders) for what should be an explicit, curated mapping.

**Asset naming: `<TYPE>-<VARIANT>.glb` / `.svg`, sibling to the default file.**
Mirrors the existing flat `public/aircraft-models/*.glb` / vendored SVG layout — no new directory nesting, no change to `modelUrl`'s shape beyond the key it's given. `<VARIANT>` reuses icao-codex's key format (`^[A-Z0-9]+(-[A-Z0-9]+)*$`) so any variant assets that do get authored via icao-codex/iconizer's convention drop in unchanged.

**Manifest schema: variant availability recorded per type, not inferred from directory listing.**
Next.js's `public/` has no directory-listing API (the existing doc comments in `aircraftModels.ts`/`aircraftShapes.ts` already call this out as the reason a manifest exists at all). Both generator scripts already walk the vendored files on disk at generation time; extending them to also detect `<TYPE>-<VARIANT>.{glb,svg}` siblings and record which variant keys exist per type is a natural extension, not a new mechanism.
- `public/aircraft-models/manifest.json`: each entry gains an optional `variants?: string[]` (variant keys with a vendored GLB for that type).
- `components/map/data/aircraftShapes.json`: shape lookup keys already double as "does this key exist" (a plain `Record<key, AircraftShape>`); a variant with a vendored SVG is simply also inserted under its own composite key (see below) rather than needing a separate list field.

**Resolution key: `${resolvedTypeOrCategoryKey}-${variant}`, computed after today's existing fallback.**
`resolveModelKey`/`getAircraftShape` already produce one "effective key" (exact type, or category fallback). Variant resolution is a second, independent narrowing pass on top of that result: try `${effectiveKey}-${variant}` first (GLB: check `variants` list on that type's manifest entry; SVG: check the composite key exists in the shape manifest), else fall back to `${effectiveKey}` unchanged. This keeps variant fully orthogonal to the type/category fallback chain — no combinatorial cases to special-case, and an aircraft whose exact type isn't vendored at all still gets category-fallback-with-variant applied consistently (e.g. an unvendored GA type with a floatplane variant still gets `C172-FLOATS` if that's the category-fallback type's vendored variant).

**Preload cost: variants preload lazily alongside their base type, not eagerly for every declared key.**
`preloadModelScenegraphs` already fans out per manifest entry × gear-visibility. Extending that same fan-out to also cover each entry's declared `variants` (× gear-visibility) is proportional to how many variants are actually vendored — expected to stay small (low tens of entries at most) — so no separate lazy-load-on-demand path is needed.

## Risks / Trade-offs

[Registration is absent for aircraft without tar1090-db-loaded feeders, or is a temporary/reassigned tail] → Mitigation: variant lookup degrades to "no variant" (identical to today's rendering) when registration is missing or unmatched; this is strictly additive, never a regression versus current behavior.

[Manifest/shape-JSON variant entries drift out of sync with actual vendored files if hand-edited] → Mitigation: both stay generator-owned (scripts re-run on the vendored directories, same as today), not hand-maintained.

[A variant key vendored for GLB but not SVG, or vice versa, could look inconsistent (3D variant model but default 2D icon or vice versa) in the same view] → Mitigation: accepted per Goals — the two resolutions are explicitly independent, matching that GLB and SVG assets are typically vendored by different people/passes; documented here rather than solved, since forcing them to move in lockstep would block shipping either asset alone.

## Migration Plan

- Additive only: new optional manifest/shape-JSON fields, new optional `Aircraft.variant` field, new optional lookup dataset. No existing field or file is removed or renamed.
- Ships with an empty `aircraftVariants.json` (or no variants yet vendored) — behavior is unchanged until both a registration mapping and a variant asset exist for some type.
- No rollback concerns beyond reverting the change; nothing downstream persists variant-derived state.

## Open Questions

- None blocking implementation. Whether floatplane/freighter/etc. are worth vendoring as actual variant assets (versus this just being infrastructure for a future data-entry pass) is a content decision, not a code decision, and can proceed independently of this change.

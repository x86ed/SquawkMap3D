## Why

The 3D model/icon pipeline (`aircraftModels.ts`, `aircraftShapes.ts`) resolves one GLB and one SVG per ICAO type designator. Some type designators cover meaningfully different real-world airframes (e.g. floatplane vs. wheeled `C182`, freighter vs. passenger widebody) that deserve a distinct model/icon, but today every aircraft of a given type renders identically. We need a per-aircraft variant override, keyed off data already available (registration), that swaps in a variant-specific model/icon when one is vendored, and falls back to the existing default cleanly when it isn't.

## What Changes

- Add an optional `variant` field to `Aircraft`, resolved from a new local registration→variant lookup dataset (ADS-B feeds carry no variant field of their own).
- Extend the vendored `.glb` manifest (`public/aircraft-models/manifest.json`) and its generator script to record, per type, which variant keys have a vendored model file (`<TYPE>-<VARIANT>.glb`).
- Extend the vendored `.svg` shape manifest (`components/map/data/aircraftShapes.json`) and its generator script analogously for `<TYPE>-<VARIANT>.svg`.
- Update `resolveModelKey`/model preloading in `aircraftModels.ts` and `getAircraftShape` in `aircraftShapes.ts` to prefer an aircraft's variant-specific asset when vendored, and fall back to the type's default asset when the variant isn't vendored — without changing behavior for aircraft with no variant set.
- Adopt the tagging convention from `plens-win/icao-codex`/`plens-win/iconizer` for authoring variant assets going forward: variant keys are `^[A-Z0-9]+(-[A-Z0-9]+)*$`, ALL CAPS, dash-separated.

## Capabilities

### New Capabilities
- `aircraft-model-variants`: registration-based variant resolution for an aircraft's 3D model (glb) and top-view shape (svg), with fallback to the type's default asset when no variant-specific asset is vendored.

### Modified Capabilities
(none — no existing spec currently documents the base model/shape resolution behavior this extends)

## Impact

- `components/map/aircraft.ts` — new `variant?: string` field on `Aircraft`.
- `components/map/aircraftModels.ts` — variant-aware key resolution, manifest shape, preload keys.
- `components/map/aircraftShapes.ts` — variant-aware shape lookup.
- `components/map/data/aircraftShapes.json`, `public/aircraft-models/manifest.json` — manifest schema gains per-type variant lists.
- `scripts/generate-aircraft-models-manifest.mjs`, `scripts/generate-aircraft-shapes-manifest.mjs` — must detect and emit variant entries.
- New: a small registration→variant lookup dataset (new file under `components/map/data/`).
- No breaking changes: aircraft with no matched variant keep today's exact behavior.

# Aircraft shapes

Top-down aircraft silhouettes keyed by ICAO type designator (e.g. `B738.svg`),
one per vendored 3D model in `../aircraft-models/`. Every file here is this
project's own work, under the repo's MIT license:

- **Authored** — root `data-author="<handle>"`. Hand-authored; never
  overwritten by the generator.
- **Generated** — root `data-generated="true"`, no author. Written by
  `scripts/generate-aircraft-silhouettes.mjs`, which projects the type's
  `.glb` model top-down. Re-run it after adding or changing a model:

  ```
  node scripts/generate-aircraft-silhouettes.mjs
  ```

`manifest.json` (written by the same script) lists the type keys the app
loads. `UNKN` is the shape for aircraft with no usable type or category; other
special types (`PARA`, `FIRE`, `PTUG`, `TURB`, …) are mapped from ADS-B emitter
categories in `components/map/aircraftShapes.ts`.

No third-party shape set is shipped (`test/aircraftShapeAssets.test.ts`
fails if a file here has neither marker).

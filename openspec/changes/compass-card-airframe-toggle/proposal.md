## Why

`RecordPanelHero`'s photo area shows a blank plane-icon placeholder whenever Planespotters has no photo for the selected aircraft (most GA registrations, most military/government aircraft) — a large fraction of selections land on a dead-looking panel. A compass/track card gives that empty state something live and useful, and the same hero also has no path today for a viewer to jump into this app's (external) CRUD tooling to fix a wrong registration, correct type data, or supply a real 3D model for a type that's currently rendering a generic stand-in silhouette.

## What Changes

- Add a photo/compass toggle control on `RecordPanelHero`'s image area:
  - When a Planespotters photo exists, the image area defaults to the photo, and the toggle switches to a compass-card view (and back).
  - When no photo exists, the image area defaults to the compass card (replacing today's blank plane-icon placeholder), and the toggle switches to the photo view — but only once a photo becomes available; with no photo at all, there is nothing to toggle to and the control is hidden.
  - The compass card is the third-party `compass-track` card kind from `plens-win/Card` (`@card/core`'s `buildCompassTrackCard`/`renderCard`, live-driven by `@card/compass-track-three`'s `mountCompassTrackCard`) — a static HTML shell (mount slot + heading/pitch, lat/lon, and modeler-credit HUD elements) plus a Three.js scene rendering a `.glb` model of the selected aircraft's type, oriented by its live heading/pitch/altitude/position. **Out of scope:** any editing controls beyond what the component itself already renders.
  - This app must supply the per-type `CompassTrackModel` (`modelUrl`, `rarityTier`, `gearMeshGroupName`, `gearDeploymentAltitudeMeters`, `modelerName`, `modelerProfileUrl`) the card needs — a new small dataset/registry keyed by ICAO type designator (+ variant), analogous to `aircraftShapes.ts`'s manifest. Types with no registered model use a default/generic stand-in `.glb` with no modeler credit.
- Add an "Edit" button next to the registration heading in `RecordPanelHero`, linking out to this app's configured aircraft-record CRUD page, with the selected aircraft's transponder hex code passed to it.
- Add an "Edit" button next to the type display in `PlaneCard`, linking out to this app's configured aircraft-type CRUD page, with the aircraft's ICAO type designator passed to it.
- When the compass card is shown for a type using the default/generic stand-in model, or whose registered model has no recorded modeler credit, its built-in bottom-right credit HUD SHALL show a "create a model" call-to-action (the card's own native handling of a blank credit — no patching required, see design.md), linking out to the configured model CRUD page with the type's ICAO designator and variant.
- Add app configuration (`NEXT_PUBLIC_*` env vars, following this app's existing low-sensitivity-URL convention — see `NEXT_PUBLIC_FEEDER_URL`/`NEXT_PUBLIC_OPENAIP_API_KEY`) for the three external CRUD endpoint base URLs:
  - Model CRUD page URL template (receives ICAO type designator + variant)
  - Type CRUD page URL template (receives ICAO type designator)
  - Aircraft CRUD page URL template (receives transponder hex code)
  
  Any edit/CTA link SHALL only render when its corresponding endpoint is configured; none are treated as required for the app to run.

## Capabilities

### New Capabilities
- `airframe-compass-card`: The photo/compass toggle on `RecordPanelHero`'s image area; the compass-card embed (`@card/core` + `@card/compass-track-three`) driven by the selected aircraft's live telemetry; which view is shown by default based on photo availability; the per-type `CompassTrackModel` dataset/registry (including the default/generic stand-in model) that feeds it; and the credit-HUD-vs-"create a model" CTA swap.
- `aircraft-record-edit-links`: The three configured CRUD endpoint URL templates and the registration/type "Edit" buttons (and the compass card's "create a model" CTA) that link out through them.

### Modified Capabilities
- `aircraft-info-overlay`: `RecordPanelHero`'s image area and identity block, and `PlaneCard`'s front face, gain new interactive elements (toggle, edit buttons, credit/CTA line) — existing requirements describing those components' rendered content need updating to account for them.

## Impact

- `components/map/overlay/RecordPanelHero.tsx` (+ `.module.css`): photo/compass toggle state, compass-card mount, registration edit button.
- `components/map/overlay/PlaneCard.tsx` (+ `.module.css`): type edit button.
- New dependency: `plens-win/Card`'s `packages/core` and `packages/compass-track-three` (private, unpublished — vendored into this repo, matching the existing vendoring pattern used for `aircraftShapes.ts`/the `.glb` scenegraph models) plus `three` (already a dependency via the existing `.glb` scenegraph layer, per `animatedAircraftScenegraphLayer.ts`).
- New: a per-ICAO-type (+ variant) `CompassTrackModel` dataset (new `.glb` model assets + metadata, including one default/generic stand-in model), analogous to `aircraftShapes.ts`'s manifest.
- New env vars (`.env.local`, deployment config, docs): CRUD endpoint URL templates.
- No backend changes — the CRUD pages themselves are external/out of scope; this app only links out to them.

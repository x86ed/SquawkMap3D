## 1. Vendor `plens-win/Card`'s compass-track card

- [ ] 1.1 Vendor `packages/core/src` (at least `compass-track-card.ts`, `.types.ts`, `rarity.ts`, `registry.ts`, and the `index.ts` re-exports actually used) into `components/map/overlay/compassCard/vendor/core/`, keeping upstream doc comments and exported id/class constants intact
- [ ] 1.2 Vendor `packages/compass-track-three/src/index.ts` into `components/map/overlay/compassCard/vendor/compassTrackThree/`, confirming it only needs `three`'s `GLTFLoader` (already available via the existing `.glb` scenegraph pipeline)
- [ ] 1.3 Add a short top-of-file provenance comment on each vendored file (source repo/path/commit, GPL/license note if any) matching `aircraftShapes.ts`'s existing vendoring convention
- [ ] 1.4 Confirm `RarityTier`/`RARITY_TIER_STYLES` in the vendored code matches this app's `aircraftRarity.ts` exactly; wire `SelectedAircraftInfo.rarityTier` straight through with no adapter

## 2. Compass-track model registry

- [ ] 2.1 Define `CompassTrackModelEntry` (modelUrl, gearMeshGroupName, gearDeploymentAltitudeMeters, modelerName?, modelerProfileUrl?) and a manifest data file (`components/map/data/compassTrackModels.json` or similar), keyed by ICAO type designator (+ optional variant)
- [ ] 2.2 Add one default/generic stand-in `.glb` asset (unauthored) and its entry, used whenever a type has no registry match
- [ ] 2.3 Implement `getCompassTrackModel(typeDesignator, variant)` in `components/map/overlay/compassCard/compassTrackModels.ts`, returning the matched entry or the default stand-in
- [ ] 2.4 Add a couple of hand-picked real registry entries (with real modeler credit) to exercise the "authored model" path end to end

## 3. Live telemetry feed

- [ ] 3.1 Expose `lat`/`lon` on `SelectedAircraftInfo` (already computed internally in `buildSelectedAircraftInfo` for `distanceNm`)
- [ ] 3.2 Add a `compassTrackState.ts` helper: converts altitude (ft→m), ground speed (kt→m/s), vertical rate (ft/min→m/s), derives `pitchDegrees` via `atan2(verticalRate_ms, groundSpeed_ms)` clamped to a sane range, and assembles a `CompassTrackState` from `SelectedAircraftInfo`
- [ ] 3.3 Unit-test the pitch estimate and unit conversions (climb, descent, level, zero-ground-speed edge case)

## 4. RecordPanelHero photo/compass toggle

- [ ] 4.1 Add `RecordPanelHero` view-mode state (`"photo" | "compass"`), defaulting per-hex based on photo availability, resetting on hex change
- [ ] 4.2 Render the toggle control only when both a photo and the compass card are available for the current selection; hide it when there's no photo
- [ ] 4.3 Mount `buildCompassTrackCard`'s HTML shell + `mountCompassTrackCard`'s live scene when the compass view is active, using `getCompassTrackModel` for the selected aircraft's type/variant and the telemetry helper's `CompassTrackState`
- [ ] 4.4 Call the mounted handle's `update()` on each telemetry poll tick while the compass view is active
- [ ] 4.5 Dispose the mounted handle on hex change, view-mode switch away from compass, and unmount
- [ ] 4.6 Remove the old bare "✈" placeholder glyph path (`styles.iconBlock`) now that the compass card covers the no-photo case

## 5. Credit HUD → "create a model" CTA swap

- [ ] 5.1 After mounting, check the resolved model entry for `modelerName`/`modelerProfileUrl`; if either is missing, replace the credit HUD element's (`CARD_COMPASS_TRACK_CREDIT_HUD_ID`) children with this app's own CTA link
- [ ] 5.2 Style the CTA to visually match the hero's existing photo-caption/credit styling
- [ ] 5.3 Only render the CTA when the model CRUD endpoint is configured (per section 6); otherwise leave the HUD area empty

## 6. CRUD endpoint configuration and edit links

- [ ] 6.1 Add `NEXT_PUBLIC_MODEL_CRUD_URL`, `NEXT_PUBLIC_TYPE_CRUD_URL`, `NEXT_PUBLIC_AIRCRAFT_CRUD_URL` env vars (document in `.env.local.example`/README as optional)
- [ ] 6.2 Implement `components/map/overlay/crudLinks.ts`: `getModelCrudUrl()`/`getTypeCrudUrl()`/`getAircraftCrudUrl()` accessors and a `buildCrudUrl(template, params)` helper that URI-encodes and substitutes `{icao}`/`{variant}`/`{hex}` placeholders
- [ ] 6.3 Add an "Edit" control next to `RecordPanelHero`'s registration heading, rendered only when the aircraft CRUD URL is configured, linking to it with the selected aircraft's hex
- [ ] 6.4 Add an "Edit" control next to `PlaneCard`'s type (manufacturer/model) display, rendered only when the type CRUD URL is configured and the type designator is known, linking to it with that designator
- [ ] 6.5 Wire the compass card's "create a model" CTA (section 5) to the model CRUD URL with the selected aircraft's ICAO designator and variant

## 7. Specs and styling polish

- [ ] 7.1 Update `RecordPanelHero.module.css`/`PlaneCard.module.css` for the toggle control, edit buttons, and CTA to match existing hero/card visual language and both light/dark themes
- [ ] 7.2 Verify `RecordPanelHero`'s portrait/landscape reflow still holds with the toggle control and edit button present
- [ ] 7.3 Manually verify against each new scenario in `specs/airframe-compass-card/spec.md` and `specs/aircraft-record-edit-links/spec.md`, and the modified scenarios in `specs/aircraft-info-overlay/spec.md`

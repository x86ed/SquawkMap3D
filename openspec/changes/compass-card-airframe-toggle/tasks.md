## 1. Vendor `plens-win/Card`'s compass-track card

- [ ] 1.1 Vendor `packages/core/src` (at least `compass-track-card.ts`, `.types.ts`, `rarity.ts`, `registry.ts`, and the `index.ts` re-exports actually used) into `components/map/overlay/compassCard/vendor/core/`, keeping upstream doc comments and exported id/class constants intact
- [ ] 1.2 Vendor `packages/compass-track-three/src/index.ts` into `components/map/overlay/compassCard/vendor/compassTrackThree/`, confirming it only needs `three`'s `GLTFLoader` (already available via the existing `.glb` scenegraph pipeline)
- [ ] 1.3 Add a short top-of-file provenance comment on each vendored file (source repo/path/commit, GPL/license note if any) matching `aircraftShapes.ts`'s existing vendoring convention
- [ ] 1.4 Confirm `RarityTier`/`RARITY_TIER_STYLES` in the vendored code matches this app's `aircraftRarity.ts` exactly; wire `SelectedAircraftInfo.rarityTier` straight through with no adapter

## 2. Compass-track model adapter (reuses `aircraftModels.ts`, no new dataset)

- [ ] 2.1 Pin `DEFAULT_COMPASS_MODEL_KEY = "B738"` (already vendored, already `CATEGORY_FALLBACK_KEY["A3"]`'s target) as the compass card's last-resort model when `resolveModelKeyForTypeAndCategory` returns `undefined`
- [ ] 2.2 Implement `getCompassTrackModel(typeDesignator, category, variant, rarityTier)` in `components/map/overlay/compassCard/compassTrackModel.ts`: resolves the model key via `resolveModelKeyForTypeAndCategory` (falling back to `DEFAULT_COMPASS_MODEL_KEY`), builds `modelUrl` via `aircraftModels.ts`'s `modelUrl()`, sets `gearMeshGroupName: "Landing gear"`, converts `landingGearHideThresholdFeet(key)` feet→meters (or a value that never trips `isGearVisible` when the model has no retractable-gear node), and leaves `modelerName`/`modelerProfileUrl` unset (no credit data source exists yet)
- [ ] 2.3 `variant` is accepted as an optional parameter for forward compatibility only — not yet used to refine the lookup (no variant data source exists); document this in the adapter's doc comment
- [ ] 2.4 When building the `CompassTrackModel` passed to the card, set `modelerAddUrl` to the configured model CRUD URL (icao + variant, when configured); leave it unset when the model CRUD endpoint isn't configured (the vendored card's `creditLinkMarkup` already renders the right fallback in each case; see design.md)

## 3. Live telemetry feed

- [ ] 3.1 Expose `lat`/`lon` on `SelectedAircraftInfo` (already computed internally in `buildSelectedAircraftInfo` for `distanceNm`)
- [ ] 3.2 Add a `compassTrackState.ts` helper: converts altitude (ft→m), ground speed (kt→m/s), vertical rate (ft/min→m/s), derives `pitchDegrees` via `atan2(verticalRate_ms, groundSpeed_ms)` clamped to a sane range, and assembles a `CompassTrackState` from `SelectedAircraftInfo`
- [ ] 3.3 Unit-test the pitch estimate and unit conversions (climb, descent, level, zero-ground-speed edge case)

## 4. RecordPanelHero photo/compass toggle

- [ ] 4.1 Add `RecordPanelHero` view-mode state (`"photo" | "compass"`), defaulting per-hex based on photo availability, resetting on hex change
- [ ] 4.2 Render the toggle control only when both a photo and the compass card are available for the current selection; hide it when there's no photo
- [ ] 4.3 Mount `buildCompassTrackCard`'s HTML shell + `mountCompassTrackCard`'s live scene when the compass view is active, using `getCompassTrackModel` for the selected aircraft's type/category/variant and the telemetry helper's `CompassTrackState`
- [ ] 4.4 Call the mounted handle's `update()` on each telemetry poll tick while the compass view is active
- [ ] 4.5 Dispose the mounted handle on hex change, view-mode switch away from compass, and unmount
- [ ] 4.6 Remove the old bare "✈" placeholder glyph path (`styles.iconBlock`) now that the compass card covers the no-photo case

## 5. Credit HUD / "create a model" CTA styling

- [ ] 5.1 Verify the vendored card's built-in "+ Add a model" CTA (rendered natively from `modelerAddUrl`, per task 2.4 — no DOM patch needed) renders and is clickable once wired up
- [ ] 5.2 Style/theme the card's credit HUD (authored-credit and CTA states, plus the unlinked-placeholder state when the model CRUD endpoint isn't configured) to fit this app's light/dark themes

## 6. CRUD endpoint configuration and edit links

- [ ] 6.1 Add `NEXT_PUBLIC_MODEL_CRUD_URL`, `NEXT_PUBLIC_TYPE_CRUD_URL`, `NEXT_PUBLIC_AIRCRAFT_CRUD_URL` env vars (document in `.env.local.example`/README as optional)
- [ ] 6.2 Add `getModelCrudUrl()`/`getTypeCrudUrl()`/`getAircraftCrudUrl()` accessors directly to `components/map/constants.ts` (this app's existing global config module — mirroring `getOpenAipApiKey()`/`getFeederUrl()`), plus a `buildCrudUrl(template, params)` helper there that URI-encodes and substitutes `{icao}`/`{variant}`/`{hex}` placeholders
- [ ] 6.3 Add an "Edit" control next to `RecordPanelHero`'s registration heading, rendered only when the aircraft CRUD URL is configured, linking to it with the selected aircraft's hex
- [ ] 6.4 Add an "Edit" control next to `PlaneCard`'s type (manufacturer/model) display, rendered only when the type CRUD URL is configured and the type designator is known, linking to it with that designator
- [ ] 6.5 Confirm task 2.4's `modelerAddUrl` wiring uses `constants.ts`'s `buildCrudUrl`/`getModelCrudUrl` (ICAO designator + variant), and that it's omitted entirely when the model CRUD endpoint isn't configured

## 7. Specs and styling polish

- [ ] 7.1 Update `RecordPanelHero.module.css`/`PlaneCard.module.css` for the toggle control, edit buttons, and CTA to match existing hero/card visual language and both light/dark themes
- [ ] 7.2 Verify `RecordPanelHero`'s portrait/landscape reflow still holds with the toggle control and edit button present
- [ ] 7.3 Manually verify against each new scenario in `specs/airframe-compass-card/spec.md` and `specs/aircraft-record-edit-links/spec.md`, and the modified scenarios in `specs/aircraft-info-overlay/spec.md`

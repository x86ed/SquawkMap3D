## 1. Vendor `plens-win/Card`'s compass-track card

- [ ] 1.1 Vendor `packages/core/src` (at least `compass-track-card.ts`, `.types.ts`, `credit-link.ts`, `rarity.ts`, `registry.ts`, and the `index.ts` re-exports actually used) into `components/map/overlay/compassCard/vendor/core/`, keeping upstream doc comments and exported id/class constants intact
- [ ] 1.2 Vendor `packages/compass-track-three/src/index.ts` into `components/map/overlay/compassCard/vendor/compassTrackThree/`, confirming it only needs `three`'s `GLTFLoader` (already available via the existing `.glb` scenegraph pipeline)
- [ ] 1.3 Add a short top-of-file provenance comment on each vendored file (source repo/path/commit, GPL/license note if any) matching `aircraftShapes.ts`'s existing vendoring convention
- [ ] 1.4 Confirm `RarityTier`/`RARITY_TIER_STYLES` in the vendored code matches this app's `aircraftRarity.ts` exactly; wire `SelectedAircraftInfo.rarityTier` straight through with no adapter

## 2. Extract embedded author metadata from vendored assets (both currently drop it)

- [ ] 2.1 Extend `scripts/generate-aircraft-models-manifest.mjs`: read `node.extras.authorship.author` off any node (found today on the root mesh node, e.g. `"Aircraft visual hull"` — not necessarily the `"Landing gear"` node), add it to each manifest entry as an optional `author?: string` (handle only — `createdAt`/`modelVersion` aren't needed by any consumer, omit them)
- [ ] 2.2 Add `author?: string` to `AircraftModelManifestEntry` in `components/map/aircraftModels.ts`; add a `modelAuthor(modelKey: string): string | undefined` accessor mirroring `landingGearHideThresholdFeet`'s shape
- [ ] 2.3 Extend `scripts/generate-aircraft-shapes-manifest.mjs`: read the root `<svg>` element's `data-author` attribute for each vendored shape, add it to that shape's manifest entry as an optional `author?: string`
- [ ] 2.4 Widen `AircraftShape` in `components/map/aircraftShapes.ts` with an optional `author?: string` field (no resolution-logic changes needed — `getAircraftShape` already returns the manifest entry object directly)
- [ ] 2.5 Re-run both generator scripts and confirm the regenerated manifests carry `author` for the types known to have it (13/36 models, 13/193 shapes as of this writing — e.g. `A319`)

## 3. Compass-track model adapter (reuses `aircraftModels.ts`, no new dataset)

- [ ] 3.1 Pin `DEFAULT_COMPASS_MODEL_KEY = "B738"` (already vendored, already `CATEGORY_FALLBACK_KEY["A3"]`'s target) as the compass card's last-resort model when `resolveModelKeyForTypeAndCategory` returns `undefined`
- [ ] 3.2 Implement `getCompassTrackModel(typeDesignator, category, variant, rarityTier)` in `components/map/overlay/compassCard/compassTrackModel.ts`: resolves the model key via `resolveModelKeyForTypeAndCategory` (falling back to `DEFAULT_COMPASS_MODEL_KEY`), builds `modelUrl` via `aircraftModels.ts`'s `modelUrl()`, sets `gearMeshGroupName: "Landing gear"`, converts `landingGearHideThresholdFeet(key)` feet→meters (or a value that never trips `isGearVisible` when the model has no retractable-gear node)
- [ ] 3.3 Set `modelerName`/`modelerProfileUrl` from `modelAuthor(key)` (task 2.2) when present — `modelerProfileUrl: \`https://adsb.win/operators/${author}\`` — leaving both unset when absent (including always for `DEFAULT_COMPASS_MODEL_KEY`)
- [ ] 3.4 `variant` is accepted as an optional parameter for forward compatibility only — not yet used to refine the lookup (no variant data source exists); document this in the adapter's doc comment
- [ ] 3.5 When building the `CompassTrackModel` passed to the card, set `modelerAddUrl` to the configured model CRUD URL (icao + variant, when configured) whenever `modelerName`/`modelerProfileUrl` are unset; leave it unset when the model CRUD endpoint isn't configured (the vendored card's `creditLinkMarkup` already renders the right fallback in each case; see design.md)

## 4. Live telemetry feed

- [ ] 4.1 Expose `lat`/`lon` on `SelectedAircraftInfo` (already computed internally in `buildSelectedAircraftInfo` for `distanceNm`)
- [ ] 4.2 Add a `compassTrackState.ts` helper: converts altitude (ft→m), ground speed (kt→m/s), vertical rate (ft/min→m/s), derives `pitchDegrees` via `atan2(verticalRate_ms, groundSpeed_ms)` clamped to a sane range, and assembles a `CompassTrackState` from `SelectedAircraftInfo`
- [ ] 4.3 Unit-test the pitch estimate and unit conversions (climb, descent, level, zero-ground-speed edge case)

## 5. RecordPanelHero photo/compass toggle

- [ ] 5.1 Add `RecordPanelHero` view-mode state (`"photo" | "compass"`), defaulting per-hex based on photo availability, resetting on hex change
- [ ] 5.2 Render the toggle control only when both a photo and the compass card are available for the current selection; hide it when there's no photo
- [ ] 5.3 Mount `buildCompassTrackCard`'s HTML shell + `mountCompassTrackCard`'s live scene when the compass view is active, using `getCompassTrackModel` for the selected aircraft's type/category/variant and the telemetry helper's `CompassTrackState`
- [ ] 5.4 Call the mounted handle's `update()` on each telemetry poll tick while the compass view is active
- [ ] 5.5 Dispose the mounted handle on hex change, view-mode switch away from compass, and unmount
- [ ] 5.6 Remove the old bare "✈" placeholder glyph path (`styles.iconBlock`) now that the compass card covers the no-photo case

## 6. Compass card's credit HUD / "create a model" CTA styling

- [ ] 6.1 Verify the vendored card's built-in credit link (real author) and "+ Add a model" CTA (rendered natively from `modelerName`/`modelerAddUrl`, per tasks 3.3/3.5 — no DOM patch needed) both render correctly and are clickable once wired up
- [ ] 6.2 Style/theme the card's credit HUD (authored-credit, CTA, and unlinked-placeholder states) to fit this app's light/dark themes

## 7. PlaneCard credit line

- [ ] 7.1 Determine, in `planeCardFrontArt.ts`'s existing load/fallback flow, which asset actually rendered for the current selection (3D `.glb` vs. flat SVG fallback) and its resolved key
- [ ] 7.2 Look up that asset's author: `modelAuthor(modelKey)` (task 2.2) for the 3D case, or the resolved `AircraftShape.author` (task 2.4) for the SVG-fallback case
- [ ] 7.3 Render a credit line beneath `PlaneCard`'s front-face art using the vendored `creditLinkMarkup()`/`WIREFRAME_CUBE_ICON` (task 1.1) directly — real `@handle` link to `https://adsb.win/operators/{handle}` when an author was found, else the model CRUD CTA (icao + variant) when configured, else nothing
- [ ] 7.4 Style the credit line to fit `PlaneCard`'s existing front-face layout and both light/dark themes (note: `PlaneCard`'s own colors are rarity-tier-driven and theme-independent per the existing "PlaneCard does not [reflect theme]" requirement — the credit line's colors should follow that same rule, not the ambient theme)

## 8. CRUD endpoint configuration and edit links

- [ ] 8.1 Add `NEXT_PUBLIC_MODEL_CRUD_URL`, `NEXT_PUBLIC_TYPE_CRUD_URL`, `NEXT_PUBLIC_AIRCRAFT_CRUD_URL` env vars (document in `.env.local.example`/README as optional)
- [ ] 8.2 Add `getModelCrudUrl()`/`getTypeCrudUrl()`/`getAircraftCrudUrl()` accessors directly to `components/map/constants.ts` (this app's existing global config module — mirroring `getOpenAipApiKey()`/`getFeederUrl()`), plus a `buildCrudUrl(template, params)` helper there that URI-encodes and substitutes `{icao}`/`{variant}`/`{hex}` placeholders
- [ ] 8.3 Add an "Edit" control next to `RecordPanelHero`'s registration heading, rendered only when the aircraft CRUD URL is configured, linking to it with the selected aircraft's hex
- [ ] 8.4 Add an "Edit" control next to `PlaneCard`'s type (manufacturer/model) display, rendered only when the type CRUD URL is configured and the type designator is known, linking to it with that designator
- [ ] 8.5 Confirm task 3.5's `modelerAddUrl` wiring and task 7.3's PlaneCard CTA both use `constants.ts`'s `buildCrudUrl`/`getModelCrudUrl` (ICAO designator + variant), and both are omitted entirely when the model CRUD endpoint isn't configured

## 9. Specs and styling polish

- [ ] 9.1 Update `RecordPanelHero.module.css`/`PlaneCard.module.css` for the toggle control, edit buttons, and credit line/CTA to match existing hero/card visual language and both light/dark themes
- [ ] 9.2 Verify `RecordPanelHero`'s portrait/landscape reflow still holds with the toggle control and edit button present
- [ ] 9.3 Manually verify against each new scenario in `specs/airframe-compass-card/spec.md` and `specs/aircraft-record-edit-links/spec.md`, and the modified scenarios in `specs/aircraft-info-overlay/spec.md`

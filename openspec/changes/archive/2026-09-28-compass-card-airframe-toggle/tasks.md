## 1. Vendor `plens-win/Card`'s compass-track card

- [x] 1.1 Vendor `packages/core/src` (at least `compass-track-card.ts`, `.types.ts`, `credit-link.ts`, `rarity.ts`, `registry.ts`, and the `index.ts` re-exports actually used) into `components/map/overlay/compassCard/vendor/core/`, keeping upstream doc comments and exported id/class constants intact
- [x] 1.2 Vendor `packages/compass-track-three/src/index.ts` into `components/map/overlay/compassCard/vendor/compassTrackThree/`, confirming it only needs `three`'s `GLTFLoader` (already available via the existing `.glb` scenegraph pipeline)
- [x] 1.3 Add a short top-of-file provenance comment on each vendored file (source repo/path/commit, GPL/license note if any) matching `aircraftShapes.ts`'s existing vendoring convention
- [x] 1.4 Confirm `RarityTier`/`RARITY_TIER_STYLES` in the vendored code matches this app's `aircraftRarity.ts` exactly; wire `SelectedAircraftInfo.rarityTier` straight through with no adapter

## 2. Extract embedded author metadata from vendored assets (both currently drop it)

- [x] 2.1 Extend `scripts/generate-aircraft-models-manifest.mjs`: read `node.extras.authorship.author` off any node (found today on the root mesh node, e.g. `"Aircraft visual hull"` — not necessarily the `"Landing gear"` node), add it to each manifest entry as an optional `author?: string` (handle only — `createdAt`/`modelVersion` aren't needed by any consumer, omit them)
- [x] 2.2 Add `author?: string` to `AircraftModelManifestEntry` in `components/map/aircraftModels.ts`; add a `modelAuthor(modelKey: string): string | undefined` accessor mirroring `landingGearHideThresholdFeet`'s shape
- [x] 2.3 Extend `scripts/generate-aircraft-shapes-manifest.mjs`: read the root `<svg>` element's `data-author` attribute for each vendored shape, add it to that shape's manifest entry as an optional `author?: string`
- [x] 2.4 Widen `AircraftShape` in `components/map/aircraftShapes.ts` with an optional `author?: string` field (no resolution-logic changes needed — `getAircraftShape` already returns the manifest entry object directly)
- [x] 2.5 Re-run both generator scripts and confirm the regenerated manifests carry `author` for the types known to have it (13/36 models, 13/193 shapes as of this writing — e.g. `A319`)

## 3. Compass-track model adapter (reuses `aircraftModels.ts`, no new dataset)

- [x] 3.1 Pin `DEFAULT_COMPASS_MODEL_KEY = "B738"` (already vendored, already `CATEGORY_FALLBACK_KEY["A3"]`'s target) as the compass card's last-resort model when `resolveModelKeyForTypeAndCategory` returns `undefined`
- [x] 3.2 Implement `getCompassTrackModel(typeDesignator, category, variant, rarityTier)` in `components/map/overlay/compassCard/compassTrackModel.ts`: resolves the model key via `resolveModelKeyForTypeAndCategory` (falling back to `DEFAULT_COMPASS_MODEL_KEY`), builds `modelUrl` via `aircraftModels.ts`'s `modelUrl()`, sets `gearMeshGroupName: "Landing gear"`, converts `landingGearHideThresholdFeet(key)` feet→meters (or a value that never trips `isGearVisible` when the model has no retractable-gear node)
- [x] 3.3 Set `modelerName`/`modelerProfileUrl` from `modelAuthor(key)` (task 2.2) when present — `modelerProfileUrl: \`https://adsb.win/operators/${author}\`` — leaving both unset when absent (including always for `DEFAULT_COMPASS_MODEL_KEY`)
- [x] 3.4 `variant` is accepted as an optional parameter for forward compatibility only — not yet used to refine the lookup (no variant data source exists); document this in the adapter's doc comment
- [x] 3.5 When building the `CompassTrackModel` passed to the card, set `modelerAddUrl` to the configured model CRUD URL (icao + variant, when configured) whenever `modelerName`/`modelerProfileUrl` are unset; leave it unset when the model CRUD endpoint isn't configured (the vendored card's `creditLinkMarkup` already renders the right fallback in each case; see design.md)

## 4. Live telemetry feed

- [x] 4.1 Expose `lat`/`lon` on `SelectedAircraftInfo` (already computed internally in `buildSelectedAircraftInfo` for `distanceNm`)
- [x] 4.2 Add a `compassTrackState.ts` helper: converts altitude (ft→m), ground speed (kt→m/s), vertical rate (ft/min→m/s), derives `pitchDegrees` via `atan2(verticalRate_ms, groundSpeed_ms)` clamped to a sane range, and assembles a `CompassTrackState` from `SelectedAircraftInfo`
- [x] 4.3 Unit-test the pitch estimate and unit conversions (climb, descent, level, zero-ground-speed edge case)

## 5. RecordPanelHero photo/compass toggle

- [x] 5.1 Add `RecordPanelHero` view-mode state (`"photo" | "compass"`), defaulting per-hex based on photo availability, resetting on hex change
- [x] 5.2 Render the toggle control only when both a photo and the compass card are available for the current selection; hide it when there's no photo
- [x] 5.3 Mount `buildCompassTrackCard`'s HTML shell + `mountCompassTrackCard`'s live scene when the compass view is active, using `getCompassTrackModel` for the selected aircraft's type/category/variant and the telemetry helper's `CompassTrackState`
- [x] 5.4 Call the mounted handle's `update()` on each telemetry poll tick while the compass view is active
- [x] 5.5 Dispose the mounted handle on hex change, view-mode switch away from compass, and unmount
- [x] 5.6 Remove the old bare "✈" placeholder glyph path (`styles.iconBlock`) now that the compass card covers the no-photo case

## 6. Compass card's credit HUD / "create a model" CTA styling

- [x] 6.1 Verify the vendored card's built-in credit link (real author) and "+ Add a model" CTA (rendered natively from `modelerName`/`modelerAddUrl`, per tasks 3.3/3.5 — no DOM patch needed) both render correctly and are clickable once wired up
- [x] 6.2 Style/theme the card's credit HUD (authored-credit, CTA, and unlinked-placeholder states) to fit this app's light/dark themes

## 7. PlaneCard credit line

- [x] 7.1 Determine, in `planeCardFrontArt.ts`'s existing load/fallback flow, which asset actually rendered for the current selection (3D `.glb` vs. flat SVG fallback) and its resolved key
- [x] 7.2 Look up that asset's author: `modelAuthor(modelKey)` (task 2.2) for the 3D case, or the resolved `AircraftShape.author` (task 2.4) for the SVG-fallback case
- [x] 7.3 Render a credit line beneath `PlaneCard`'s front-face art using the vendored `creditLinkMarkup()`/`WIREFRAME_CUBE_ICON` (task 1.1) directly — real `@handle` link to `https://adsb.win/operators/{handle}` when an author was found, else the model CRUD CTA (icao + variant) when configured, else nothing
- [x] 7.4 Style the credit line to fit `PlaneCard`'s existing front-face layout and both light/dark themes (note: `PlaneCard`'s own colors are rarity-tier-driven and theme-independent per the existing "PlaneCard does not [reflect theme]" requirement — the credit line's colors should follow that same rule, not the ambient theme)

## 8. CRUD endpoint configuration and edit links

- [x] 8.1 Add `NEXT_PUBLIC_MODEL_CRUD_URL`, `NEXT_PUBLIC_TYPE_CRUD_URL`, `NEXT_PUBLIC_AIRCRAFT_CRUD_URL` env vars (document in `.env.local.example`/README as optional)
- [x] 8.2 Add `getModelCrudUrl()`/`getTypeCrudUrl()`/`getAircraftCrudUrl()` accessors directly to `components/map/constants.ts` (this app's existing global config module — mirroring `getOpenAipApiKey()`/`getFeederUrl()`), plus a `buildCrudUrl(template, params)` helper there that URI-encodes and substitutes `{icao}`/`{variant}`/`{hex}` placeholders
- [x] 8.3 Add an "Edit" control next to `RecordPanelHero`'s registration heading, rendered only when the aircraft CRUD URL is configured, linking to it with the selected aircraft's hex
- [x] 8.4 Add an "Edit" control next to `PlaneCard`'s type (manufacturer/model) display, rendered only when the type CRUD URL is configured and the type designator is known, linking to it with that designator
- [x] 8.5 Confirm task 3.5's `modelerAddUrl` wiring and task 7.3's PlaneCard CTA both use `constants.ts`'s `buildCrudUrl`/`getModelCrudUrl` (ICAO designator + variant), and both are omitted entirely when the model CRUD endpoint isn't configured

## 9. Specs and styling polish

- [x] 9.1 Update `RecordPanelHero.module.css`/`PlaneCard.module.css` for the toggle control, edit buttons, and credit line/CTA to match existing hero/card visual language and both light/dark themes
- [x] 9.2 Verify `RecordPanelHero`'s portrait/landscape reflow still holds with the toggle control and edit button present
- [x] 9.3 Manually verify against each new scenario in `specs/airframe-compass-card/spec.md` and `specs/aircraft-record-edit-links/spec.md`, and the modified scenarios in `specs/aircraft-info-overlay/spec.md`

## 10. Fix: never credit a category-fallback/default-stand-in asset, even when it has its own real author

- [x] 10.1 Add `isExactModelMatch(typeDesignator)` to `components/map/aircraftModels.ts` (exact-type manifest membership, independent of `resolveModelKeyForTypeAndCategory`'s category-fallback resolution)
- [x] 10.2 Add `isExactShapeMatch(typeDesignator)` to `components/map/aircraftShapes.ts` (same idea, for the SVG manifest)
- [x] 10.3 Gate `compassTrackModel.ts`'s `modelAuthor(modelKey)` lookup on `isExactModelMatch(typeDesignator)` — a category-fallback or `DEFAULT_COMPASS_MODEL_KEY` resolution is always treated as unauthored, regardless of whether the substitute model itself has embedded author metadata
- [x] 10.4 Gate `PlaneCard.tsx`'s `frontArtAuthor` the same way for both branches: `isExactModelMatch(typeDesignator)` for the 3D case, `isExactShapeMatch(typeDesignator)` for the flat-SVG-fallback case
- [x] 10.5 Add regression tests (`test/compassTrackModel.test.ts`) covering the exact real-world case that motivated this: `B738` is simultaneously an authored vendored model, `CATEGORY_FALLBACK_KEY["A3"]`'s target, and `DEFAULT_COMPASS_MODEL_KEY` — an aircraft of an unvendored type in category `A3` must render B738's model but NOT its author
- [x] 10.6 Update design.md/specs to make the exact-match rule normative (`specs/airframe-compass-card/spec.md`, `specs/aircraft-info-overlay/spec.md`)

## 11. Fix: WebGL context leak (blank credit/model/SVG) and map-relative compass heading

- [x] 11.1 Memoize `RecordPanelHero`'s `compassCardHtml` (`useMemo`, keyed on mount-identity, not raw telemetry) — stop rebuilding/re-injecting the compass card's DOM on every ~1s telemetry render, which was leaking a WebGL context per tick and exhausting the page's context budget (collateral: compass view, `PlaneCard`'s 3D model, and reportedly the map itself all going blank)
- [x] 11.2 Use the render-time state-reset pattern (not a ref) for the compass card's frozen "initial telemetry" snapshot, since reading a ref during a `useMemo` factory trips `react-hooks/refs`
- [x] 11.3 Wrap `planeCardFrontArt.ts`'s `mountCardArt` WebGL-renderer creation in try/catch, falling back to the flat SVG on failure instead of leaving the slot blank
- [x] 11.4 Track live map bearing in `MapView.tsx` (`map.on("rotate", ...)`) and thread it through `AircraftOverlay` to `RecordPanelHero` as `mapBearing`
- [x] 11.5 Compute the compass card's heading as screen-relative (`track - mapBearing`, normalized to `[0, 360)`) rather than always true-north, and include `mapBearing` in the live-update effect's deps so rotating the map alone re-orients the rendered aircraft immediately
- [x] 11.6 Fix the toggle control overlapping the "AIRFRAME" tab in portrait orientation (both anchor to the panel's top-right corner when the image area is full-width) — offset the toggle down by the tab's height in the portrait CSS variant
- [x] 11.7 Update design.md/specs for the leak-fix pattern and the map-bearing-relative heading requirement (`specs/airframe-compass-card/spec.md`)

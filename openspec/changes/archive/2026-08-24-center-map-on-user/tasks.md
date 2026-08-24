## 1. Satellite icon asset

- [x] 1.1 Author `public/sat.svg` as a single solid (non-overlapping) satellite silhouette so `source-in` recoloring produces no holes
- [x] 1.2 Add `components/map/userLocationIcon.ts` mirroring `airportIcon.ts`'s `loadSvgImage`/`hexToRgb`/rasterize/cache pattern, simplified to one fixed color (no `MapTheme` param): load `/sat.svg` by URL, recolor via canvas `source-in` to `RING_LINE_COLOR`, cache the rasterized `ImageData`
- [x] 1.3 Add `registerUserLocationIconResolver(map)` using `map.setMissingStyleImageResolver`, matching `registerAirportIconResolver`'s race-safe registration pattern (single fixed image id, e.g. `user-location-sat`)

## 2. Replace 3D marker with symbol layer

- [x] 2.1 In `components/map/userLocation.ts`, remove `PEDESTAL_TIER`, `BLADE_TIER`, `buildDishPedestal`, `buildDishBlade`, `DISH_FILL_COLOR`, `DISH_BLADE_FILL_COLOR`, `DISH_FILL_OPACITY`, `DISH_ROTATION_DEG_PER_SEC`, `DISH_ROTATION_UPDATE_INTERVAL_MS`, and `startDishRotation`
- [x] 2.2 Replace `buildUserLocationFeatures`'s dish `FeatureCollection` with a single `Point` feature at `coords`
- [x] 2.3 In `addUserLocationLayers`, replace the `USER_DISH_LAYER_ID` `fill-extrusion` layer with a `symbol` layer using `icon-image` set to the icon id from task 1.3, `icon-allow-overlap: true`, `icon-anchor: "center"`
- [x] 2.4 Call `registerUserLocationIconResolver(map)` alongside `addUserLocationLayers` (on initial setup and on `style.load`, same call sites `addUserLocationLayers` already has)

## 3. Combined visibility toggle

- [x] 3.1 Add `setUserLocationVisibility(map, visible)` to `userLocation.ts` that sets MapLibre layer `visibility` (`"visible"`/`"none"`) on the icon layer, `USER_RINGS_LINE_LAYER_ID`, and `USER_RINGS_LABEL_LAYER_ID` together
- [x] 3.2 In `MapView.tsx`, add `userLocationVisible` state + ref (default `true`, matching the other layer toggles) and `handleUserLocationToggle` calling `setUserLocationVisibility`
- [x] 3.3 Add a toggle button to the `.controls` panel (e.g. "Hide my location" / "Show my location"), following the existing `data-active`/label pattern used by `handleMilitaryToggle` etc.

## 4. Cleanup

- [x] 4.1 In `MapView.tsx`, remove `dishRotationStopRef`, `restartDishRotation`, and all call sites (mount effect, `style.load` handler, location-resolved handler) now that the marker is static
- [x] 4.2 Remove the now-stale "Marker scale vs. ring scale" scale-justification comment in `userLocation.ts` (no longer applicable to a screen-constant symbol icon)
- [x] 4.3 Update `openspec/specs/user-location-marker/spec.md` scenarios/comments in code (`userLocation.ts` doc comments referencing the dish/rotation) so no stale references remain

## 5. Verification

- [x] 5.1 Run the app locally, grant geolocation permission, confirm the satellite icon renders at the user's location colored the same blue as the range rings (`#00b8db`)
- [x] 5.2 Toggle the new control and confirm the icon + all 4 rings/labels hide and reappear together
- [x] 5.3 Switch light/dark theme with the location resolved and confirm the icon and rings survive the style reload (and stay hidden if toggled off beforehand)
- [x] 5.4 Re-trigger "jump to my location" from a different position and confirm the icon/rings move rather than duplicating
- [x] 5.5 Run project lint/typecheck (`npm run lint` / `tsc`) to confirm no dangling references to removed dish/rotation exports

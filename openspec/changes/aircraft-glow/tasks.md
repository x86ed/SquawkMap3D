## 1. Shared brighten helper

- [x] 1.1 In `components/map/aircraftIcons.ts`, add `brightenColor(rgb: [number, number, number], amount: number): [number, number, number]` near `hexColorToRgb` — blends each channel toward 255 by `amount` (`channel + (255 - channel) * amount`, rounded), with a doc comment noting it's shared by `aircraftLayer.ts`'s new icon-glow and track-glow layers (design.md Decision 2)

## 2. Constants

- [x] 2.1 In `components/map/constants.ts`, add a new comment block (distinct from and clearly cross-referenced against the existing `AIRCRAFT_SELECTION_GLOW_*` block) introducing:
  - `AIRCRAFT_GLOW_BRIGHTEN_AMOUNT` (`0.4`) — shared brighten fraction used by both new glows
  - `AIRCRAFT_ICON_GLOW_SIZE_PIXELS` (`64`) — an `IconLayer` size (not a radius), larger than the 40px crisp icon so the pre-baked blur reads as a halo around it
  - `AIRCRAFT_ICON_GLOW_ALPHA` (`90`) — subtler than `AIRCRAFT_SELECTION_GLOW_ALPHA` (120)
  - `AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS` (`6`) — wider than the existing track line's 2px width
  - `AIRCRAFT_TRACK_GLOW_ALPHA` (`90`)

## 3. Icon glow: pre-baked blurred silhouette in the atlas + IconLayer

Revised per design.md Decision 3 — the icon glow renders each icon's own blurred silhouette (via a second `IconLayer` reusing the icon atlas), not a `ScatterplotLayer` circle.

- [x] 3.0 In `components/map/aircraftIcons.ts`: add `GLOW_ICON_KEY_SUFFIX` and exported `glowIconKey(key)` helper; add `GLOW_BLUR_PX`/`GLOW_SHRINK` constants near `CELL_SIZE`/`CELL_PADDING`; in `buildAircraftIconAtlas`, build a `baseEntries` list (unchanged from before) plus a duplicate `entries` list of glow variants (`glowIconKey(key)`, `glow: true`); load each base URL's image once (`imageByKey`, avoiding a duplicate fetch per glow entry); in the draw loop, when `entry.glow` is true, wrap the existing image/generic-marker/rotor-accent draw call in `ctx.save()/ctx.filter = "blur(${GLOW_BLUR_PX}px)"/ctx.restore()` and shrink the drawable size by `GLOW_SHRINK` first
- [x] 3.1 In `components/map/aircraftLayer.ts`, add `export const AIRCRAFT_ICON_GLOW_LAYER_ID = "aircraft-icon-glow";` alongside the other exported layer-id constants
- [x] 3.2 Import `glowIconKey` (not `ScatterplotLayer`-only helpers) from `./aircraftIcons`, and `AIRCRAFT_ICON_GLOW_SIZE_PIXELS` (not `AIRCRAFT_ICON_GLOW_RADIUS_PIXELS`) from `./constants`
- [x] 3.3 Build a new `IconLayer` (`iconGlowLayer`) from `positioned` (the same array `iconLayer` uses — every currently rendered aircraft, not just the selected one), reusing `iconAtlas.image`/`iconAtlas.mapping`: `getIcon: (d) => glowIconKey(resolveIconKey(d).key)`, `getPosition`/`getAngle` identical to `iconLayer`'s, `getColor: (d) => [...brightenColor(resolveAircraftColor(d, colorMode), AIRCRAFT_GLOW_BRIGHTEN_AMOUNT), AIRCRAFT_ICON_GLOW_ALPHA]`, `getSize: AIRCRAFT_ICON_GLOW_SIZE_PIXELS`, `sizeUnits: "pixels"`, `billboard: false`, `pickable: false`
- [x] 3.4 Add a doc comment above `iconGlowLayer` distinguishing it from `glowLayer` (the existing selection highlight) — this one is always-on, per-aircraft-colored, silhouette-shaped (not a circle), and unrelated to selection or rarity (cross-reference design.md Decision 3)

## 4. Track glow layer

- [x] 4.1 Add `export const AIRCRAFT_TRACK_GLOW_LAYER_ID = "aircraft-track-glow";` alongside the other exported layer-id constants
- [x] 4.2 Build a new `PathLayer<TrackSegment>` (`trackGlowLayer`) from the exact same `segments` array already built for `trackLayer` (no new loop): `getPath` identical to `trackLayer`'s, `getColor: (d) => [...brightenColor(d.color, AIRCRAFT_GLOW_BRIGHTEN_AMOUNT), AIRCRAFT_TRACK_GLOW_ALPHA]`, `getWidth: AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS`, `widthUnits: "pixels"`, `pickable: false`
- [x] 4.3 Add a doc comment above `trackGlowLayer` noting it's a second, wider, dimmer pass over the same segment data, purely additive underneath the existing crisp `trackLayer` (cross-reference design.md Decision 4)

## 5. Layer ordering

- [x] 5.1 Update `buildAircraftLayers()`'s return statement to `[glowLayer, iconGlowLayer, trackGlowLayer, trackLayer, rotorLayer, iconLayer]` (design.md Decision 5), and update the trailing comment describing paint order to mention both new glow layers and why they sit beneath the existing selection glow's own visual prominence

## 6. Verification

- [ ] 6.1 Manually verify every rendered aircraft icon (not just a selected one) shows a visible outer glow shaped like that icon's own silhouette (not a circle), in each of the three color modes (rarity, altitude, airspeed), with the glow color visibly brighter than but clearly related to the icon's own draw color
- [ ] 6.2 Manually verify every rendered track trail shows a visible outer glow along its length, and that the glow's color varies along the trail the same way the trail's own color does (e.g. altitude mode with a climbing/descending aircraft)
- [ ] 6.3 Manually verify selecting an aircraft still shows the existing larger rarity-colored selection highlight in addition to (and visually distinguishable from) the new always-on glow, and that deselecting it removes only the selection highlight while the always-on glow remains
- [ ] 6.4 Manually verify switching color mode updates both the icon glow and track glow colors immediately, consistent with the icons/tracks themselves
- [ ] 6.5 Manually verify no regression to aircraft click/hover/select hit-testing (glow layers are `pickable: false` and sit beneath the existing pickable icon layer)
- [ ] 6.6 Spot-check a dense-traffic view (many nearby aircraft/tracks) and tune `AIRCRAFT_ICON_GLOW_SIZE_PIXELS`/`AIRCRAFT_ICON_GLOW_ALPHA`/`AIRCRAFT_TRACK_GLOW_WIDTH_PIXELS`/`AIRCRAFT_TRACK_GLOW_ALPHA`/`AIRCRAFT_GLOW_BRIGHTEN_AMOUNT`/`GLOW_BLUR_PX`/`GLOW_SHRINK` (aircraftIcons.ts) if glows visually blur together into an illegible haze (design.md Open Questions)
- [x] 6.7 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

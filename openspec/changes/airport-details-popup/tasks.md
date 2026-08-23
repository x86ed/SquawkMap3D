## 1. Icon generation

- [ ] 1.1 Create `components/map/airportIcon.ts`: load `app/atc.svg` client-side, rasterize to canvas per theme (`source-in` composite onto white backing so negative space is opaque white, foreground recolored to `AIRPORT_FILL_COLOR`), export a function returning `ImageData`/`HTMLCanvasElement` keyed by theme.
- [ ] 1.2 Register the rasterized image(s) via `map.addImage("airport-icon-<theme>", ..., { pixelRatio: 2 })`, idempotently (skip if `map.hasImage(...)` already true), called from `addCustomLayers`/`setupStyleDependentState` on every `load`/`style.load`.

## 2. Layer swap

- [ ] 2.1 In `components/map/layers.ts`, change `AIRPORTS_LAYER_ID` from `type: "circle"` to `type: "symbol"` with `icon-image` referencing the theme-appropriate registered image id, `icon-allow-overlap: true`, and reasonable `icon-size` scaling by zoom (mirroring the removed `circle-radius` zoom interpolation).
- [ ] 2.2 On theme toggle (`style.load` re-add path), ensure the symbol layer's `icon-image` is repointed to the new theme's image id (or the image id itself is theme-invariant and only the underlying bitmap changes — pick one and keep `setPaintProperty`/re-add logic consistent).
- [ ] 2.3 Remove now-unused circle-specific paint properties/constants (`circle-stroke-width`, etc.) and any now-dead `haloColorFor` usage if fully superseded, or keep/adapt it if still used for icon halo.

## 3. Airports visibility toggle

- [ ] 3.1 Add `setAirportsVisibility(map, visible)` in `components/map/layers.ts`, mirroring `setMilitaryBasesVisibility`.
- [ ] 3.2 In `components/map/MapView.tsx`, add `airportsVisibleRef`/`airportsVisible` state (default `true`), a `handleAirportsToggle`, and pass the initial value through on layer (re)add so it survives theme/style swaps (mirroring `militaryVisibleRef`).
- [ ] 3.3 Add an "Hide/Show airports" toggle button in the controls panel, matching the existing military-bases button's markup/pattern.

## 4. Click popup

- [ ] 4.1 Create country-name/flag helpers (e.g. in `components/map/airportPopup.ts`): `flagEmojiForCountryCode(iso: string): string` (regional-indicator trick) and `countryNameForCode(iso: string): string` (via `Intl.DisplayNames`, falling back to the raw code if it returns `undefined`/the same code).
- [ ] 4.2 Add a `buildAirportPopupHtml(properties): string` helper formatting IATA code, ICAO code, name, flag, city (`municipality`), and country (derived) — omitting/placeholder-ing any `null` code field instead of rendering the literal `"null"`.
- [ ] 4.3 In `MapView.tsx`, wire a `click` listener on `AIRPORTS_LAYER_ID` (registered once, alongside the other map event listeners in the mount effect) that reads `event.features[0].properties`, builds popup HTML, and opens a `maplibregl.Popup` anchored at the clicked feature's coordinates.
- [ ] 4.4 Add `mouseenter`/`mouseleave` handlers on `AIRPORTS_LAYER_ID` toggling `map.getCanvas().style.cursor` between `"pointer"` and `""`.

## 5. Verification

- [ ] 5.1 Manually verify in both light and dark themes: airport icons render (not dots), icon foreground color matches the existing per-view airport color, negative space reads as solid white (not transparent to the basemap underneath).
- [ ] 5.2 Manually verify the airports toggle hides/shows icons and survives a theme switch and a pilot-mode toggle while hidden.
- [ ] 5.3 Manually verify clicking an airport with both codes present shows a correct popup (codes, name, flag, city, country); click one with a `null` code and confirm no literal `"null"` appears.
- [ ] 5.4 Manually verify the popup closes via its close control, and that no popup can be opened while the airports layer is toggled off.

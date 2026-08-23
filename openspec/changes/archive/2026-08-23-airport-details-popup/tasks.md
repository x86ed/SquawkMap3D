## 1. Icon generation

- [x] 1.1 Create `components/map/airportIcon.ts`: load `app/atc.svg` client-side, rasterize to canvas per theme (`source-in` composite, foreground recolored to `AIRPORT_FILL_COLOR`), export a function returning `ImageData`/`HTMLCanvasElement` keyed by theme. **Superseded**: the white backing disc described here was implemented then removed per user feedback — see design.md's Post-Implementation Addendum for what actually shipped (transparent background, flood-filled enclosed holes, per-theme color).
- [x] 1.2 Register the rasterized image(s) via `map.addImage("airport-icon-<theme>", ..., { pixelRatio: 2 })`, idempotently (skip if `map.hasImage(...)` already true), called from `addCustomLayers`/`setupStyleDependentState` on every `load`/`style.load`.

## 2. Layer swap

- [x] 2.1 In `components/map/layers.ts`, change `AIRPORTS_LAYER_ID` from `type: "circle"` to `type: "symbol"` with `icon-image` referencing the theme-appropriate registered image id, `icon-allow-overlap: true`, and reasonable `icon-size` scaling by zoom (mirroring the removed `circle-radius` zoom interpolation).
- [x] 2.2 On theme toggle (`style.load` re-add path), ensure the symbol layer's `icon-image` is repointed to the new theme's image id (or the image id itself is theme-invariant and only the underlying bitmap changes — pick one and keep `setPaintProperty`/re-add logic consistent).
- [x] 2.3 Remove now-unused circle-specific paint properties/constants (`circle-stroke-width`, etc.) and any now-dead `haloColorFor` usage if fully superseded, or keep/adapt it if still used for icon halo.

## 3. Airports visibility toggle

- [x] 3.1 Add `setAirportsVisibility(map, visible)` in `components/map/layers.ts`, mirroring `setMilitaryBasesVisibility`.
- [x] 3.2 In `components/map/MapView.tsx`, add `airportsVisibleRef`/`airportsVisible` state (default `true`), a `handleAirportsToggle`, and pass the initial value through on layer (re)add so it survives theme/style swaps (mirroring `militaryVisibleRef`).
- [x] 3.3 Add an "Hide/Show airports" toggle button in the controls panel, matching the existing military-bases button's markup/pattern.

## 4. Click popup

- [x] 4.0 Add `flag-icons` to `package.json` dependencies and install it.
- [x] 4.1 Create country-name/flag helpers (e.g. in `components/map/airportPopup.ts`): `flagSvgPathForCountryCode(iso: string): string | null` resolving to the `flag-icons` package's SVG for that code (falling back to `null` if the package has no asset for the code) and `countryNameForCode(iso: string): string` (via `Intl.DisplayNames`, falling back to the raw code if it returns `undefined`/the same code).
- [x] 4.2 Add a `buildAirportPopupHtml(properties): string` helper formatting IATA code, ICAO code, name, flag, city (`municipality`), country (derived), and an image slot (placeholder markup with a stable `id`/class to swap into) — omitting/placeholder-ing any `null` code field instead of rendering the literal `"null"`.
- [x] 4.3 Add `fetchAirportImage(name: string): Promise<string | null>` in `airportPopup.ts`: calls `https://en.wikipedia.org/api/rest_v1/page/summary/<encodeURIComponent(name)>`, returns `thumbnail.source` on success or `null` on any non-2xx/missing-thumbnail/error, with an in-memory `Map` cache keyed by name to dedupe repeat lookups within the session.
- [x] 4.4 In `MapView.tsx`, wire a `click` listener on `AIRPORTS_LAYER_ID` (registered once, alongside the other map event listeners in the mount effect) that reads `event.features[0].properties`, builds popup HTML (image slot starts as a loading placeholder), opens a `maplibregl.Popup` anchored at the clicked feature's coordinates, then calls `fetchAirportImage` and swaps the image slot's content in (or to the fallback) when it resolves — guarding against the popup having since been closed/replaced.
- [x] 4.5 Add `mouseenter`/`mouseleave` handlers on `AIRPORTS_LAYER_ID` toggling `map.getCanvas().style.cursor` between `"pointer"` and `""`.

## 5. Verification

- [x] 5.1 Manually verify in both light and dark themes: airport icons render as the solid `atc.svg` tower glyph (not dots, not a hollow outline), on a transparent background, in each theme's own foreground color (`#6600ff` light / `#ce00ff` dark). Verified via real-Chromium screenshots at both themes.
- [x] 5.2 Manually verify the airports toggle hides/shows icons and survives a theme switch and a pilot-mode toggle while hidden. Verified: layer visibility stayed `"none"` through a theme switch and a pilot-mode toggle-on/off while hidden, then correctly returned to `"visible"` on re-enable.
- [x] 5.3 Manually verify clicking an airport with both codes present shows a correct popup (codes, name, flag, city, country); click one with a `null` code and confirm no literal `"null"` appears. Verified: JFK popup showed correct IATA/ICAO/name/flag/city/country; a standalone test with a `null` `icao_code` confirmed no literal `"null"` in the rendered HTML.
- [x] 5.4 Manually verify the popup closes via its close control, and that no popup can be opened while the airports layer is toggled off. Verified via real-Chromium automation: popup opened (count 1), closed via `.maplibregl-popup-close-button` (count 0), and a click at the same coordinates while the layer was hidden opened nothing (count 0).
- [x] 5.5 Manually verify the image row: a well-known airport (e.g. one with an obvious Wikipedia page) shows a loading placeholder then the real thumbnail; an obscure/small airport with no matching page falls back cleanly (no broken-image icon, no stuck loading state); rapid repeat clicks on the same airport don't visibly re-fetch (cache hit). Verified via a standalone script: JFK returned a real Wikimedia thumbnail URL, a nonsense name returned `null` (fallback path) without throwing, and a repeat call returned the same cached `Promise` instance (no re-fetch).

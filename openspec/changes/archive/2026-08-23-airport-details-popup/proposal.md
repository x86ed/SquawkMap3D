## Why

Airports currently render as plain colored dots with no way to identify what they are — a pilot or explorer has to guess from position alone. Clicking an airport should surface its identity (codes, name, location) the way the military-bases layer already supports toggling visibility, closing the gap between "a dot is there" and "I know what that dot is."

## What Changes

- **BREAKING**: Replace the airport circle layer (`circle-radius`/`circle-color`) with an SVG-based symbol layer using `atc.svg` as the marker icon, recolored per theme so its negative space renders white and its fill matches the existing airport accent color for that map view (light/dark).
- Add a "Show/Hide airports" toggle button (alongside the existing military-bases toggle) that shows/hides the airport icon layer.
- Add click-to-open popup on airport icons showing: IATA code, ICAO code, name, an image of the airport, country flag, city, and country name.
- Render the country flag as a bundled SVG (new `flag-icons` npm dependency), keyed by the airport's ISO country code, instead of a Unicode emoji flag — reliable rendering across platforms/fonts.
- Derive full country name (via `Intl.DisplayNames`) at click time — no dataset change, no new dependency for the name itself.
- Fetch the popup image at click time from the Wikipedia/Wikimedia REST API (page-summary thumbnail, keyed by airport name), since the bundled dataset has no image field. Popup shows a loading state while the fetch is in flight and a fallback (e.g. the airport icon) when no page/thumbnail is found.

## Capabilities

### New Capabilities
(none — this extends the existing `airports-layer` capability)

### Modified Capabilities
- `airports-layer`: airports now render via a themed SVG icon (not a plain circle), are shown/hidden via a dedicated toggle control, and are clickable to open a popup with IATA/ICAO code, name, an image, flag, city, and country.

## Impact

- `components/map/layers.ts`: swap `AIRPORTS_LAYER_ID` circle layer for a `symbol` layer using an `atc.svg`-derived image per theme; add `setAirportsVisibility`.
- `components/map/MapView.tsx`: add airports-visible toggle state/button (mirrors `militaryVisible`), wire a `click` handler on the airport layer to open a MapLibre `Popup`, cursor styling on hover.
- New `components/map/airportIcon.ts` (or similar): builds theme-colored raster images from `atc.svg` (white negative space, theme-matched fill) and registers them with `map.addImage`.
- New `components/map/airportPopup.ts` (or inline in `layers.ts`/`MapView.tsx`): formats airport properties (iata_code, icao_code, name, municipality, iso_country) into popup HTML, including flag-emoji-from-ISO-code and country-name-from-ISO-code helpers, plus an async Wikipedia-thumbnail fetch for the image row.
- New runtime dependency on the public Wikipedia/Wikimedia REST API (`https://en.wikipedia.org/api/rest_v1/page/summary/<title>`), called client-side at popup-open time — no API key, but a new external network call and a new failure mode (no page found, no thumbnail, request failure) to handle gracefully.
- **New npm dependency**: `flag-icons` (bundled SVG flags per ISO 3166-1 alpha-2 code), added to `package.json` and imported/referenced from the popup builder. `Intl.DisplayNames` (country name) and the Wikipedia fetch (native `fetch`) still need no dependency.

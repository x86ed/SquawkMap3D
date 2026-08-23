## Context

Airports currently render via a `circle` layer (`AIRPORTS_LAYER_ID` in `components/map/layers.ts`) filled with a single hardcoded color and a theme-dependent halo stroke (`haloColorFor`). There's no click interactivity anywhere on the map yet — `MapView.tsx` only wires button-driven toggles (theme, pilot mode, military bases, locate-me), no `map.on("click", ...)`. The military-bases layer already establishes the toggle pattern (ref + state + `setXVisibility` helper in `layers.ts`) this change should mirror for airports.

MapLibre `symbol` layers render `icon-image` from images registered via `map.addImage(id, ImageData | HTMLImageElement | ...)` — they can't reference an SVG file directly. `atc.svg` must be rasterized (via `<canvas>` + `Image`/`createImageBitmap`, browser-only) into one or more themed bitmaps up front.

## Goals / Non-Goals

**Goals:**
- Replace the airport circle marker with an `atc.svg`-derived symbol icon, recolored so the icon's own fill matches the current per-view airport accent color and any negative space in the glyph is opaque white (not transparent/see-through to the basemap).
- Add a dedicated airports visibility toggle, following the existing military-bases toggle pattern exactly (ref + React state + `setAirportsVisibility` in `layers.ts` + button in `MapView.tsx`).
- Add click-to-popup on airport icons: IATA code, ICAO code, name, image, flag, city, country — codes/name/city/country come from `public/data/airports.geojson` (`iata_code`, `icao_code`, `name`, `municipality`, `iso_country`) or are derived from `iso_country` at click time; the image is fetched at click time from the Wikipedia/Wikimedia REST API.

**Non-Goals:**
- No new airport dataset fields, no bundled/offline image assets — codes/name/city/country come from the existing GeoJSON; only the popup image is fetched externally, and only at click time (not pre-fetched/bundled for all 5,279 airports).
- No generalized "popup framework" for other layers (military bases, etc.) — this only wires click/popup for airports.
- Not changing airport data at build time (no codegen step); flag/country-name derivation happens at render/click time from `iso_country`.
- No image caching/CDN layer beyond an in-memory per-session cache (Non-Goal: no service worker, no persistent cache, no self-hosted image proxy).

## Decisions

- **Icon rasterization**: Load `atc.svg` once per theme via `Image()` → draw to an offscreen `<canvas>` → recolor using `globalCompositeOperation: "source-in"` (fills the glyph's opaque pixels with the theme accent color) composited over a solid white backing layer sized to the glyph's bounding shape (fills negative space white) → `map.addImage("airport-icon-<theme>", imageData, { pixelRatio: 2 })`. Rationale: MapLibre symbol layers need a rasterized image, not live SVG DOM; canvas recoloring avoids maintaining hand-edited duplicate SVGs per theme and keeps a single source-of-truth `atc.svg`.
  - Alternative considered: pre-generate theme-specific SVG file variants at build time. Rejected — adds a build step / duplicate assets for a change that's just a fill-color swap, and the change requirement is explicitly about matching the *current view's* airport color at runtime.
- **Icon color source**: Reuse `AIRPORT_FILL_COLOR` (`components/map/layers.ts`) as the icon's foreground fill for both themes, since that's the "airport color" the layer already renders today. `haloColorFor(theme)` continues to determine any stroke/backing distinction between themes if kept.
  - Alternative considered: introduce new distinct per-theme accent colors. Rejected as unnecessary scope — the acceptance criteria says match the *existing* airport color per view, not invent a new palette.
- **Layer type swap, not overlay**: Replace the `circle` layer definition in place (same `AIRPORTS_LAYER_ID`, `type: "symbol"` instead of `type: "circle"`) rather than adding a second layer, so toggle/visibility logic and z-ordering stay simple.
- **Popup mechanism**: Use MapLibre's built-in `Popup` (already a `maplibre-gl` dependency, no new package), created in a `click` handler on `AIRPORTS_LAYER_ID`, closeButton default, anchored to the clicked feature's coordinates (not the cursor, to stay correct after any icon-anchor/offset tuning).
- **Flag rendering**: Add the `flag-icons` npm package (MIT-licensed, bundled SVG per ISO 3166-1 alpha-2 code, `flag-icons/flags/4x3/<cc>.svg` and a `flag-icons/css/flag-icons.min.css` class-based option) and reference the SVG for the airport's `iso_country` directly in the popup markup (e.g. `<img src="...">` pointed at the package's SVG, resolved via a bundler-friendly import/static path, or inlined). Chosen over Unicode emoji flags for reliable, pixel-consistent rendering across all platforms/fonts, per explicit user preference.
  - Alternative considered: Unicode regional-indicator emoji flags (`String.fromCodePoint(...)`). Rejected — no dependency/asset needed, but renders as plain two-letter text instead of a flag glyph on platforms/fonts without emoji-flag support (notably some Linux/Chrome configurations), which the user wants to avoid.
  - Alternative considered: fetch flag SVGs at click time from a CDN (e.g. flagcdn.com). Rejected — avoids a new npm dependency but adds a second external runtime dependency/failure mode alongside the Wikipedia image fetch; a bundled package is simpler and offline-safe.
- **Country name rendering**: `new Intl.DisplayNames(["en"], { type: "region" }).of(iso_country)` — a native `Intl` API, no dependency, handles the full ISO 3166-1 alpha-2 set the dataset already uses.
- **Popup image source**: Fetch `https://en.wikipedia.org/api/rest_v1/page/summary/<encodeURIComponent(name)>` (public REST API, no key, CORS-enabled) on popup open, using the airport's `name` as the page title. Render `thumbnail.source` from the response as the popup's image once it resolves; show a lightweight loading placeholder in the image slot until then, and fall back to the airport icon (or an equivalent generic placeholder) if the request 404s, the page has no `thumbnail`, or the fetch fails/times out. Not pre-fetched for the whole dataset — only looked up for the clicked airport, on demand.
  - Alternative considered: bundle a curated image dataset or use a paid aviation-photo API. Rejected per the user's explicit choice of the free, keyless Wikipedia REST API for this change.
  - Alternative considered: query by `icao_code`/`iata_code` instead of `name`. Rejected — Wikipedia page titles are name-based, not code-based, and many small airports' pages aren't titled by code; name lookup has broader (if imperfect) coverage. Accept mismatches as a known limitation (see Risks).
- **Missing-code handling**: `iata_code`/`icao_code` are `null` for many features in the dataset (seen in a sample of the bundled GeoJSON). Popup renders an em dash (`—`) or omits the row when a code is null, rather than showing the literal string `"null"`.
- **Hover affordance**: Add `mouseenter`/`mouseleave` on `AIRPORTS_LAYER_ID` to toggle `map.getCanvas().style.cursor`, mirroring common MapLibre click-layer UX (not in the original acceptance criteria, but necessary for the layer to read as clickable — flagged in Open Questions in case reviewer wants it deferred).

## Risks / Trade-offs

- [Wikipedia page lookup by airport `name` can return no page, a disambiguation page, or the wrong page (name collisions, non-English titles, small/private airfields with no article) for a meaningful fraction of the 5,279-airport dataset] → Mitigate with the icon/placeholder fallback on any non-2xx response or missing `thumbnail`; explicitly accept mismatched/missing images as a known limitation rather than building a curated mapping.
- [Client-side dependency on a third-party API (`en.wikipedia.org`) at popup-open time — outage, rate-limiting, or offline use breaks the image row without breaking the rest of the popup] → Mitigate by keeping the fetch isolated (own try/catch, own loading/error state) so a failed image fetch never blocks or delays rendering the text fields (codes/name/flag/city/country), which are all synchronous/local.
- [Repeated clicks on the same airport re-fetch the same image] → Mitigate with a simple in-memory `Map<name, result>` cache for the session (module-level in the popup helper), avoiding redundant requests without needing a persistent cache layer.
- [Canvas-based SVG rasterization only works client-side, after `Image.onload` fires — icon images must be registered before the airports layer is (re)added on every `style.load`, same lifecycle constraint `addCustomLayers` already has for other sources] → Mitigate by loading/caching the rasterized `ImageData` once (module-level or ref) and calling `map.addImage` synchronously on every `style.load`/`load`, matching the existing idempotent-add pattern in `layers.ts`.
- [`Intl.DisplayNames` region names don't perfectly match OurAirports' `iso_country` codes for a handful of non-standard entries in the dataset — e.g. `"XK"` (Kosovo, not real ISO 3166-1) or other OurAirports-specific codes] → Fall back to displaying the raw `iso_country` code when `Intl.DisplayNames` returns `undefined`/the same code back.
- [`flag-icons` covers ISO 3166-1 alpha-2 codes; a handful of OurAirports-specific `iso_country` values in the dataset aren't real ISO codes (e.g. `"XK"` for Kosovo) and may have no matching flag file in the package] → Mitigate by falling back to no flag image (or a generic placeholder) when the package has no asset for a given code, mirroring the country-name fallback.
- [Rasterized icon can look soft/aliased at high zoom if not generated at sufficient resolution] → Mitigate by rendering the canvas at a fixed higher pixel size (e.g. 64–128px) and passing `pixelRatio: 2` to `addImage`, rather than rasterizing at the SVG's native small viewBox size.

## Migration Plan

- No data migration. Purely additive/replacement UI logic in `components/map/layers.ts` and `components/map/MapView.tsx`, plus new small helper modules. No feature flag — ships directly since it only changes how the existing airports layer looks and behaves (still opt-out via the new toggle).
- Rollback: revert the layer-definition and click-handler changes; the underlying `airports.geojson` source is untouched.

## Open Questions

None outstanding. Previously open, now confirmed by the user:
- Airports toggle defaults to **visible** (matches military bases' `militaryVisibleRef = true` default, and airports being visible today).
- Cursor-pointer-on-hover is **included** in this change.

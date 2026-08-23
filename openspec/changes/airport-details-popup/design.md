## Context

Airports currently render via a `circle` layer (`AIRPORTS_LAYER_ID` in `components/map/layers.ts`) filled with a single hardcoded color and a theme-dependent halo stroke (`haloColorFor`). There's no click interactivity anywhere on the map yet — `MapView.tsx` only wires button-driven toggles (theme, pilot mode, military bases, locate-me), no `map.on("click", ...)`. The military-bases layer already establishes the toggle pattern (ref + state + `setXVisibility` helper in `layers.ts`) this change should mirror for airports.

MapLibre `symbol` layers render `icon-image` from images registered via `map.addImage(id, ImageData | HTMLImageElement | ...)` — they can't reference an SVG file directly. `atc.svg` must be rasterized (via `<canvas>` + `Image`/`createImageBitmap`, browser-only) into one or more themed bitmaps up front.

## Goals / Non-Goals

**Goals:**
- Replace the airport circle marker with an `atc.svg`-derived symbol icon, recolored so the icon's own fill matches the current per-view airport accent color and any negative space in the glyph is opaque white (not transparent/see-through to the basemap).
- Add a dedicated airports visibility toggle, following the existing military-bases toggle pattern exactly (ref + React state + `setAirportsVisibility` in `layers.ts` + button in `MapView.tsx`).
- Add click-to-popup on airport icons: IATA code, ICAO code, name, flag, city, country — using only fields already present in `public/data/airports.geojson` (`iata_code`, `icao_code`, `name`, `municipality`, `iso_country`) plus values derived from `iso_country` at click time.

**Non-Goals:**
- No new airport dataset fields, no network fetch for airport metadata — everything the popup shows is derived from the existing bundled GeoJSON.
- No generalized "popup framework" for other layers (military bases, etc.) — this only wires click/popup for airports.
- Not changing airport data at build time (no codegen step); flag/country-name derivation happens at render/click time from `iso_country`.

## Decisions

- **Icon rasterization**: Load `atc.svg` once per theme via `Image()` → draw to an offscreen `<canvas>` → recolor using `globalCompositeOperation: "source-in"` (fills the glyph's opaque pixels with the theme accent color) composited over a solid white backing layer sized to the glyph's bounding shape (fills negative space white) → `map.addImage("airport-icon-<theme>", imageData, { pixelRatio: 2 })`. Rationale: MapLibre symbol layers need a rasterized image, not live SVG DOM; canvas recoloring avoids maintaining hand-edited duplicate SVGs per theme and keeps a single source-of-truth `atc.svg`.
  - Alternative considered: pre-generate theme-specific SVG file variants at build time. Rejected — adds a build step / duplicate assets for a change that's just a fill-color swap, and the change requirement is explicitly about matching the *current view's* airport color at runtime.
- **Icon color source**: Reuse `AIRPORT_FILL_COLOR` (`components/map/layers.ts`) as the icon's foreground fill for both themes, since that's the "airport color" the layer already renders today. `haloColorFor(theme)` continues to determine any stroke/backing distinction between themes if kept.
  - Alternative considered: introduce new distinct per-theme accent colors. Rejected as unnecessary scope — the acceptance criteria says match the *existing* airport color per view, not invent a new palette.
- **Layer type swap, not overlay**: Replace the `circle` layer definition in place (same `AIRPORTS_LAYER_ID`, `type: "symbol"` instead of `type: "circle"`) rather than adding a second layer, so toggle/visibility logic and z-ordering stay simple.
- **Popup mechanism**: Use MapLibre's built-in `Popup` (already a `maplibre-gl` dependency, no new package), created in a `click` handler on `AIRPORTS_LAYER_ID`, closeButton default, anchored to the clicked feature's coordinates (not the cursor, to stay correct after any icon-anchor/offset tuning).
- **Flag rendering**: Build the two-letter regional-indicator emoji from `iso_country` (`String.fromCodePoint(...code.split("").map(c => 127397 + c.charCodeAt(0)))`) — matches the standard Unicode-flag-from-ISO-alpha-2 trick, needs no dependency, no image asset, no network request, renders anywhere emoji fonts are available.
  - Alternative considered: bundle flag SVG/PNG sprites (e.g. flag-icons). Rejected — adds an asset dependency for ~250 flags when the OS/browser can already render Unicode flag emoji, and the acceptance criteria doesn't require pixel-perfect flag art.
- **Country name rendering**: `new Intl.DisplayNames(["en"], { type: "region" }).of(iso_country)` — a native `Intl` API, no dependency, handles the full ISO 3166-1 alpha-2 set the dataset already uses.
- **Missing-code handling**: `iata_code`/`icao_code` are `null` for many features in the dataset (seen in a sample of the bundled GeoJSON). Popup renders an em dash (`—`) or omits the row when a code is null, rather than showing the literal string `"null"`.
- **Hover affordance**: Add `mouseenter`/`mouseleave` on `AIRPORTS_LAYER_ID` to toggle `map.getCanvas().style.cursor`, mirroring common MapLibre click-layer UX (not in the original acceptance criteria, but necessary for the layer to read as clickable — flagged in Open Questions in case reviewer wants it deferred).

## Risks / Trade-offs

- [Canvas-based SVG rasterization only works client-side, after `Image.onload` fires — icon images must be registered before the airports layer is (re)added on every `style.load`, same lifecycle constraint `addCustomLayers` already has for other sources] → Mitigate by loading/caching the rasterized `ImageData` once (module-level or ref) and calling `map.addImage` synchronously on every `style.load`/`load`, matching the existing idempotent-add pattern in `layers.ts`.
- [`Intl.DisplayNames` region names don't perfectly match OurAirports' `iso_country` codes for a handful of non-standard entries in the dataset — e.g. `"XK"` (Kosovo, not real ISO 3166-1) or other OurAirports-specific codes] → Fall back to displaying the raw `iso_country` code when `Intl.DisplayNames` returns `undefined`/the same code back.
- [Regional-indicator flag emoji render as two-letter text (e.g. "US") instead of a flag glyph on some platforms/fonts lacking emoji-flag support (notably some Linux/Chrome configurations)] → Accepted trade-off per the "no new dependency" goal; not mitigated in this change.
- [Rasterized icon can look soft/aliased at high zoom if not generated at sufficient resolution] → Mitigate by rendering the canvas at a fixed higher pixel size (e.g. 64–128px) and passing `pixelRatio: 2` to `addImage`, rather than rasterizing at the SVG's native small viewBox size.

## Migration Plan

- No data migration. Purely additive/replacement UI logic in `components/map/layers.ts` and `components/map/MapView.tsx`, plus new small helper modules. No feature flag — ships directly since it only changes how the existing airports layer looks and behaves (still opt-out via the new toggle).
- Rollback: revert the layer-definition and click-handler changes; the underlying `airports.geojson` source is untouched.

## Open Questions

- Should the airports toggle default to visible (matching military bases' `militaryVisibleRef = true` default) or hidden? Proposal assumes **visible by default**, consistent with military bases and with airports already being visible today.
- Should cursor-pointer-on-hover (not explicitly requested) be included as part of this change, or deferred? Design assumes **included**, since a click-only layer with no hover affordance is a poor discoverability UX.

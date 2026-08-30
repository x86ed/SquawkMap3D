## Why

The map already has a working light/dark theme mechanism — `getInitialTheme()`/`storeTheme()` (`components/map/theme.ts`), the `ThemeSlider` toggle, and a scoped set of CSS custom properties for both palettes (`components/map/drawer/DrawerTheme.module.css`'s `.scope[data-theme="dark"]`/`.scope[data-theme="light"]` token tables) — but it only reaches the top-right controls cluster and the right-hand `LayerDrawer`. Several other pieces of floating map UI predate that scope (or were added after it without being wired into it) and stay hardcoded to dark-theme colors regardless of the active theme:

- `ColorModeLegendDock`'s legend (`ColorModeLegend.module.css`) — the bottom-right "track/aircraft color indicator" the issue refers to (it recolors both aircraft icons and their track trails; the legend is its key).
- The aircraft details drawer's own chrome (`AircraftOverlay.module.css`'s `.drawer`) and three of its four child components — `RecordPanelHero` (the aircraft "airframe" identity/specs panel), `TelemetryMarquee` (the scrolling telemetry ticker), and `FlightInfoPane` (the altitude/ground-speed sparkline graph plus route/timeline).

In `components/map/MapView.tsx`, `drawerTheme.scope`+`data-theme={theme}` is applied only to the `<div>` wrapping the top-right `.controls` row and `<LayerDrawer>`; `AircraftOverlay`, `AircraftColorDock`, and `ColorModeLegendDock` are rendered as *siblings* of that div in the same outer container, not descendants of it — so none of them ever receive the scope's CSS custom properties (`--panel`, `--panel-2`, `--border`, `--text`, `--text-dim`, `--text-faint`, `--accent`, etc.), which only cascade down the DOM tree. Even where they are in scope, their own CSS modules hardcode literal dark-theme colors (`#f1f5f9`, `#64748b`, `rgba(63, 63, 70, 0.42)`, `rgba(27, 28, 33, 0.92)`, etc.) instead of referencing those tokens, so switching themes today visibly changes the top controls and layer drawer while leaving the color-mode legend and most of the aircraft details drawer frozen in the dark palette.

One component is a deliberate, correct exception: `PlaneCard` (`components/map/overlay/PlaneCard.module.css`) already colors itself entirely from its own `--rarity-*` custom properties, driven by the aircraft's rarity tier, not by the light/dark theme — this is the desired, existing behavior the acceptance criteria calls out to preserve, not a bug.

## What Changes

- Extend the existing `drawerTheme.scope`/`data-theme` mechanism (rather than inventing a second theming approach) to cover `ColorModeLegendDock` and `AircraftOverlay`, by moving where it's applied in `MapView.tsx` from the inner controls/drawer wrapper to the outermost wrapper `div` that's already an ancestor of every fixed-position map overlay (the same element that already carries the `--right-drawer-w` custom property for the `fix-drawer-relational-css` change) — so `--panel`, `--panel-2`, `--border`, `--border-strong`, `--text`, `--text-dim`, `--text-faint`, `--accent`, and `--shadow` cascade to every one of these components.
- Replace the hardcoded dark-only literal colors in `ColorModeLegend.module.css`, `AircraftOverlay.module.css`, `RecordPanelHero.module.css`, `TelemetryMarquee.module.css`, and `FlightInfoPane.module.css` with references to those now-reachable tokens, so each one visibly recolors when the theme toggles, matching the top controls/`LayerDrawer`'s existing light/dark palettes.
- Leave `PlaneCard.module.css` untouched — it already colors itself purely from rarity-tier data via its own `--rarity-*` properties, never from the theme scope, so it already satisfies "stays the same color regardless of light/dark" with no code change; this proposal adds a regression-guarding scenario to the spec so a future change doesn't accidentally wire it to the theme tokens.
- Leave the data-series stroke colors inside `FlightInfoPane`'s sparkline SVG (`#06b6d4` altitude / `#22c55e` ground speed, set in `FlightInfoPane.tsx`, not CSS-module literals) and `ColorModeLegend`'s `.rarityCard` text color (`#0a0a0a`, always sitting on top of a rarity-tier swatch color, not the legend's own panel background) unchanged — both are already legible against both palettes and aren't the map's own light/dark chrome.
- Out of scope: `AircraftColorDock`/`AircraftColorControl` (the bottom-left recenter + color-mode buttons) — not named in the acceptance criteria, and unaffected by the scope-widening change since their own CSS modules don't reference any theme token.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-color-mode-control`: the bottom-right color-mode legend now reflects the active light/dark theme instead of always rendering dark-theme colors.
- `aircraft-info-overlay`: the overlay's own chrome and its `RecordPanelHero`/`TelemetryMarquee`/`FlightInfoPane` components now reflect the active light/dark theme; `PlaneCard`'s rarity-tier-driven styling explicitly does not.

## Impact

- `components/map/MapView.tsx`: `drawerTheme.scope` className and `data-theme={theme}` move to (or are additionally applied on) the outermost wrapper `div`, so `AircraftOverlay`, `AircraftColorDock`, and `ColorModeLegendDock` become descendants of the theme scope.
- `components/map/overlay/ColorModeLegendDock.module.css` / `ColorModeLegend.module.css`: literal panel/border/text colors replaced with `var(--panel)`/`var(--border)`/`var(--text)`/`var(--text-dim)` etc.
- `components/map/overlay/AircraftOverlay.module.css`: `.drawer`'s literal gradient/border/text colors replaced with theme tokens.
- `components/map/overlay/RecordPanelHero.module.css`, `TelemetryMarquee.module.css`, `FlightInfoPane.module.css`: literal panel/border/text/accent colors replaced with theme tokens.
- No changes to `components/map/overlay/PlaneCard.module.css`, `PlaneCard.tsx`, `components/map/controls/AircraftColorDock.module.css`, `AircraftColorControl.module.css`, or any color-mode/rarity/track-coloring logic (`aircraftIcons.ts`, `aircraft-rarity` data) — this is purely a CSS/theme-token-wiring fix for UI chrome that already exists.

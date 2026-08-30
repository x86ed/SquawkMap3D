## 1. Widen the theme scope

- [x] 1.1 In `components/map/MapView.tsx`: apply `drawerTheme.scope` (already imported as `drawerTheme` from `./drawer/DrawerTheme.module.css`) to the `className` of the outermost wrapper `<div>` (the one currently `className={styles.container}` with the `--right-drawer-w` inline style, ~line 1051-1054), and add `data-theme={theme}` alongside it. Leave the existing inner `<div className={drawerTheme.scope} data-theme={theme}>` (wrapping `.controls` + `<LayerDrawer>`, ~line 1056) unchanged.
- [x] 1.2 Add a one-line comment on `DrawerTheme.module.css`'s `.scope` rule noting it must stay properties-only (no layout/paint declarations) now that it's applied to the outermost wrapper (design.md's flagged risk).
- [x] 1.3 `npx tsc --noEmit` — confirm the added className/attribute introduce no type errors.

## 2. Theme the color-mode legend (lower-right track/aircraft color indicator)

- [x] 2.1 In `components/map/overlay/ColorModeLegend.module.css`: replace `.legend`'s `background: rgba(27, 28, 33, 0.92)` with `var(--panel)`, `border: 1px solid rgba(63, 63, 70, 0.42)` with `var(--border)`, and `color: #f1f5f9` with `var(--text)`.
- [x] 2.2 Update `.gaugeCutout`'s `background` to the same token `.legend` now uses, preserving the "matches `.legend`'s own background exactly" seam noted in that rule's existing comment.
- [x] 2.3 Replace `.tickRow`'s `color: rgba(241, 245, 249, 0.75)` with `var(--text-dim)` (or an equivalent reduced-opacity derivation of `var(--text)`, matching this file's existing contrast level in dark mode).
- [x] 2.4 Leave `.rarityCard`'s `color: #0a0a0a` unchanged (design.md Decision 2 — it sits on the rarity tier's own swatch color, not the panel background).
- [x] 2.5 Manually verify all three legend variants (rarity row, altitude gradient bar, airspeed gauge) in both themes.

## 3. Theme the aircraft details drawer's own chrome

- [x] 3.1 In `components/map/overlay/AircraftOverlay.module.css`: replace `.drawer`'s `color: #f1f5f9` with `var(--text)`, its `background: linear-gradient(180deg, #29292d, #111216 62%, #1b1c21)` with a theme-driven gradient built from `var(--panel)`/`var(--panel-2)`, and its `border-top: 1px solid rgba(63, 63, 70, 0.42)` with `var(--border)`.
- [x] 3.2 Replace `.dragHandle:hover .dragHandleGrip`/`.dragHandle:focus-visible .dragHandleGrip`'s `background: rgba(226, 232, 240, 0.6)` and `.dragHandleGrip`'s `background: rgba(148, 163, 184, 0.35)` with theme-derived equivalents (e.g. `var(--text)`/`var(--text-dim)` at reduced opacity via `color-mix`, matching the precedent already used in `PlaneCard.module.css`'s `color-mix(in srgb, var(--rarity-color) 30%, transparent)`).

## 4. Theme RecordPanelHero (the "airframe" identity/specs panel)

- [x] 4.1 In `components/map/overlay/RecordPanelHero.module.css`: replace `.panel`'s background/border, `.tab`'s color/background/borders, `.iconBlock`/`.photoBlock`'s borders, `.iconBlock`'s background/color, and the portrait-variant border rules with the matching `var(--panel)`/`var(--border)`/`var(--text-dim)` tokens per design.md's mapping table.
- [x] 4.2 Replace `.photoCaption`'s `color: #f8fafc`/`background: rgba(2, 6, 23, 0.75)`, `.heading`'s `color: #f1f5f9`, and its hover/focus-visible `color: #22d3ee` with `var(--text)`/`var(--panel-2)`(or an appropriately dark/light-adjusted overlay tint)/`var(--accent)` respectively.
- [x] 4.3 Replace `.kicker`, `.subline`, `.specLabel`'s `color: #64748b` and `.heading`/`.specValue`'s `color: #f1f5f9` with `var(--text-dim)`/`var(--text)`, and `.specGrid`/`.specCell`'s borders with `var(--border)`.

## 5. Theme TelemetryMarquee

- [x] 5.1 In `components/map/overlay/TelemetryMarquee.module.css`: replace `.marquee`'s `color: #cbd5e1` with `var(--text-dim)`, `.k`'s `color: #64748b` with `var(--text-dim)` or `var(--text-faint)`, `.v`'s `color: #f1f5f9` with `var(--text)`, and `.dot`'s `color: #06b6d4` with `var(--accent)`.
- [x] 5.2 Confirm the `-webkit-mask-image`/`mask-image` edge-fade gradient (uses opaque `#000`/`transparent` purely as a luminance mask, not a themed color) is left unchanged.

## 6. Theme FlightInfoPane (sparkline graph + route/timeline)

- [x] 6.1 In `components/map/overlay/FlightInfoPane.module.css`: replace `.pane`'s background/border, `.sparklineLegendItem`/`.axisColumn`/`.noDataState`/`.routeArrow`'s `color: #64748b` with `var(--text-dim)`, `.routeEndpoints`'s `color: #f1f5f9` with `var(--text)`, `.routeTimeline`'s `color: #94a3b8` with `var(--text-dim)`, and `.routeBand`'s `border-top` with `var(--border)`.
- [x] 6.2 Confirm `FlightInfoPane.tsx`'s `SPARKLINE_SERIES` inline colors (`#06b6d4` altitude / `#22c55e` ground speed) remain legible against both `var(--panel)` backgrounds — no code change expected, verify visually (design.md Decision 2).

## 7. Verification

- [x] 7.1 Manually toggle `ThemeSlider` with an aircraft selected and the right-hand layer-control drawer open: confirm `ColorModeLegendDock`'s legend, `AircraftOverlay`'s own chrome, `RecordPanelHero`, `TelemetryMarquee`, and `FlightInfoPane` all visibly shift between the light and dark palettes, matching the top controls/`LayerDrawer`'s existing palettes.
- [x] 7.2 Manually confirm `PlaneCard` renders pixel-identically in both themes for the same selected aircraft (no change expected from this proposal).
- [x] 7.3 Manually confirm `AircraftColorDock`'s two buttons and their color-mode popup (`AircraftColorControl`) are visually unchanged by this proposal.
- [x] 7.4 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean.

## Context

`components/map/drawer/theme.ts` (`getInitialTheme`/`storeTheme`/`getSystemTheme`) and `ThemeSlider.tsx` already implement a full light/dark toggle, persisted to `localStorage` under `squawkmap3d:theme`. The palette itself lives in `components/map/drawer/DrawerTheme.module.css`'s `.scope[data-theme="dark"]` / `.scope[data-theme="light"]` rules — a self-contained set of CSS custom properties (`--panel`, `--panel-2`, `--border`, `--border-strong`, `--text`, `--text-dim`, `--text-faint`, `--accent`, `--accent-glow`, `--accent-ink`, `--green`, `--amber`, `--red`, `--purple`, `--track-off`, `--row-hover`, `--row-alt`, `--scrollbar`, `--shadow`), deliberately scoped to a wrapping element (`.scope`) rather than the global `:root`, per that file's own header comment, "so they can't leak into or collide with any other component's styling."

In `MapView.tsx`'s render tree, that scope class + `data-theme={theme}` is applied to one specific `<div>` (line ~1056) that wraps only the top-right `.controls` row and `<LayerDrawer>`. Three other pieces of always-mounted, fixed-position map UI are siblings of that div inside the same outer container, not descendants of it:

- `<AircraftOverlay>` — the bottom drawer shown on aircraft selection.
- `<AircraftColorDock>` — the bottom-left recenter + color-mode buttons.
- `<ColorModeLegendDock>` — the bottom-right color-mode legend (this issue's "track/aircraft color indicator").

CSS custom properties only cascade to DOM descendants of the element that declares them, regardless of each element's own `position` value — so none of these three ever see `--panel`/`--text`/etc. today, no matter what `theme` currently is. Compounding this, even where a component *is* correctly scoped (e.g. everything inside `<LayerDrawer>`), several of the overlay's own components — `RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane`, and `ColorModeLegend` — were written with hardcoded dark-palette literal colors (`#f1f5f9`, `#64748b`, `rgba(63, 63, 70, 0.42)`, `rgba(27, 28, 33, 0.92)`, the `.drawer`'s `linear-gradient(180deg, #29292d, #111216 62%, #1b1c21)`, etc.) instead of referencing the scope's tokens at all, so simply bringing them into scope wouldn't by itself change anything visually.

One component, `PlaneCard`, is the deliberate exception the acceptance criteria calls out: `PlaneCard.module.css` colors itself entirely via its own locally-scoped `--rarity-color`/`--rarity-highlight`/`--rarity-glow` custom properties, set per rarity-tier variant (`.tierStandard`, `.tierMythic`, etc.) and never referencing any `DrawerTheme.module.css` token. It renders correctly today regardless of theme purely because nothing in it reads a theme token — this is already the desired end state, not something to build.

## Goals / Non-Goals

**Goals:**
- `ColorModeLegendDock`'s legend (all three variants: rarity row, altitude bar, airspeed gauge) visibly recolors between the light and dark palettes when the user toggles `ThemeSlider`, matching the palette already used by the top controls/`LayerDrawer`.
- `AircraftOverlay`'s own chrome, plus its `RecordPanelHero` ("airframe"), `TelemetryMarquee`, and `FlightInfoPane` (sparkline graph) child components, do the same.
- `PlaneCard` continues to render pixel-identically regardless of the active theme — verified by an explicit spec scenario, not just left alone by omission.
- Reuse the existing `drawerTheme.scope`/token mechanism exactly as-is (same token names, same light/dark value tables) — no second theme system, no new persisted state, no change to `theme.ts`/`ThemeSlider.tsx`.

**Non-Goals:**
- `AircraftColorDock`/`AircraftColorControl` (bottom-left buttons and their color-mode popup) — not named in the acceptance criteria; left untouched (see Decision 3).
- Any change to what determines aircraft icon/track colors (`aircraft-color-mode-control`'s rarity/altitude/airspeed gradients) — those are data-driven, not theme-driven, and are explicitly unaffected.
- Any change to `PlaneCard`'s rarity-driven coloring logic or its `--rarity-*` values.
- Redesigning any of these components' layouts, typography scale, or responsive behavior — this is a color-token substitution within existing structure.

## Decisions

### Decision 1: Move `drawerTheme.scope` + `data-theme` to the outermost `MapView.tsx` wrapper, not a new scope per component
`MapView.tsx` already computes one value once and applies it as an inline custom property on its outermost wrapper `<div>` so every fixed-position descendant can read it: `--right-drawer-w` (added by the `fix-drawer-relational-css` change, `style={{ "--right-drawer-w": ... } as CSSProperties}` at the top-level `<div className={styles.container}>`). This proposal does the same thing for the theme scope: add `drawerTheme.scope` to that same outermost `<div>`'s `className` and `data-theme={theme}` alongside it.

```tsx
<div
  className={`${styles.container} ${drawerTheme.scope}`}
  data-theme={theme}
  style={{ "--right-drawer-w": `${rightDrawerOccupiedWidth}px` } as CSSProperties}
>
  <div ref={containerRef} className={styles.container} />
  <div className={drawerTheme.scope} data-theme={theme}>
    {/* existing controls + LayerDrawer — unchanged */}
  </div>
  <AircraftOverlay ... />
  <AircraftColorDock ... />
  <ColorModeLegendDock ... />
</div>
```

The existing inner `drawerTheme.scope`/`data-theme` div (wrapping the controls + `LayerDrawer`) is left exactly as-is rather than removed: it's harmless redundancy (the same custom properties, re-declared with the same value, on a nested element — CSS custom-property re-declaration is not a conflict), and removing it would mean unwrapping that JSX subtree into a `<>` fragment for zero behavioral benefit. `containerRef`'s own map-canvas `<div>` also becomes a descendant of the new outer scope; this is inert for it too, since `.scope`'s only rules are custom-property declarations (no layout/paint properties), and the MapLibre canvas's own light/dark appearance is already driven separately by `getStyleUrl(themeRef.current)` (the light/dark MapLibre style URL), not by these CSS tokens.

Deliberately not creating a *third*, independent scope wrapper around just `AircraftOverlay`/`ColorModeLegendDock`: that would duplicate the token tables a second time (`DrawerTheme.module.css`'s `.scope[data-theme=...]` rules would need to be applied twice, once per wrapper) for no benefit over widening the one wrapper that's already an ancestor of everything.

### Decision 2: Map each hardcoded literal to the closest existing `DrawerTheme.module.css` token; don't add new tokens
Rather than introduce new custom properties, every literal color touched by this change maps onto a token `DrawerTheme.module.css` already defines for both themes:

| Literal today | Found in | Token |
|---|---|---|
| `rgba(255, 255, 255, 0.03)` / `rgba(27, 28, 33, 0.92)` panel tints, `.drawer`'s dark gradient stops | `FlightInfoPane`, `RecordPanelHero`, `ColorModeLegend`, `AircraftOverlay` | `var(--panel)` / `var(--panel-2)` |
| `rgba(63, 63, 70, 0.42)` borders | all five files | `var(--border)` |
| `#f1f5f9`, `#f8fafc` (bright/primary text) | all five files | `var(--text)` |
| `#64748b`, `#94a3b8`, `#cbd5e1` (dim/secondary text) | all five files | `var(--text-dim)` (or `--text-faint` for the smallest kicker/label text, matching `DrawerTheme`'s own three-tier text scale) |
| `#22d3ee` (hover accent) | `RecordPanelHero` | `var(--accent)` |
| `rgba(2, 6, 23, ...)` box-shadow tints | `AircraftOverlay`, `ColorModeLegend` | left as literal opacity-only shadow darkening layered on top of `var(--shadow)`, or replaced by `var(--shadow)` outright where the existing rule is a single flat shadow — decided per call site during implementation, since `--shadow` is a full box-shadow value (not a bare color) in both palettes and some of these rules compose two shadow layers |

`.gaugeCutout` (`ColorModeLegend.module.css`) must keep matching `.legend`'s own background exactly (per its own existing comment) — both get the same `var(--panel)` (or whichever single token `.legend` ends up using), preserving that seam-free look in both themes rather than just in dark.

Two literal colors are deliberately left unchanged:
- `ColorModeLegend.module.css`'s `.rarityCard { color: #0a0a0a; }` — this is dark text sitting on top of that specific rarity tier's own bright/saturated swatch color (a hardcoded per-tier constant, unrelated to the app's light/dark theme), not text against the legend panel's own background.
- `FlightInfoPane.tsx`'s inline sparkline series colors (`#06b6d4` altitude, `#22c55e` ground speed, in the `SPARKLINE_SERIES` array, not a CSS-module literal) — these are semantic data-series colors (this line vs. that line), already saturated enough to read against both `var(--panel)` backgrounds, and changing them would decouple the swatch-in-legend from the line-in-chart pairing the component already establishes.

### Decision 3: `AircraftColorDock`/`AircraftColorControl` are explicitly out of scope
The acceptance criteria names only "the track/aircraft color indicator in the lower right" (`ColorModeLegendDock`) and "the plane drawer" (`AircraftOverlay` and its children) — it does not mention the bottom-left two-button control or its color-mode popup. `AircraftColorDock.module.css` and `AircraftColorControl.module.css` are not touched by this change. Decision 1's scope-widening does make the theme tokens newly *reachable* by these components (they're descendants of the same outer wrapper), but since neither file references any `DrawerTheme.module.css` token, this is inert — verified as an explicit manual-check task rather than left as an unstated assumption.

### Decision 4: `PlaneCard` gets a regression-guarding spec scenario, not a code change
`PlaneCard.module.css` already satisfies the acceptance criteria as-is (Context). This proposal's `aircraft-info-overlay` spec delta adds an explicit scenario asserting `PlaneCard`'s rendered colors don't change when the theme toggles, so a future change to `PlaneCard.module.css` or the theme scope that accidentally wires rarity styling to `--panel`/`--text` would be a spec violation, not just an unnoticed regression.

## Risks / Trade-offs

- Manually retuning dim-text/border opacities per theme (Decision 2's `#64748b`-family literals → `var(--text-dim)`/`--text-faint`) is a per-call-site judgment call, not a mechanical find-replace, since the existing light-theme token values (`DrawerTheme.module.css`'s `.scope[data-theme="light"]`) were tuned for the controls/drawer's own layout density, not necessarily for the marquee/sparkline's tighter, higher-contrast-dependent typography — implementation should visually verify legibility in both themes rather than trust the mapping table blindly.
- Widening the theme scope to the outermost wrapper (Decision 1) also brings the MapLibre canvas `<div>` (`containerRef`) into the scope's subtree; confirmed inert today (Decision 1's last paragraph), but any future addition of paint/layout rules to `.scope` itself (versus just custom-property declarations) would then also apply to the map canvas wrapper unintentionally — worth a one-line comment in `DrawerTheme.module.css` noting `.scope` must stay properties-only given how broadly it's now applied.

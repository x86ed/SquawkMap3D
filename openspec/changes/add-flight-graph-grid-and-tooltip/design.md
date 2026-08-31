## Context

`FlightInfoPane.tsx` (part of the `aircraft-info-overlay` capability, one of the overlay's four components per that spec's "composed of four independent components" requirement) renders `OverlaySparkline`: a single shared `<svg viewBox="0 0 240 60" preserveAspectRatio="none">` with two overlapping `<polyline>`s (altitude, ground speed), each plotted against its own independently-computed domain (`computeDomain`) and labeled by its own axis-tick column (`axisTicks`) to the left/right of the plot. There is currently no gridline rendering and no pointer-event handling on the chart at all — it's a pure, non-interactive SVG built fresh on every render from props.

Two existing sibling patterns anchor this design:
- `AircraftHoverTooltip.tsx`/`.module.css` — this app's one existing hover-tooltip precedent: a small `position: fixed`, `pointer-events: none` dark box that follows the cursor, shown/hidden by the caller based on deck.gl `onHover` picking state. This proposal's tooltip reuses that visual style (dark rounded box, bold primary line + secondary line) but not its positioning strategy (see Decision 4).
- `sparklinePoints()`'s own doc comment, which already documents that each series is drawn with **evenly index-spaced** x-positions (`index / (series.length - 1) * SPARKLINE_WIDTH`), not timestamp-spaced — a pre-existing simplification this proposal does not change (see Decision 3).

## Goals / Non-Goals

**Goals:**
- Per-axis gridlines (altitude: faint blue lines; ground speed: green dots) at each axis's existing tick values, so a viewer can read a specific deviation in the track against a real scale.
- Gridlines dynamically rescale exactly in step with each axis's own label column whenever that axis's domain grows (a single shared source of truth, not two things to keep in sync).
- Mouse-hover tooltip showing both series' values at the hovered x position, plus a visual on-chart indicator of where those values came from.
- No new npm dependency; stay within the existing hand-rolled inline-SVG approach.

**Non-Goals:**
- Touch/tap support for the hover interaction. The acceptance criteria's own wording ("mousing over the lines") scopes this to mouse pointer events; a tap-to-pin-tooltip mobile affordance is a plausible future follow-up, not addressed here.
- Re-deriving `sparklinePoints`'s existing index-based (rather than timestamp-based) x-spacing for either line. That's a pre-existing simplification of the chart this proposal builds on top of, not a bug this change is scoped to fix (see Decision 3's accepted limitation).
- A shared/synchronized crosshair between `FlightInfoPane`'s sparkline and any other chart or map element — this is a self-contained interaction local to this one component.
- Keyboard/focus-driven access to the same hover data (e.g. arrow-key scrubbing). Not requested by the acceptance criteria; out of scope.

## Decisions

### 1. Single source of truth for tick values: reuse `computeDomain`/`axisTicks`, extract `valueToY`
Both new grids are built from the exact same `domains[i]` and `axisTicks(domains[i], tickCount)` calls `OverlaySparkline` already makes to render each axis's label column — no separate "grid domain" or "grid ticks" computation. This is what makes "dynamically scale the grids with the changes to the y axis" (the acceptance criteria's own wording) automatic rather than something to implement: whenever `computeDomain` grows a domain (an aircraft's observed peak altitude/speed exceeds the current default max), the very next render recomputes both that axis's tick *labels* and its grid *rows* from the same numbers, so they can never desync.

To guarantee the grid rows land at the exact same pixel `y` as the polyline's own vertices for that value (not a visually-close-but-distinct computation), `sparklinePoints`'s inline `y = SPARKLINE_HEIGHT - ((clamped - domainMin) / range) * SPARKLINE_HEIGHT` math is extracted into a standalone helper:

```ts
function valueToY(value: number, [domainMin, domainMax]: [number, number]): number {
  const clamped = Math.min(domainMax, Math.max(domainMin, value));
  return SPARKLINE_HEIGHT - ((clamped - domainMin) / (domainMax - domainMin)) * SPARKLINE_HEIGHT;
}
```

`sparklinePoints` calls this per point; grid-row rendering calls it once per tick value; hover-marker rendering (Decision 4) calls it for the hovered value on each series. One function, three call sites, no drift possible between the line, its grid, and its hover marker.

### 2. Grid styling is data-driven on `SPARKLINE_SERIES`, reusing each axis's own legend color
`SPARKLINE_SERIES` gains two fields per entry:

```ts
gridColor: string;         // e.g. "rgba(6, 182, 212, 0.22)" for altitude, "rgba(34, 197, 94, 0.55)" for ground speed
gridStyle: "line" | "dots";
```

Both values are derived from that series' own already-established `color` (altitude's cyan `#06b6d4`, ground speed's green `#22c55e`) rather than introducing an unrelated new palette entry — this directly satisfies the acceptance criteria's explicit colors ("faint blue" for altitude, reusing its own cyan/blue swatch at low alpha; "green" for ground speed, reusing its own green swatch) while keeping the grid's color legible as "belonging to" its axis's existing legend swatch. `gridStyle` is `"line"` for altitude (a continuous faint horizontal stroke per tick) and `"dots"` for ground speed (discrete circle markers per tick, at a fixed x-spacing — new constant `SPARKLINE_GRID_DOT_SPACING`, e.g. `12` viewBox units). Rendering a *literal* row of dots, not a dashed/dotted line, is a deliberate reading of the acceptance criteria's own wording ("a grid of green dots"), and it has the added benefit of making the two grids visually distinguishable from each other by shape, not only by color/opacity — useful since both series share the same plot area.

- **Alternative considered (rejected)**: a single generic gridline style (e.g. both faint horizontal lines, just different colors). Rejected because the acceptance criteria explicitly calls for two different visual treatments ("lines" vs "dots"), and a shared treatment would make it harder to tell which faint mark belongs to which axis when both grids are visible at once over the same 60-unit-tall plot.

### 3. Hover cursor resolves against whichever series has more points; the other series is matched by nearest timestamp
Because `sparklinePoints` spaces each series' points evenly by **index** (not by timestamp — ground-speed points with an `undefined` value are filtered out entirely in `buildSelectedAircraftInfo`, so its array can have fewer points / different gaps than altitude's unfiltered array), there is no single shared x-axis both lines' pixel columns agree on today. This proposal does not change that (Non-Goals) — it works with it:

- On `mousemove`, the raw cursor position is converted to a `hoverFraction` (`0..1`) via the hovered `<svg>` element's own `getBoundingClientRect()` (a `ref`), not the viewBox's internal units — this correctly accounts for the SVG's actual rendered (responsive, `cqmin`-driven) size.
- The **reference series** for that hover is whichever of `altitudeSeries`/`groundSpeedSeries` has the most points (`length` comparison) — the one whose line, being denser, is more likely what the user is actually pointing at, and, more importantly, whose index-to-pixel mapping is `sparklinePoints`'s own, so resolving `cursorIndexFromFraction(referenceSeries.length, hoverFraction)` and reading `referenceSeries[cursorIndex]` lands the crosshair and that series' hover marker exactly on that series' own rendered vertex — no approximation for the reference series.
- The **other series'** hovered value is found via `nearestPointByTimestamp(otherSeries, referencePoint.timestamp)` — a nearest-neighbor scan by `timestamp`, since there's no shared index space to reuse. Both new helpers are plain, exported, pure functions (`FlightInfoPane.tsx`):

```ts
export function cursorIndexFromFraction(length: number, fraction: number): number | null {
  if (length === 0) return null;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * (length - 1));
}

export function nearestPointByTimestamp(series: SparklinePoint[], timestamp: number): SparklinePoint | undefined {
  if (series.length === 0) return undefined;
  return series.reduce((closest, point) =>
    Math.abs(point.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp) ? point : closest
  );
}
```

- **Known limitation, accepted**: the "other" series' hovered value is not guaranteed to sit at the exact same pixel column as its own line's nearest vertex (only the reference series gets that exact alignment) — a direct consequence of the pre-existing index-based x-spacing this proposal doesn't touch. In practice the retained track buffer polls frequently enough (see `aircraft.ts`'s poll interval) that any single hover's nearest-timestamp match is visually indistinguishable from "the same moment," so this is judged acceptable rather than worth a larger, unrelated rework of both lines' x-positioning to a shared timestamp domain.
- **Alternative considered (rejected)**: re-deriving both lines' x-positions from a shared timestamp domain (interpolating each series across the full track's time span) so hover is exact for both series always. Rejected as out of scope — it would change the existing, already-shipped visual spacing of both lines (a larger, unrelated change to `sparklinePoints`'s established behavior), not something the acceptance criteria asks for.

### 4. Tooltip: reuse `AircraftHoverTooltip`'s visual style, but `position: absolute` within a new local wrapper, not `position: fixed`
`AircraftHoverTooltip` is `position: fixed` because it follows the cursor over the full-viewport map, positioned from deck.gl's screen-space picking coordinates. `FlightInfoPane`'s chart is a small, non-full-viewport element inside a drawer panel — its tooltip is instead `position: absolute` inside a new `.sparklineSvgWrap` wrapper `div` (a thin `position: relative` box around just the `<svg>`, distinct from the existing `.sparklineRow` which also contains the two axis-label columns), positioned via `left: ${hoverFraction * 100}%` — consistent with `hoverFraction` already being relative to the SVG's own rendered box. `pointer-events: none` on the tooltip itself (matching `AircraftHoverTooltip`'s own rule), so it never itself interferes with `mousemove`/`mouseleave` on the underlying hit-target.

- **Hit target**: a transparent `<rect x="0" y="0" width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} fill="transparent" />` is added as the **last** child of the `<svg>` (so it paints on top of both polylines and both grids without visually obscuring them) carrying the `onMouseMove`/`onMouseLeave` handlers — this guarantees hover works anywhere in the plot area, not only when the cursor is precisely over a 2px-wide stroke (the acceptance criteria's own "mousing over the lines" is read generously as "mousing over the chart," matching how every other hover-affordance in this app, e.g. `AircraftHoverTooltip`'s own aircraft-icon hit target, is a generously-sized target rather than a pixel-exact one).
- **Crosshair/markers**: a vertical `<line>` at the reference series' cursor x, plus a small `<circle>` on each series' own line at its resolved hovered value's `(x, y)` (reference series: its own index's x; other series: the reference's x, at the other series' `valueToY` — accepting Decision 3's known approximation for the marker's exact data alignment, not its drawn position, which intentionally sits on the shared crosshair column for visual clarity).

### 5. No new npm dependency; state stays local to `OverlaySparkline`
`hoverFraction: number | null` is local `useState` inside `OverlaySparkline`, not lifted to `FlightInfoPane` or any shared/global state — nothing outside this one chart needs to know about hover. No `'use client'` directive is newly required: sibling overlay components (`RecordPanelHero`, `TelemetryMarquee`, `AircraftOverlay`) already use `useState`/`useRef` without their own directive, inheriting the client boundary already established higher up the tree (`MapView.tsx`'s `"use client"`), so `FlightInfoPane.tsx` follows the same already-established pattern.

## Risks / Trade-offs

- **[Trade-off] Hover accuracy for the non-reference series** is nearest-timestamp, not pixel-exact (Decision 3) — accepted, see that decision's own note on why this doesn't warrant a larger rework of the existing chart's x-spacing.
- **[Risk] Visual density**: two grids plus two lines plus (while hovering) a crosshair and two markers, all inside one small `60`-unit-tall plot, risks looking cluttered at small rendered sizes (e.g. the narrow-viewport stacked layout). *Mitigation*: low alpha on both `gridColor` values and a modest `SPARKLINE_GRID_DOT_SPACING`/dot radius, tuned visually during implementation against the app's actual narrow/wide layouts (same "left to implementation to tune visually" precedent as `actual-range-outline`'s sweep-wedge styling constants).
- **[Trade-off] No touch support** (Non-Goals) — acceptable per the acceptance criteria's own "mousing over" scoping; flagged plainly rather than silently omitted.

## Migration Plan

Purely additive to one existing component's rendering/interaction — no data-model changes (`SelectedAircraftInfo`/`buildSelectedAircraftInfo` untouched), no new files besides the new test file, no new dependencies. Rollback is reverting `FlightInfoPane.tsx`/`.module.css` to their pre-change state; nothing else depends on the new gridlines/hover behavior existing.

## Open Questions

- Exact `gridColor` alpha values, `SPARKLINE_GRID_DOT_SPACING`, and dot radius are left to implementation to tune visually against a real selected aircraft's chart, same as this codebase's established precedent (e.g. `actual-range-outline`'s sweep-wedge styling constants) for values that are easier to get right by eye than to prescribe exactly here.

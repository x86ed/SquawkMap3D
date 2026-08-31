## 1. Shared pixel-mapping helper

- [x] 1.1 In `components/map/overlay/FlightInfoPane.tsx`, extract the inline `y = SPARKLINE_HEIGHT - ((clamped - domainMin) / range) * SPARKLINE_HEIGHT` math out of `sparklinePoints()` into a standalone `valueToY(value: number, domain: [number, number]): number` function (see design.md Decision 1)
- [x] 1.2 Update `sparklinePoints()` to call `valueToY()` instead of its own inline math; confirm rendered line output is unchanged (same numeric `y` values)

## 2. Per-axis grid data and styling

- [x] 2.1 Add `gridColor: string` and `gridStyle: "line" | "dots"` fields to each `SPARKLINE_SERIES` entry: altitude gets a low-alpha version of its own `#06b6d4` (e.g. `rgba(6, 182, 212, 0.22)`) and `gridStyle: "line"`; ground speed gets a version of its own `#22c55e` (e.g. `rgba(34, 197, 94, 0.55)`) and `gridStyle: "dots"` (design.md Decision 2 — tune exact alpha visually per design.md's Open Questions)
- [x] 2.2 Add a `SPARKLINE_GRID_DOT_SPACING` constant (viewBox units, e.g. `12`) near `SPARKLINE_WIDTH`/`SPARKLINE_HEIGHT`
- [x] 2.3 Add a pure `buildGridRows(domain: [number, number], tickCount: number): number[]` (or reuse `axisTicks()` directly at the call site) returning the y-positions (via `valueToY`) for each tick — one row per tick value, shared by both grid styles
- [x] 2.4 In `OverlaySparkline`'s SVG, before the two `<polyline>`s (so lines/hover draw on top of the grid, not under it), render: for the altitude series (`gridStyle: "line"`) a `<line x1={0} x2={SPARKLINE_WIDTH}>` at each grid row's `y`, stroked with that series' `gridColor`; for the ground-speed series (`gridStyle: "dots"`) a row of `<circle>` elements spaced `SPARKLINE_GRID_DOT_SPACING` apart along `x` at each grid row's `y`, filled with that series' `gridColor`
- [x] 2.5 Gate each series' grid rendering on that series having `>= 2` points (same condition already gating that series' own polyline), so a series with insufficient data renders no grid rows either

## 3. Hover state and cursor-to-data mapping

- [x] 3.1 Add exported pure helpers in `FlightInfoPane.tsx`: `cursorIndexFromFraction(length: number, fraction: number): number | null` and `nearestPointByTimestamp(series: SparklinePoint[], timestamp: number): SparklinePoint | undefined` (design.md Decision 3, exact signatures/bodies given there)
- [x] 3.2 In `OverlaySparkline`, add `const [hoverFraction, setHoverFraction] = useState<number | null>(null)` and `const svgRef = useRef<SVGSVGElement | null>(null)`
- [x] 3.3 Add a transparent, full-plot-size `<rect>` as the **last** child of the `<svg>` (on top of both lines and both grids) with `onMouseMove`/`onMouseLeave` handlers: on move, compute `fraction = (event.clientX - svgRef.current.getBoundingClientRect().left) / svgRef.current.getBoundingClientRect().width`, clamp to `[0, 1]`, `setHoverFraction(fraction)`; on leave, `setHoverFraction(null)`
- [x] 3.4 Derive the reference series (`altitudeSeries.length >= groundSpeedSeries.length ? "altitude" : "groundSpeed"`), compute `cursorIndex = cursorIndexFromFraction(referenceSeries.length, hoverFraction)`, `referencePoint = cursorIndex !== null ? referenceSeries[cursorIndex] : null`, and `otherPoint = referencePoint ? (nearestPointByTimestamp(otherSeries, referencePoint.timestamp) ?? null) : null`

## 4. Hover visuals and tooltip

- [x] 4.1 When `hoverFraction !== null` and `referencePoint` is resolved, render a vertical `<line>` crosshair at the reference series' cursor `x` (`(cursorIndex / (referenceSeries.length - 1)) * SPARKLINE_WIDTH`), spanning `y=0` to `y=SPARKLINE_HEIGHT`, in a neutral/faint stroke color distinct from both grid colors
- [x] 4.2 Render a small `<circle>` marker on the reference series' own line at `(crosshair x, valueToY(referencePoint.value, referenceDomain))`, and, when `otherPoint` is resolved, a second marker at `(crosshair x, valueToY(otherPoint.value, otherDomain))` in the other series' color (design.md Decision 4's note on this marker's drawn position vs. its data alignment)
- [x] 4.3 Add a `.sparklineSvgWrap` wrapper `div` (`position: relative`) around just the `<svg>` element (distinct from the existing `.sparklineRow`, which also contains both axis-label columns) in `FlightInfoPane.module.css`
- [x] 4.4 Add a tooltip element inside `.sparklineSvgWrap`, shown only when `hoverFraction !== null`, positioned via `left: ${hoverFraction * 100}%`, `pointer-events: none`, styled per design.md Decision 4 (modeled on `AircraftHoverTooltip.module.css`'s dark rounded box / bold-line + secondary-line pattern, but `position: absolute` not `fixed`) — add corresponding classes (e.g. `.hoverTooltip`, `.hoverTooltipLine1`, `.hoverTooltipLine2`) to `FlightInfoPane.module.css`
- [x] 4.5 Tooltip content: altitude value (`${Math.round(referencePoint or otherPoint whichever is altitude).toLocaleString()} ft`) and ground-speed value (`${Math.round(...)} kt`); when a series has no resolvable point at all (`otherSeries.length === 0`), render an explicit placeholder (e.g. `"—"` or `"no data"`) for that value instead of omitting the line or fabricating a number

## 5. Tests

- [x] 5.1 Add `test/flightInfoPaneHover.test.ts` (pattern: `import test from "node:test"; import assert from "node:assert/strict";`, per `test/aircraftLayer.test.ts`) covering `cursorIndexFromFraction`: empty series (`length: 0` → `null`), single-point series (`length: 1` → always `0`), fraction `0`/`1`/mid-range clamping, and out-of-range fractions (negative, `>1`) clamped before rounding
- [x] 5.2 In the same file, cover `nearestPointByTimestamp`: empty series (`undefined`), exact timestamp match, nearest-below vs. nearest-above tie-breaking, and a single-point series always returning that point

## 6. Verification

- [x] 6.1 Manually verify against a real or simulated selected aircraft with both altitude and ground-speed history: altitude gridlines render as faint blue lines at the same y-positions as the altitude axis's tick labels; ground-speed gridlines render as green dots at the same y-positions as the ground-speed axis's tick labels
- [x] 6.2 Manually verify grid rows visibly reposition (staying aligned with their axis's tick labels) when an aircraft's altitude or ground speed grows past its current default domain max
- [x] 6.3 Manually verify hovering anywhere across the plot's width shows a tooltip with both altitude and ground-speed values, a crosshair, and value markers; verify the tooltip/crosshair disappear when the cursor leaves the chart
- [x] 6.4 Manually verify the "not enough data yet" state (fewer than two track points) still renders correctly, with no grid or hover affordance shown for the pane's empty state
- [x] 6.5 Manually verify the chart still renders and behaves correctly at both the wide multi-column overlay layout and the narrow stacked-column layout (per `aircraft-info-overlay`'s existing responsive-layout requirement)
- [x] 6.6 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean

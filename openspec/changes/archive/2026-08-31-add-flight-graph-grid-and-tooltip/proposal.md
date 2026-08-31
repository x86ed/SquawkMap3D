## Why

`FlightInfoPane` (`components/map/overlay/FlightInfoPane.tsx`) already renders a dual sparkline of the selected aircraft's recent altitude (cyan `#06b6d4`) and ground-speed (green `#22c55e`) history, each against its own dynamically-growing y-axis (`computeDomain`/`axisTicks`). With no gridlines and no hover interaction, it's hard to read exactly how much a value deviated at a given moment — you can see the line's general shape but can't line a bump in altitude up against a specific y-value or a specific moment against the ground-speed line. This change adds per-axis gridlines (so a wiggle in the track can be read against a scale, not just eyeballed) and a mouse-hover tooltip (so a specific point in the track can be inspected for its exact values) to that existing chart.

## What Changes

- Add a horizontal gridline row at each of the altitude axis's existing tick values (the same ticks `axisTicks` already computes for the left-hand axis-label column), rendered as faint blue lines spanning the plot width — reusing altitude's own already-established legend color (`#06b6d4`) at low opacity, so the grid reads as "that axis's own scale" rather than an unrelated new color.
- Add a horizontal row of green dots at each of the ground-speed axis's existing tick values, spanning the plot width at a fixed dot spacing — reusing ground speed's own already-established legend color (`#22c55e`), rendered as discrete dot markers (not a continuous line) so the two axes' grids stay visually distinguishable from one another at a glance, not just differently colored.
- Both grids are driven by the exact same `computeDomain`/`axisTicks` calls that already produce each axis's label column, so they dynamically rescale in lockstep with the axis labels whenever a series' observed peak grows its domain — no separate scaling logic to keep in sync.
- Add mouse-hover interaction over the sparkline's plotting area: moving the mouse over the chart shows a tooltip near the cursor with the altitude and ground-speed values at that horizontal (time) position, plus a vertical crosshair and small markers on the chart indicating exactly where those values were read from. The tooltip disappears when the cursor leaves the chart.
- Because the two series' points are spaced by index, not by timestamp (`sparklinePoints`'s existing per-index x-spacing, unchanged by this proposal), the hovered position resolves to an exact index on whichever series has more retained points (the "reference" series for that hover), and the other series' value is looked up by nearest timestamp — see design.md Decision 3 for why, and its accepted limitation.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `aircraft-info-overlay`: `FlightInfoPane`'s sparkline gains per-axis gridlines (scaling with each axis's own domain) and a mouse-hover tooltip showing the altitude/ground-speed values at the hovered x position. No other `aircraft-info-overlay` behavior (route/timeline, the other three overlay components, responsive layout, theming) changes.

## Impact

- `components/map/overlay/FlightInfoPane.tsx`: `SPARKLINE_SERIES` gains `gridColor` and `gridStyle` (`"line" | "dots"`) fields; a shared `valueToY(value, domain)` helper is extracted from `sparklinePoints`'s inline math and reused for gridline rows and hover markers so the line, its grid, and its hover indicator can never visually drift apart; new exported pure helpers `cursorIndexFromFraction(length, fraction)` and `nearestPointByTimestamp(series, timestamp)`; `OverlaySparkline` gains local hover state (`hoverFraction`), a `ref` on the `<svg>` for `getBoundingClientRect`-based cursor-to-fraction conversion, `onMouseMove`/`onMouseLeave` handlers, and renders the two grids, a crosshair, hover markers, and a tooltip.
- `components/map/overlay/FlightInfoPane.module.css`: new classes for the SVG's positioning wrapper (`.sparklineSvgWrap`, so the tooltip can be positioned `absolute` relative to the plot rather than the viewport) and the tooltip itself (modeled on `AircraftHoverTooltip.module.css`'s existing dark-box tooltip style, but `position: absolute` instead of `fixed`).
- `test/flightInfoPaneHover.test.ts` (new): unit tests for `cursorIndexFromFraction` and `nearestPointByTimestamp` against hand-built `SparklinePoint[]` fixtures, including the empty/single-point/gap edge cases.
- No changes to `SelectedAircraftInfo`, `buildSelectedAircraftInfo`, any data-fetching/polling code, or any other overlay component — this is a self-contained rendering/interaction change to `FlightInfoPane`'s existing sparkline.
- No new npm dependencies — plain SVG elements and React state, consistent with the existing hand-rolled sparkline (no charting library introduced).

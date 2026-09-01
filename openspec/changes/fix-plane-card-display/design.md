## Context

`PlaneCard` (`components/map/overlay/PlaneCard.tsx` + `PlaneCard.module.css`) renders two independent, already-documented tier axes on the same card:

1. **`rarityTier`** (`aircraft-rarity` capability) — nine values (`unidentified`/`standard`/`prime`/`remarkable`/`exceptional`/`epic`/`legendary`/`mythic`/`apex`), computed locally from a vendored dataset, driving the card's outer frame (`.aircraftRarityFrame[data-tier]`) and bottom-edge `.rarityBadge`. This axis's static colors are already correct (verified byte-for-byte in the prior `adsb-win-aircraft-card-api` change against an older stylesheet snapshot, `tailwind-255296c3.css`) — only its `mythic`/`apex` animation is missing (Decision 3).
2. **The adsb.win "material tier"** (`adsb-win-aircraft-stats` capability's `cardStats.attributes.tier`) — a six-value ladder (`carbon`/`alloy`/`titanium`/`iridium`/`plasma`/`quantum`, ascending — see `tierProgress.ts`'s `TIER_ORDER`/`TIER_START_XP`) representing the account's own real per-account, per-aircraft-type XP progress. Today this axis drives only the XP count, tier name text, and a progress bar — its badge (`.tierBadge`) and the card body itself render with no tier-specific color or decoration at all. The original design's Decision 4a explicitly flagged this as a known gap: *"only one real tier name ('Alloy') has ever been observed against this app's own live account, not enough to build a verified color mapping for the rest."*

This change re-fetches adsb.win's current production stylesheet, `https://adsb.win/assets/tailwind-1909ad77.css` (the asset hash has rotated since the `tailwind-255296c3.css` snapshot `PlaneCard.module.css`'s own header comment still cites — a stale reference this change also corrects), and confirms it now contains a complete, real definition for all six material tiers: `.aircraft-tier`, `.aircraft-tier--{carbon,alloy,titanium,iridium,plasma,quantum}` (card-body decoration), `.aircraft-card-badges--{tier}` (badge-row-scoped variable overrides — deliberately *different*, brighter values than the card-body ones, for badge legibility against the card's own background), `.aircraft-tier__badge`, and `.aircraft-tier__progress`. This closes the Decision 4a gap: the color mapping is no longer a guess.

Separately, this same stylesheet diff surfaces two more concrete bugs unrelated to the material-tier gap:
- `.aircraft-rarity--mythic:after, .aircraft-rarity--apex:after` in the reference carries `animation: 4s ease-in-out infinite rarity-sheen` — an animated diagonal highlight sweep. `PlaneCard.module.css`'s existing `mythic`/`apex` overrides already match the reference's static background/box-shadow values exactly, but never added this animation or the `::after` element it runs on.
- `PlaneCard.tsx`'s shrink-to-fit mechanism (a `ResizeObserver` comparing `.scaledContent`'s `scrollHeight` to its `clientHeight`, applying `transform: scaleY(scale)` when content overflows) scales only the vertical axis. This was a deliberate choice (see the extensive comment already in `PlaneCard.tsx`) to avoid the horizontal "gutter" a uniform `scale()` would leave once compressed below full width. But it also means every child element's rendered proportions distort under compression: badges (already circular pill shapes) flatten into ovals, glyphs squash vertically while keeping their full horizontal advance, and the aircraft silhouette's own aspect ratio (each vendored shape's real proportions, computed by `computeTightViewBox`) is skewed. `AircraftOverlay.module.css`'s own outer, grid-level shrink-to-fit (`.grid`'s own ResizeObserver in `AircraftOverlay.tsx`, per that file's `transform-origin: center center` comment) already uses a uniform `scale()`, tolerating the resulting letterboxing as the better trade-off — this change brings `PlaneCard`'s own inner shrink mechanism in line with that established, working precedent instead of the one-off `scaleY`.

## Goals / Non-Goals

**Goals:**
- Recolor and re-decorate `.tierBadge` and the XP progress bar off the real, now-confirmed six-tier material-tier palette instead of today's flat/neutral styling.
- Add each material tier's real card-body decorative treatment (background gradient + pseudo-element overlay + animation), gated so it only ever appears for a genuine `"ok"` `cardStats` result with a tier name `tierProgress.ts`'s table recognizes.
- Add the missing `rarity-sheen` animation to the existing, otherwise-correct `mythic`/`apex` rarity-tier frame styling.
- Fix `.badgeRow`'s gap and overflow handling to match the reference exactly.
- Replace `PlaneCard`'s `scaleY`-only shrink-to-fit with a uniform `scale()`, so a compressed card's content preserves its own proportions (badge pill shapes, glyph aspect ratio, silhouette aspect ratio) rather than being squashed on one axis.
- Re-verify every other literal value already in `PlaneCard.module.css` against the newly fetched stylesheet, correcting any other drift found, and update the file's cited source hash.

**Non-Goals:**
- The `.aircraft-hover-3d`/`.aircraft-hover-3d__content` perspective-tilt-on-hover effect present in the reference stylesheet is **not** added here. This app's overlay is a fixed-position bottom drawer, not a hoverable dashboard grid tile, and no acceptance criterion calls for a new interactive hover effect — only for existing static/animated styling and shrink-to-fit behavior to match. Revisit only if separately requested.
- The aircraft-silhouette icon's per-tier coloring technique (an inlined, `currentColor`-recolored SVG with a forced solid fill — see `PlaneCard.module.css`'s existing `.shapeIcon path` comment) is **not** replaced with the reference's own filter-based recoloring of a raster `<img>` (`filter: invert()/sepia()/saturate()/hue-rotate()/brightness()/drop-shadow(...)`). That raster-filter technique targets a full bitmap image; this app's vendored shapes are inlined multi-path SVGs, several of which (e.g. the Cessna 172) are pure hairline `fill:none` outline strokes with no fill at all in their original form — the existing `currentColor` + forced-fill treatment is a previously-made, still-valid workaround for that (documented in `PlaneCard.module.css`'s own comment). This change keeps that workaround and only double-checks the already-set `color`/`drop-shadow` values for drift against the new stylesheet (Decision 4) rather than re-deriving a filter-based approach — a from-scratch icon re-render technique is out of scope for a visual-bug-fix change with no icon-fidelity complaint in the acceptance criteria.
- Verifying the full-page layout/grid of `https://adsb.win/dashboard?tab=aircraft` is out of scope for this design in the sense that neither this document's author nor an automated agent has authenticated access to that page (it redirects unauthenticated requests to `/session/new`) — see Decision 5 for how "match style/aspect ratio of cards" and "test page in browser" are verified instead.
- No change to `aircraftModelCard.ts`'s data shape, `tierProgress.ts`'s XP thresholds, or any other overlay component.

## Decisions

### Decision 1: Material-tier CSS variables driven by a `data-material-tier` attribute, mirroring the existing `data-tier` (rarity) pattern exactly

Add `data-material-tier` to the same element `data-tier` already lives on (`.aircraftRarityFrame`'s inner `.aircraftTierCard`, i.e. the element styled by `.aircraft-tier` in the reference) whenever `cardStats?.status === "ok"` **and** `tierProgress.ts`'s `TIER_ORDER` recognizes the normalized tier name (`cardStats.attributes.tier.trim().toLowerCase()`); omitted (attribute absent, not set to an empty/unknown value) otherwise, so an unrecognized future tier name or a non-`"ok"` status falls back to the existing flat/neutral card body and badge — never a guessed color, matching this codebase's established "never fabricate/guess" convention (see the `adsb-win-aircraft-stats` capability's own requirements).

Per-tier CSS variable values (`--tier-color`/`--tier-highlight`/`--tier-glow`), copied byte-for-byte from `tailwind-1909ad77.css`'s `.aircraft-tier--{name}` rules:

| tier | `--tier-color` | `--tier-highlight` | `--tier-glow` |
|---|---|---|---|
| `carbon` | `#64748b` | `#cbd5e1` | *(none set — inherits `.aircraft-tier`'s base `transparent`)* |
| `alloy` | `#71717a` | `#e4e4e7` | `#a1a1aa47` |
| `titanium` | `#8b7cf6` | `#c4b5fd` | `#8b7cf659` |
| `iridium` | `#db2777` | `#fde68a` | `#ec489985` |
| `plasma` | `#fb923c` | `#f472b6` | `#f97316a6` |
| `quantum` | `#22d3ee` | `#a855f7` | `#22d3eecc` |

`.tierBadge` (matching the reference's `.aircraft-card-badges > .aircraft-tier__badge`, the badge-row-scoped variant) uses a **separate**, badge-row-scoped set of the same three variables — deliberately brighter/more saturated than the card-body set above, copied from `.aircraft-card-badges--{name}`:

| tier | `--tier-color` (badge) | `--tier-highlight` (badge) | `--tier-glow` (badge) |
|---|---|---|---|
| `carbon` | `#94a3b8` | `#e2e8f0` | `#cbd5e161` |
| `alloy` | `#a1a1aa` | `#f4f4f5` | `#d4d4d857` |
| `titanium` | `#8b7cf6` | `#ddd6fe` | `#8b7cf67a` |
| `iridium` | `#ec4899` | `#fde68a` | `#ec489985` |
| `plasma` | `#fb923c` | `#fda4af` | `#f9731694` |
| `quantum` | `#22d3ee` | `#c4b5fd` | `#22d3eead` |

Implementation: scope the badge-row table's overrides to `.aircraftRarityFrame [data-material-tier="carbon"] .tierBadge`-style selectors reusing the *badge* table's values directly on `.tierBadge`'s own rule (via a `[data-material-tier="…"]` ancestor selector on `.badgeRow` or the frame), rather than trying to make one shared set of variables serve both the card body and the badge — the reference itself doesn't share them (confirmed distinct values above), so neither should this port.

`.tierBadge` itself (mirroring `.aircraft-tier__badge`'s literal properties, adapted the same way the existing `.rarityBadge` already adapts `.aircraft-rarity__badge`):
```css
.tierBadge {
  /* ...existing pill layout (padding/border-radius/font-size/etc.) unchanged... */
  border: 1px solid color-mix(in srgb, var(--tier-highlight) 76%, transparent);
  background: color-mix(in srgb, var(--tier-color) 30%, #060a13);
  box-shadow: inset 0 1px 0 #ffffff3d, 0 0 13px var(--tier-glow);
  color: var(--tier-highlight);
}
```
falling back to today's flat `background: rgba(255,255,255,0.08); color: rgb(203,213,225);` when no ancestor `[data-material-tier]` is present (plain CSS cascade — the tier-scoped rule only applies under the attribute selector, so no explicit fallback branch is needed in `.tsx`).

**Alternatives considered:** Encoding the tier name into a single combined `--tier-*` custom-property triple set directly on `.tierBadge` via inline `style` from `PlaneCard.tsx` (parallel to how `.progressFill`'s `width` is already set inline) — rejected because every other per-tier styling in this codebase (the entire `data-tier`/rarity system) already uses the CSS-attribute-selector pattern, and mixing an inline-style approach for material tier alongside the attribute-selector approach for rarity tier would leave two different conventions for what's structurally the same problem.

### Decision 2: Material-tier card-body decoration ported as literal `:before`/`:after` overlays + the reference's real keyframes, gated the same way as Decision 1

Add, verbatim from `tailwind-1909ad77.css`:
```css
@keyframes iridium-shimmer { 0% { background-position: 0 0, 0 0, 0 0; } to { background-position: 0 0, 0 0, 100% 0; } }
@keyframes plasma-drift { 0% { background-position: 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; } to { background-position: 40px -60px, -55px -75px, 70px -45px, -80px -95px, 65px -80px, 0 0, 0 0; } }
@keyframes plasma-pulse { 0%, to { opacity: .62; } 50% { opacity: 1; } }
@keyframes quantum-aurora { 0% { filter: hue-rotate(0deg); background-position: 0 0, 0 0, -8% 0, 8% 0, 0 0; } to { filter: hue-rotate(24deg); background-position: 0 0, 0 0, 8% 0, -8% 0, 22px 31px; } }
@keyframes quantum-rim { to { --tier-angle: 360deg; } }
```
(`quantum-aurora`'s `0%` keyframe is the reference's literal `hue-rotate()` with no argument, which is invalid CSS and is silently ignored by browsers, leaving that offset at the property's initial `hue-rotate(0deg)` — reproduced here as `hue-rotate(0deg)` explicitly instead of copying the reference's malformed value verbatim, since porting a browser-ignored declaration byte-for-byte buys no fidelity and an explicit value is clearer to a future reader.)

`--tier-angle` needs its own `@property` registration (already valid, unprefixed CSS the reference itself uses) for the `quantum-rim` conic-gradient rotation to animate smoothly rather than snapping:
```css
@property --tier-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
```

Per-tier `:before` (background texture/glow, own animation where the reference has one) and `:after` (accent-colored mask-bordered rim, own animation for `plasma`/`quantum`) overlays are ported as their own selectors scoped under `.aircraftTierCard[data-material-tier="…"]`, each `position: absolute; inset: 0; content: ""; pointer-events: none; z-index: 0;` (matching the reference's shared `.aircraft-tier:before,:after` base rule), with the existing `.scaledContent` (and everything in it) needing `position: relative; z-index: 1;` added so real content stays visually on top — mirroring the reference's own `.aircraft-tier > * { z-index: 1; }`. `carbon`/`alloy`/`titanium` get only a `:before` (a static repeating-gradient texture, no keyframe animation, matching the reference); `iridium`/`plasma`/`quantum` get both `:before` and `:after`, each with the specific animation named above. Background gradient overrides on `.aircraftTierCard` itself (today's one fixed `linear-gradient(145deg, rgb(16,23,32), rgb(8,11,16) 62%, rgb(17,24,39))`, which — confirmed by diffing against the reference — is exactly the `carbon` tier's own background, not a tier-neutral default) become six literal per-`data-material-tier` overrides, each copied from the reference's own `.aircraft-tier--{name}{background:...!important}` rule; the existing fixed gradient becomes the `carbon` case (and stays the no-attribute fallback, so a non-`"ok"`/unrecognized-tier card still renders exactly as it does today — pixel-identical to the pre-change baseline).

**Alternatives considered:** Skipping the card-body decoration and only fixing the badge/progress-bar colors (a smaller diff) — rejected because the acceptance criteria explicitly call out "shimmer/animation effects must work the same way," and the reference's per-material-tier decoration is exactly that class of effect for this axis (parallel to the already-partially-implemented `mythic`/`apex` rarity sheen), not an optional embellishment.

### Decision 3: Add `rarity-sheen` to the existing `mythic`/`apex` rarity-tier overrides

```css
@keyframes rarity-sheen { 0%, 55% { background-position: 150% 0; } to { background-position: -80% 0; } }

.aircraftRarityFrame[data-tier="mythic"]::after,
.aircraftRarityFrame[data-tier="apex"]::after {
  content: "";
  z-index: 3;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(110deg, transparent 20%, #ffffff85 48%, transparent 55%) 150% 0 / 240% 100% no-repeat;
  animation: 4s ease-in-out infinite rarity-sheen;
}
```
on `.aircraftRarityFrame` (the outer frame element, matching the reference's `.aircraft-rarity--mythic:after,.aircraft-rarity--apex:after` selector scope — not the inner `.aircraftTierCard`), added alongside the seven other already-correct `[data-tier="…"]` blocks rather than replacing them. `z-index: 3` (above the frame's own content, which sits at the default stacking order) reproduces the reference's own sheen-on-top-of-everything layering; `border-radius: inherit` keeps the sheen clipped to the frame's already-`overflow: hidden` rounded corners.

**Alternatives considered:** None — this is a direct, small, unambiguous gap-fill against an otherwise-already-correct set of rules.

### Decision 4: Icon color/glow — verify values only, keep the existing `currentColor` technique (see Non-Goals)

`.shapeIcon`'s `color: var(--rarity-color)` and `filter: drop-shadow(0 0 3px var(--rarity-glow))` are checked against the reference's own `--rarity-glow` values (already correct — the `RARITY_TIER_STYLES`-sourced glow values in `PlaneCard.module.css` match `tailwind-1909ad77.css`'s `.aircraft-rarity--{tier}` blocks exactly) and left as-is. No `.aircraft-rarity__outline`-style multi-stage `filter: invert()/sepia()/...` is ported, per the Non-Goals section above.

### Decision 5: Verification against the live, authenticated reference page is a manual task for whoever implements/tests this change, not something this design can pre-verify

Neither this design's author nor an automated coding agent has credentials for `https://adsb.win/dashboard?tab=aircraft` (confirmed: an unauthenticated fetch redirects to `/session/new`). Every CSS value cited in Decisions 1–3 is instead sourced directly from the reference's own compiled stylesheet (`tailwind-1909ad77.css`), fetched and grepped for the exact selectors this card already claims to mirror (`.aircraft-rarity*`, `.aircraft-tier*`, `.aircraft-card-badges*`) — the same verification method the original `adsb-win-aircraft-card-api` change used against the prior stylesheet snapshot. `tasks.md`'s verification section calls for the implementer (who, per this app's existing precedent of "this app's own live account" in `PlaneCard.tsx`'s doc comments, has a real adsb.win login) to open that dashboard, select/inspect an aircraft card of each rarity tier and (if their account has real material-tier stats to compare against) each material tier, and visually diff against this app's own rendered `PlaneCard` at matching data, including at a deliberately shrunk drawer height to exercise the Decision-2/shrink-to-fit change side by side. "Match style/aspect ratio of cards" and "test page in browser" (this change's acceptance criteria) are satisfied by this manual step, not by an automated visual-regression test — this codebase has no existing visual-regression tooling, and introducing one is out of scope for a single presentational bug-fix change.

### Decision 6: `scaleY(scale)` → `scale(scale)`, no other change to the shrink-to-fit mechanism

`PlaneCard.tsx`'s `ResizeObserver`/`recompute()` logic (comparing `.scaledContent`'s `scrollHeight` to its own `clientHeight`, capped at 1) is unchanged; only the applied transform's axis changes:
```diff
- style={scale !== 1 ? { transform: `scaleY(${scale})` } : undefined}
+ style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
```
`.scaledContent`'s existing `transform-origin: top center` is kept (already correct for a uniform `scale()`, and already what `AircraftOverlay.module.css`'s analogous `transform-origin: center center` pattern establishes as this app's convention for a shrink-anchor). The resulting horizontal letterboxing when `scale < 1` (empty space on both sides of the now-narrower-than-its-box content) is an accepted, deliberate trade-off — matching the outer overlay-level shrink mechanism's own accepted trade-off — in exchange for preserving every child element's real proportions, which is what "keep scale consistent with aspect ratio" and "allow fonts and image to shrink" (this change's acceptance criteria) actually call for.

**Alternatives considered:**
- Keep `scaleY` but also apply a compensating `scaleX` derived from the *width* overflow ratio (a true non-uniform "best fit" scale) — rejected: still distorts font/badge/icon aspect ratio whenever the two axes' required ratios differ (the common case), which is the exact bug being fixed.
- Replace the whole transform-based mechanism with pure CSS container-query sizing (`cqh`-driven `font-size`/`clamp()` on every child, no JS/ResizeObserver at all) — a strictly more "native" fix, and `.modelName`/`.shapeIcon` already partially use this pattern (`cqmin`-driven `clamp()`). Rejected as this change's approach because it would require deriving new `clamp()` curves for every text/spacing value in the stat grid, XP block, and badges (a much larger, riskier diff for a bug-fix change), and because the existing JS mechanism already works correctly for every other reported symptom once its one axis bug is fixed. Flagged as a reasonable **future** follow-up in Open Questions, not attempted here.

## Risks / Trade-offs

- **[Risk]** The badge-row-scoped vs. card-body-scoped material-tier variable tables (Decision 1) are easy to accidentally merge into one shared set during implementation, since they share names (`--tier-color` etc.) and most values are close (but not identical) between the two tables. → **Mitigation**: `tasks.md` calls out implementing them as two textually separate blocks with an inline comment noting they're deliberately distinct, and a code-review/self-check step diffing the implemented values against this design's two tables directly.
- **[Risk]** Porting six tiers' worth of gradient/animation CSS verbatim is a large, easy-to-typo diff (long `radial-gradient`/`repeating-conic-gradient` value lists). → **Mitigation**: `tasks.md` calls for copy-pasting each tier's `:before`/`:after` declaration blocks directly from this design doc's Decision 2 sourcing (which was itself copied byte-for-byte from the fetched stylesheet) rather than hand-retyping, and a final pass re-diffing the shipped CSS file's relevant blocks against a fresh fetch of `tailwind-1909ad77.css`.
- **[Risk]** This app has never observed real API data for tiers above `alloy` (per the original design's Decision 4a caveat) — the material-tier decoration for `titanium`/`iridium`/`plasma`/`quantum` can only be checked against the reference stylesheet's *values*, not against a real, live rendered adsb.win card at those tiers, since neither this design's author nor (likely) the implementer's own account has reached them. → **Mitigation**: `tasks.md` includes a manual-testing step that temporarily hardcodes/mocks each of the six tier names into `cardStats` locally to visually exercise every tier's styling in this app's own dev server, independent of what the implementer's real account has actually reached.
- **[Trade-off]** Decision 6's uniform `scale()` reintroduces the horizontal letterboxing the original `scaleY`-only design explicitly chose to avoid (see `PlaneCard.tsx`'s existing, extensive doc comment on this exact trade-off). This is accepted deliberately here, since preserving aspect ratio is this change's explicit acceptance criterion and outranks the letterboxing concern, and because the overlay's own outer shrink mechanism already makes and lives with the identical trade-off.

## Open Questions

- Should the badge-row-scoped material-tier variables (Decision 1's second table) also apply to `.rarityBadge` (the *rarity*-tier badge sitting right next to `.tierBadge` in the same row), or does `.rarityBadge` correctly keep using only its own `--rarity-*` variables? Reference confirms these are two structurally separate badge classes (`.aircraft-rarity__badge` vs. `.aircraft-tier__badge`) each keyed to its own tier axis's variables — no cross-wiring — so no, `.rarityBadge` is untouched by this change. Resolved; recorded here since it's a natural point of confusion given both badges render in the same `.badgeRow`.
- Whether to eventually replace the JS-measured `scale()` shrink-to-fit with a pure-CSS `cqh`-driven approach (see Decision 6's "alternatives considered") is left open as a possible future follow-up change, not part of this one.

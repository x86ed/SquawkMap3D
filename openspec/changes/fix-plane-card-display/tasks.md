## 1. Source-of-truth refresh

- [ ] 1.1 Fetch `https://adsb.win/assets/tailwind-1909ad77.css` and re-confirm (grep/diff) every literal value already cited in `PlaneCard.module.css`'s comments and rules against it — not just the new material-tier/sheen rules this change adds — noting and fixing any other drift found beyond what's listed below
- [ ] 1.2 Update `PlaneCard.module.css`'s header comment to cite `tailwind-1909ad77.css` instead of the stale `tailwind-255296c3.css` hash

## 2. Material-tier CSS variables and badge/progress-bar recoloring (design.md Decision 1)

- [ ] 2.1 Add the six `.aircraftTierCard[data-material-tier="…"]` variable blocks (card-body-scoped `--tier-color`/`--tier-highlight`/`--tier-glow`) for `carbon`/`alloy`/`titanium`/`iridium`/`plasma`/`quantum`, values from design.md Decision 1's first table
- [ ] 2.2 Add the six badge-row-scoped `--tier-color`/`--tier-highlight`/`--tier-glow` overrides (design.md Decision 1's second table — deliberately different values from 2.1) scoped so they apply to `.tierBadge` specifically, with an inline comment noting the two tables are intentionally distinct (do not merge them)
- [ ] 2.3 Update `.tierBadge`'s `border`/`background`/`box-shadow`/`color` to the `var(--tier-*)`-driven values in design.md Decision 1, keeping today's flat `rgba(255,255,255,0.08)`/`rgb(203,213,225)` styling as the no-attribute fallback
- [ ] 2.4 Fix `.progressFill`'s `background` and `.progressFillMax`'s `background` to use `var(--tier-color)`/`var(--tier-highlight)` (card-body-scoped table from 2.1) instead of the current `var(--rarity-color)`/`var(--rarity-highlight)` — this is a genuine cross-wired-axis bug fix, not a new feature
- [ ] 2.5 In `PlaneCard.tsx`, set `data-material-tier` on `.aircraftTierCard` from `cardStats.attributes.tier.trim().toLowerCase()` whenever `cardStats?.status === "ok"` and that normalized value is one `tierProgress.ts`'s `TIER_ORDER` recognizes; omit the attribute entirely otherwise (do not set it to an empty string or an unrecognized value)

## 3. Material-tier card-body decoration (design.md Decision 2)

- [ ] 3.1 Add `@keyframes iridium-shimmer`, `plasma-drift`, `plasma-pulse`, `quantum-aurora` (with `hue-rotate(0deg)` at `0%`, not the reference's malformed argument-less `hue-rotate()`), and `quantum-rim`, copied from design.md Decision 2
- [ ] 3.2 Add the `@property --tier-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }` registration
- [ ] 3.3 Add `position: relative; z-index: 1;` to `.scaledContent` (or otherwise ensure real card content stacks above the new `:before`/`:after` overlays)
- [ ] 3.4 Add the six `.aircraftTierCard[data-material-tier="…"]` background gradient overrides (`!important`, matching the reference), with `carbon`'s value being today's existing fixed gradient (confirmed to already equal the reference's own `carbon` background) so a non-`"ok"`/unrecognized-tier card's rendering is unchanged
- [ ] 3.5 Add `carbon`/`alloy`/`titanium`'s `:before` static-texture overlays (no animation), each `position: absolute; inset: 0; content: ""; pointer-events: none; z-index: 0;` plus their own `background(-image)`/`opacity`/`border-color` from the reference
- [ ] 3.6 Add `iridium`/`plasma`/`quantum`'s `:before` and `:after` overlays with their respective animations (`iridium-shimmer`; `plasma-drift` + `plasma-pulse`; `quantum-aurora` + `quantum-rim`), copied verbatim from the reference's `.aircraft-tier--{name}:before`/`:after` rules
- [ ] 3.7 Verify (visually, per section 6) that a card with no `data-material-tier` attribute renders pixel-identical to this change's `git stash`/pre-change baseline

## 4. Rarity-tier sheen animation (design.md Decision 3)

- [ ] 4.1 Add `@keyframes rarity-sheen` per design.md Decision 3
- [ ] 4.2 Add the `.aircraftRarityFrame[data-tier="mythic"]::after, .aircraftRarityFrame[data-tier="apex"]::after` rule (gradient + `animation: 4s ease-in-out infinite rarity-sheen` + `z-index: 3` + `border-radius: inherit`) alongside the existing seven `[data-tier="…"]` blocks
- [ ] 4.3 Verify the other seven rarity tiers (`unidentified` through `legendary`) are unaffected (no stray `::after` sheen appears on them)

## 5. Badge row + uniform shrink-to-fit fixes

- [ ] 5.1 In `.badgeRow`, change `gap: 8px` to `gap: 0.35rem` and add `max-width: calc(100% - 2rem)` (matching the reference's `.aircraft-card-badges`)
- [ ] 5.2 Add `max-width: calc(100% - 2rem); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to `.tierBadge` and `.rarityBadge` (matching the reference's `.aircraft-card-badges > span`), so a long tier/rarity label truncates on a narrow card instead of overflowing
- [ ] 5.3 In `PlaneCard.tsx`, change the shrink-to-fit transform from `` `scaleY(${scale})` `` to `` `scale(${scale})` `` (design.md Decision 6); no other change to the `ResizeObserver`/`recompute()` logic
- [ ] 5.4 Update the large doc comment above `PlaneCard.tsx`'s `useEffect` (currently justifying `scaleY`-only) to reflect the new uniform-`scale()` rationale instead, so the comment doesn't contradict the code

## 6. Manual verification

- [ ] 6.1 Run the app locally (`npm run dev`), select aircraft across each of the nine rarity tiers (mocking/forcing `rarityTier` values as needed via existing test fixtures/dev tooling) and confirm each renders its correct frame/badge colors, with `mythic`/`apex` showing the new animated sheen and no other tier showing it
- [ ] 6.2 Temporarily mock a `"ok"` `cardStats` result (e.g. via a local edit or existing test-fixture mechanism) for each of the six material tier names (`carbon`/`alloy`/`titanium`/`iridium`/`plasma`/`quantum`) in turn, and confirm each renders its own distinct badge/progress-bar/card-body colors and (for `iridium`/`plasma`/`quantum`) its animated decoration; confirm an unrecognized tier name and the `undefined`/`"not_found"`/`"error"`/`"not_configured"`/`"invalid_token"` states all still render today's flat/neutral styling with no tier accent
- [ ] 6.3 Shrink the browser window / overlay drawer height until `PlaneCard`'s content no longer fits, and confirm the whole card's content (badges, heading, silhouette, stat grid) shrinks uniformly with no flattened/oval-ified badges or squashed text, at both a rarity-tier-only card and a card also showing a recognized material tier's decoration
- [ ] 6.4 Log into `https://adsb.win/dashboard?tab=aircraft` with a real adsb.win account, open an aircraft card, and visually diff its colors/spacing/animation against this app's own `PlaneCard` rendering at matching rarity/material tier data (as close a match as the account's own real data allows); note and file any further discrepancy found as a follow-up rather than blocking this change on tiers the account has never reached
- [ ] 6.5 Confirm no regression in the existing "PlaneCard shows aircraft identity and rarity tier" / "shows optional fleet-wide stats" behaviors unrelated to styling (placeholders for unknown fields, all five `cardStats.status` states) by re-running through `test/aircraftModelCard.test.ts` and `test/tierProgress.test.ts` plus a manual pass through each `cardStats.status` value

## 7. Checks

- [ ] 7.1 Run `npm run lint`, `npm test`, and `npx tsc --noEmit` — confirm all clean
- [ ] 7.2 Confirm no other component (`RecordPanelHero`, `TelemetryMarquee`, `FlightInfoPane`, the overlay drawer chrome) changed in appearance or behavior as a side effect of this change

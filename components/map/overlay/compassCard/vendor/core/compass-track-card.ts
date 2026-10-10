// Vendored from https://github.com/plens-win/Card
// packages/core/src/compass-track-card.ts @ 066e0e3 (2026-10-02, branch "11-compass-card-needs-to-have-some-issues-fixed").
// `"private": true` npm workspace, never published — vendored directly
// (matching this app's existing vendoring pattern, see
// components/map/aircraftShapes.ts's doc comment). Re-run manually and
// re-commit if upstream changes; not part of `npm run build`/CI.

import { creditLinkMarkup, WIREFRAME_CUBE_ICON } from './credit-link';
import type { CompassTrackCardInput } from './compass-track-card.types';

/** The stable DOM id `packages/compass-track-three`'s `mountCompassTrackCard`
 * mounts its live Three.js canvas into — the `compass-track` analogue of
 * `CARD_ART_SLOT_ID`. */
export const CARD_COMPASS_TRACK_SLOT_ID = 'card-compass-track-slot';

/** The stable DOM id `packages/compass-track-three`'s `mountCompassTrackCard`
 * mounts its second, independent Three.js canvas into — the mini attitude
 * viewport (compass ring, needle, and pitch/horizon indicator), fixed in
 * the card's upper-left corner via CSS, underneath (lower `z-index` than)
 * the existing heading-text/cardinal-badge HUD elements. See
 * `compass-track-render`'s "3D heading compass ring and cardinal-letter
 * badge renders in an independent corner viewport" requirement. */
export const CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID = 'card-compass-track-attitude-slot';

/** The stable DOM id of the heading HUD element, paired with the compass
 * ring's half of `.compass-track-attitude-mount` (see
 * `compass-track-hud`'s heading requirement, amended). */
export const CARD_COMPASS_TRACK_HEADING_HUD_ID = 'card-compass-track-heading-hud';

/** The stable DOM id of the pitch HUD element, paired with the
 * artificial-horizon ball's half of `.compass-track-attitude-mount` — a
 * sibling of {@link CARD_COMPASS_TRACK_HEADING_HUD_ID}, not nested inside
 * it (see `compass-track-hud`'s pitch requirement, amended per design
 * Decision 8). Unlike the earlier screen-reader-only pitch text, this
 * element renders its value visibly. */
export const CARD_COMPASS_TRACK_PITCH_HUD_ID = 'card-compass-track-pitch-hud';

/** The stable DOM id of the roll HUD element, paired with the
 * artificial-horizon ball's half of `.compass-track-attitude-mount`,
 * directly below it (mirroring the pitch readout's position above the
 * ball — see `design.md` Decision 10). Populated from
 * `initialState.rollDegrees`, distinct from the interactive
 * `manualRollOffset` in `@card/compass-track-three` (design Decision 9). */
export const CARD_COMPASS_TRACK_ROLL_HUD_ID = 'card-compass-track-roll-hud';

/** The stable DOM id of the bottom-left lat/lon HUD element. */
export const CARD_COMPASS_TRACK_LATLON_HUD_ID = 'card-compass-track-latlon-hud';

/** The stable DOM id of the bottom-right modeler-credit HUD element. */
export const CARD_COMPASS_TRACK_CREDIT_HUD_ID = 'card-compass-track-credit-hud';

/** The stable DOM id of the upper-left cardinal/intercardinal letter
 * indicator — also doubles as the DOM click target for
 * `compass-track-render`'s compass-mode-toggle interaction (true-north-locked
 * ↔ map-view-locked). Clicking it never recenters the camera — recenter is
 * exclusively triggered by clicking the 3D compass ring itself. */
export const CARD_COMPASS_TRACK_CARDINAL_ID = 'card-compass-track-cardinal-hud';

/** Class of the heading HUD's live heading-degrees text node. */
export const CARD_COMPASS_TRACK_HEADING_VALUE_CLASS = 'compass-track-heading-value';

/** Class of the pitch HUD's live pitch-degrees text node — a visible,
 * signed numeric readout (e.g. `5°`/`-5°`) paired with the
 * artificial-horizon ball, no longer screen-reader-only (design Decision
 * 8; see `compass-track-hud`'s amended pitch requirement). */
export const CARD_COMPASS_TRACK_PITCH_VALUE_CLASS = 'compass-track-pitch-value';

/** Class of the roll HUD's live roll-degrees text node — a visible, signed
 * numeric readout (e.g. `5°`/`-5°`) paired with the artificial-horizon
 * ball, directly below it (design Decision 10). */
export const CARD_COMPASS_TRACK_ROLL_VALUE_CLASS = 'compass-track-roll-value';

/** Class of the lat/lon HUD's live latitude text node. */
export const CARD_COMPASS_TRACK_LAT_VALUE_CLASS = 'compass-track-lat-value';

/** Class of the lat/lon HUD's live longitude text node. */
export const CARD_COMPASS_TRACK_LON_VALUE_CLASS = 'compass-track-lon-value';

/** Class of the bottom-right modeler-credit `<a>` link. */
export const CARD_COMPASS_TRACK_CREDIT_LINK_CLASS = 'compass-track-credit-link';

/** Nearest of the 8 cardinal/intercardinal points (`N`/`NE`/`E`/`SE`/`S`/
 * `SW`/`W`/`NW`) to `headingDegrees` — duplicated (not imported) from
 * `@card/compass-track-three`'s identically-behaved helper so this
 * dependency-free package can pre-populate the badge server-side without
 * depending on `three` (see the "HTML shell has no live behavior of its
 * own" requirement). */
const CARDINAL_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function nearestCardinalLabel(headingDegrees: number): string {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return CARDINAL_LABELS[index];
}

/** Formats `decimalDegrees` as a `D°M′S.s″`-style DMS string, preserving
 * sign via a leading `-` on the degrees component. Duplicated (not
 * imported) from `@card/compass-track-three`'s identically-behaved
 * `formatDms` for the same dependency-free reason as
 * {@link nearestCardinalLabel}. */
function formatDmsCoordinate(decimalDegrees: number): string {
  const sign = decimalDegrees < 0 ? '-' : '';
  const abs = Math.abs(decimalDegrees);
  let degrees = Math.floor(abs);
  let minutes = Math.floor((abs - degrees) * 60);
  let seconds = Math.round((((abs - degrees) * 60 - minutes) * 60) * 10) / 10;
  if (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }
  return `${sign}${degrees}°${minutes}′${seconds.toFixed(1)}″`;
}

/** Clamps `value`'s integer-part digit count to `maxDigits` (default `4`),
 * preserving sign and leaving any decimal part untouched — e.g. `99999.5`
 * with `maxDigits: 4` clamps to `9999.5`, not `9999` or `10000`. Duplicated
 * (not imported) from `@card/compass-track-three`'s identically-behaved
 * `capIntegerDigits` for the same dependency-free reason as
 * {@link nearestCardinalLabel}. Scoped to the plain-signed-degree
 * formatters (heading/pitch/roll) only — `formatDmsCoordinate` (lat/lon) is
 * unaffected (design Decision 12). */
function capIntegerDigits(value: number, maxDigits: number = 4): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (Math.floor(abs).toString().length <= maxDigits) return value;
  return sign * (10 ** maxDigits - 1);
}

/** Formats a heading-in-degrees value for HUD text display, appending the
 * degree symbol (e.g. `45` -> `"45°"`), after clamping its integer-part
 * digit count via {@link capIntegerDigits}. Duplicated (not imported) from
 * `@card/compass-track-three`'s identically-behaved `formatHeadingDegrees`
 * for the same dependency-free reason as {@link nearestCardinalLabel}. */
function formatHeadingDegreesLabel(headingDegrees: number): string {
  const text = Math.abs(capIntegerDigits(headingDegrees)).toFixed(4);
  let kept = '';
  let digits = 0;
  for (const ch of text) {
    if (ch !== '.') {
      if (digits === 4) break;
      digits++;
    }
    kept += ch;
  }
  kept = kept.replace(/0+$/, '').replace(/\.$/, '');
  const negative = headingDegrees < 0 && Number(kept) !== 0;
  return `${negative ? '-' : ''}${kept}°`;
}

/** Builds the `compass-track` card variant's HTML: a static shell — a mount
 * slot (`CARD_COMPASS_TRACK_SLOT_ID`) plus the three HUD placeholder
 * elements — pre-populated with `initialState`'s numbers and `model`'s
 * static modeler credit. Emits no script/timer/network activity of its own;
 * all live behavior (the running Three.js scene, HUD updates on later
 * `update()` calls) is owned by the optional `@card/compass-track-three`
 * sub-package, which mounts into these same ids/classes. Registered under
 * the `compass-track` kind by `packages/core/src/index.ts`. */
export function buildCompassTrackCard({ model, initialState }: CompassTrackCardInput): string {
  // Both fields must be present for a valid handle link — a blank profile
  // URL with a set name would otherwise render a broken empty-href link.
  const modelerBlank = !model.modelerName.trim() || !model.modelerProfileUrl.trim();
  // `unknownLabel` matches `ctaLabel` here (both "+ Add a model"): whether
  // or not `modelerAddUrl` is set, a blank modeler should read as an
  // invitation to contribute the model, not a dead "UNKNOWN"/"@" label.
  const creditLink = creditLinkMarkup(
    modelerBlank ? '' : model.modelerName,
    model.modelerProfileUrl,
    CARD_COMPASS_TRACK_CREDIT_LINK_CLASS,
    '+ Add a model',
    '+ Add a model',
    model.modelerAddUrl,
  );
  return `<div class="compass-track-card">
  <div class="compass-track-mount" id="${CARD_COMPASS_TRACK_SLOT_ID}"></div>
  <div class="compass-track-instruments">
  <div class="compass-track-hud compass-track-hud-cardinal" id="${CARD_COMPASS_TRACK_CARDINAL_ID}" role="button" tabindex="0" aria-label="Toggle compass orientation mode">${nearestCardinalLabel(initialState.headingDegrees)}</div>
  <div class="compass-track-hud compass-track-hud-pitch" id="${CARD_COMPASS_TRACK_PITCH_HUD_ID}">
    <span class="${CARD_COMPASS_TRACK_PITCH_VALUE_CLASS}">${formatHeadingDegreesLabel(initialState.pitchDegrees)}</span>
  </div>
  <div class="compass-track-attitude-mount" id="${CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID}"></div>
  <div class="compass-track-hud compass-track-hud-heading" id="${CARD_COMPASS_TRACK_HEADING_HUD_ID}">
    <span class="${CARD_COMPASS_TRACK_HEADING_VALUE_CLASS}">${formatHeadingDegreesLabel(initialState.headingDegrees)}</span>
  </div>
  <div class="compass-track-hud compass-track-hud-roll" id="${CARD_COMPASS_TRACK_ROLL_HUD_ID}">
    <span class="${CARD_COMPASS_TRACK_ROLL_VALUE_CLASS}">${formatHeadingDegreesLabel(initialState.rollDegrees)}</span>
  </div>
  </div>
  <div class="compass-track-hud compass-track-hud-latlon" id="${CARD_COMPASS_TRACK_LATLON_HUD_ID}">
    <div class="compass-track-latlon-line"><span class="compass-track-latlon-label">LAT //</span> <span class="${CARD_COMPASS_TRACK_LAT_VALUE_CLASS}">${formatDmsCoordinate(initialState.latitude)}</span></div>
    <div class="compass-track-latlon-line"><span class="compass-track-latlon-label">LON //</span> <span class="${CARD_COMPASS_TRACK_LON_VALUE_CLASS}">${formatDmsCoordinate(initialState.longitude)}</span></div>
  </div>
  <div class="compass-track-hud compass-track-hud-credit" id="${CARD_COMPASS_TRACK_CREDIT_HUD_ID}">
    <span class="compass-track-credit-icon" aria-hidden="true">${WIREFRAME_CUBE_ICON}</span>
    ${creditLink}
  </div>
</div>`;
}

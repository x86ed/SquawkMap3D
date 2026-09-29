// Vendored from https://github.com/plens-win/Card
// packages/core/src/compass-track-card.ts @ 39734839 (2026-09-28, PR #10
// "change how unknown author functions"). `"private": true` npm workspace,
// never published to the registry — vendored directly (matching this app's
// existing vendoring pattern, see components/map/aircraftShapes.ts's doc
// comment) rather than depended on. Re-run manually and re-commit if
// upstream changes; not part of `npm run build`/CI.

import { creditLinkMarkup, WIREFRAME_CUBE_ICON } from './credit-link';
import type { CompassTrackCardInput } from './compass-track-card.types';

/** The stable DOM id `packages/compass-track-three`'s `mountCompassTrackCard`
 * mounts its live Three.js canvas into — the `compass-track` analogue of
 * `CARD_ART_SLOT_ID`. */
export const CARD_COMPASS_TRACK_SLOT_ID = 'card-compass-track-slot';

/** The stable DOM id of the top-left heading/pitch HUD element. */
export const CARD_COMPASS_TRACK_HEADING_HUD_ID = 'card-compass-track-heading-hud';

/** The stable DOM id of the bottom-left lat/lon HUD element. */
export const CARD_COMPASS_TRACK_LATLON_HUD_ID = 'card-compass-track-latlon-hud';

/** The stable DOM id of the bottom-right modeler-credit HUD element. */
export const CARD_COMPASS_TRACK_CREDIT_HUD_ID = 'card-compass-track-credit-hud';

/** Class of the heading HUD's live heading-degrees text node. */
export const CARD_COMPASS_TRACK_HEADING_VALUE_CLASS = 'compass-track-heading-value';

/** Class of the heading HUD's live pitch-degrees text node. */
export const CARD_COMPASS_TRACK_PITCH_VALUE_CLASS = 'compass-track-pitch-value';

/** Class of the lat/lon HUD's live latitude text node. */
export const CARD_COMPASS_TRACK_LAT_VALUE_CLASS = 'compass-track-lat-value';

/** Class of the lat/lon HUD's live longitude text node. */
export const CARD_COMPASS_TRACK_LON_VALUE_CLASS = 'compass-track-lon-value';

/** Class of the bottom-right modeler-credit `<a>` link. */
export const CARD_COMPASS_TRACK_CREDIT_LINK_CLASS = 'compass-track-credit-link';

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
  <div class="compass-track-hud compass-track-hud-heading" id="${CARD_COMPASS_TRACK_HEADING_HUD_ID}">
    <span class="${CARD_COMPASS_TRACK_HEADING_VALUE_CLASS}">${initialState.headingDegrees}</span>
    <span class="${CARD_COMPASS_TRACK_PITCH_VALUE_CLASS}">${initialState.pitchDegrees}</span>
  </div>
  <div class="compass-track-hud compass-track-hud-latlon" id="${CARD_COMPASS_TRACK_LATLON_HUD_ID}">
    <span class="${CARD_COMPASS_TRACK_LAT_VALUE_CLASS}">${initialState.latitude}</span>
    <span class="${CARD_COMPASS_TRACK_LON_VALUE_CLASS}">${initialState.longitude}</span>
  </div>
  <div class="compass-track-hud compass-track-hud-credit" id="${CARD_COMPASS_TRACK_CREDIT_HUD_ID}">
    <span class="compass-track-credit-icon" aria-hidden="true">${WIREFRAME_CUBE_ICON}</span>
    ${creditLink}
  </div>
</div>`;
}

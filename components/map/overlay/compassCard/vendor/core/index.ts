// Trimmed vendoring of https://github.com/plens-win/Card
// packages/core/src/index.ts @ 2153af0d (2026-09-30). Upstream's own index
// also registers/exports the `aircraft` card kind (`buildAircraftCard`);
// this app doesn't consume that card kind (PlaneCard is its own hand-built
// component that only reuses `credit-link.ts`'s pure render helper directly
// — see design.md's "PlaneCard gets its own credit line" decision), so only
// the `compass-track` kind and what it needs are vendored/registered here.

import {
  buildCompassTrackCard,
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
  CARD_COMPASS_TRACK_CARDINAL_ID,
  CARD_COMPASS_TRACK_HEADING_VALUE_CLASS,
  CARD_COMPASS_TRACK_PITCH_VALUE_CLASS,
  CARD_COMPASS_TRACK_LAT_VALUE_CLASS,
  CARD_COMPASS_TRACK_LON_VALUE_CLASS,
  CARD_COMPASS_TRACK_CREDIT_LINK_CLASS,
} from './compass-track-card';
import { registerCardVariant, renderCard } from './registry';

registerCardVariant({ kind: 'compass-track', render: buildCompassTrackCard });

export { registerCardVariant, renderCard };
export { buildCompassTrackCard };
export {
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
  CARD_COMPASS_TRACK_CARDINAL_ID,
  CARD_COMPASS_TRACK_HEADING_VALUE_CLASS,
  CARD_COMPASS_TRACK_PITCH_VALUE_CLASS,
  CARD_COMPASS_TRACK_LAT_VALUE_CLASS,
  CARD_COMPASS_TRACK_LON_VALUE_CLASS,
  CARD_COMPASS_TRACK_CREDIT_LINK_CLASS,
};
export { RARITY_TIER_STYLES } from './rarity';
export type { RarityTier } from './rarity';
export type { CardVariant } from './registry';
export { creditLinkMarkup, WIREFRAME_CUBE_ICON } from './credit-link';
export type { CompassTrackModel, CompassTrackState, CompassTrackCardInput } from './compass-track-card.types';

// Vendored from https://github.com/plens-win/Card
// packages/core/src/credit-link.ts @ 2153af0d (2026-09-30, branch "11-compass-card-needs-to-have-some-issues-fixed").
// `"private": true` npm workspace, never published — vendored directly
// (matching this app's existing vendoring pattern, see
// components/map/aircraftShapes.ts's doc comment). Re-run manually and
// re-commit if upstream changes; not part of `npm run build`/CI.

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Static inline SVG wireframe-cube glyph — signals "this credit is for the
 * 3D model" wherever a model-credit link renders. Shared by the aircraft
 * card's front-face model-credit line and the compass-track card's
 * modeler-credit HUD so both card types use the same icon. */
export const WIREFRAME_CUBE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 7v10l-9 5-9-5V7z M12 2v10 M3 7l9 5 9-5 M3 17l9-5 9 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** Renders a credit field as a resolved `@handle`-style link (`href`, with
 * visible text `@handle`) when `handle` is non-blank; otherwise renders an
 * "unknown" placeholder — a link to `addUrl` reading `ctaLabel` (an explicit
 * call-to-action, e.g. "+ Add author credit", distinct from the plain
 * placeholder text so it reads as clickable) when `addUrl` is set, or an
 * unlinked `unknownLabel` placeholder span when it isn't. Shared by
 * `aircraft-card.ts` (author/added-by credits) and `compass-track-card.ts`
 * (modeler credit) so both card types get the same blank/addUrl fallback
 * behavior. */
export function creditLinkMarkup(
  handle: string,
  href: string,
  className: string,
  unknownLabel: string,
  ctaLabel: string,
  addUrl?: string,
): string {
  const trimmedHandle = handle.trim();
  if (trimmedHandle) {
    return `<a class="${className}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">@${esc(trimmedHandle)}</a>`;
  }
  const trimmedAddUrl = addUrl?.trim();
  if (trimmedAddUrl) {
    return `<a class="${className} card-credit-add" href="${esc(trimmedAddUrl)}" target="_blank" rel="noopener noreferrer">${ctaLabel}</a>`;
  }
  return `<span class="${className} card-credit-unknown">${unknownLabel}</span>`;
}

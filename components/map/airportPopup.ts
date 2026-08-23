export interface AirportProperties {
  ident?: string | null;
  name?: string | null;
  municipality?: string | null;
  iso_country?: string | null;
  icao_code?: string | null;
  iata_code?: string | null;
}

const IMAGE_SLOT_ID_PREFIX = "airport-popup-image-";

/** Resolves an airport's ISO 3166-1 alpha-2 country code to the static SVG
 * copied from the `flag-icons` package (see scripts/copy-flag-icons.mjs).
 * Doesn't verify the file exists — the `<img>` tag's own `onerror` handles a
 * code the flag set doesn't cover. */
export function flagSvgPathForCountryCode(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return `/flags/${iso.toLowerCase()}.svg`;
}

const countryNameCache = new Map<string, string>();
let regionDisplayNames: Intl.DisplayNames | null | undefined;

function getRegionDisplayNames(): Intl.DisplayNames | null {
  if (regionDisplayNames === undefined) {
    try {
      regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionDisplayNames = null;
    }
  }
  return regionDisplayNames;
}

/** Resolves an ISO 3166-1 alpha-2 country code to its full English name via
 * `Intl.DisplayNames`, falling back to the raw code if that API is
 * unavailable or doesn't recognize the code (e.g. OurAirports-specific
 * codes that aren't real ISO 3166-1 entries). */
export function countryNameForCode(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const cached = countryNameCache.get(iso);
  if (cached) return cached;

  const displayNames = getRegionDisplayNames();
  const resolved = displayNames?.of(iso);
  const name = resolved && resolved !== iso ? resolved : iso;
  countryNameCache.set(iso, name);
  return name;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeRow(label: string, code: string | null | undefined): string {
  if (!code) return "";
  return `<div style="display:flex;justify-content:space-between;gap:8px;"><span style="color:#666;">${label}</span><span style="font-weight:600;">${escapeHtml(code)}</span></div>`;
}

/** DOM id of the `<img>`/placeholder element `fetchAirportImage`'s caller
 * should update once the async lookup resolves, scoped per-airport so a
 * stale popup's slot is never mistaken for the current one. */
export function airportImageSlotId(ident: string): string {
  return `${IMAGE_SLOT_ID_PREFIX}${ident}`;
}

/** Builds the popup's HTML. The image slot starts as a loading placeholder;
 * callers swap in the resolved thumbnail (or a fallback) once
 * `fetchAirportImage` settles, keyed by `airportImageSlotId`.
 *
 * Every element sets its own text color explicitly rather than relying on
 * inheritance: this markup is appended into `<body>`, whose `color` is the
 * app's theme `--foreground` (light gray in dark mode), but the popup's own
 * background is always white/light — inheriting the page color reads as
 * washed-out, low-contrast text against it. */
export function buildAirportPopupHtml(properties: AirportProperties): string {
  const name = properties.name ?? "Unknown airport";
  const ident = properties.ident ?? name;
  const flagSrc = flagSvgPathForCountryCode(properties.iso_country);
  const countryName = countryNameForCode(properties.iso_country);
  const city = properties.municipality ?? null;

  const flagHtml = flagSrc
    ? `<img src="${flagSrc}" alt="${escapeHtml(countryName)} flag" width="20" height="15" style="border-radius:2px;flex-shrink:0;" onerror="this.style.display='none'" />`
    : "";

  return `
    <div style="min-width:200px;font-family:inherit;color:#171717;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${escapeHtml(name)}</div>
      <div id="${airportImageSlotId(ident)}" style="width:100%;height:110px;border-radius:6px;overflow:hidden;background:#e5e5e5;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;margin-bottom:8px;">
        Loading image…
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;font-size:13px;">
        ${codeRow("IATA", properties.iata_code)}
        ${codeRow("ICAO", properties.icao_code)}
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <span style="color:#666;">Location</span>
          <span style="display:flex;align-items:center;gap:6px;font-weight:600;">
            ${flagHtml}
            ${escapeHtml([city, countryName].filter(Boolean).join(", "))}
          </span>
        </div>
      </div>
    </div>
  `;
}

interface WikipediaSummary {
  thumbnail?: { source?: string };
}

const imageCache = new Map<string, Promise<string | null>>();

/** Looks up a thumbnail image for `name` via the public Wikipedia REST API
 * (page-summary endpoint), returning `null` on any non-2xx response, a
 * missing thumbnail, or a network failure — never throws. Results are
 * cached in-memory per session, keyed by name, to dedupe repeat lookups. */
export function fetchAirportImage(name: string): Promise<string | null> {
  const cached = imageCache.get(name);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      );
      if (!response.ok) return null;
      const data = (await response.json()) as WikipediaSummary;
      return data.thumbnail?.source ?? null;
    } catch {
      return null;
    }
  })();

  imageCache.set(name, promise);
  return promise;
}

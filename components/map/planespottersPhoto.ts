/**
 * Aircraft photo lookup via Planespotters.net's public Photo API
 * (https://www.planespotters.net/photo/api) — free, no key, CORS-enabled
 * for direct browser use (their docs: "Browser clients must request the API
 * from a webpage" with an Origin/Referer header, which a normal client-side
 * `fetch()` from this app already sends; no server-side proxy needed, unlike
 * `flightRoute.ts`'s tar1090 case).
 *
 * The hex-code endpoint is used (not the registration one) since this app
 * always has the aircraft's ICAO hex; per their docs it already falls back
 * to the registration internally if the hex isn't in their aircraft
 * database, so a single call covers both cases.
 *
 * Terms of use requirements this implementation follows:
 * - JSON responses may be cached up to 24h client-side — cached in-memory
 *   per session (mirrors `airportPopup.ts`'s `fetchAirportImage`), well
 *   under that budget since it doesn't persist across reloads.
 * - Image binaries are never downloaded/stored/proxied — callers must render
 *   `thumbnailLargeSrc` directly as an `<img src>` so the end user's browser
 *   loads it straight from Planespotters' CDN.
 * - The photographer credit and a plain (non-`nofollow`) link to `link`
 *   must be shown next to the image — enforced by the caller
 *   (`RecordPanelHero`), not this module.
 */

export interface PlanespottersPhoto {
  thumbnailLargeSrc: string;
  link: string;
  photographer: string;
}

interface PlanespottersApiPhoto {
  thumbnail_large?: { src?: string };
  link?: string;
  photographer?: string;
}

interface PlanespottersApiResponse {
  photos?: PlanespottersApiPhoto[];
  error?: string;
}

const photoCache = new Map<string, Promise<PlanespottersPhoto | null>>();

/** Looks up the latest Planespotters photo for `hex` (ICAO 24-bit address),
 * returning `null` on any error response, empty result, or network failure
 * — never throws. Results are cached in-memory per session, keyed by hex. */
export function fetchAircraftPhoto(hex: string): Promise<PlanespottersPhoto | null> {
  const key = hex.toLowerCase();
  const cached = photoCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const response = await fetch(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(key)}`);
      if (!response.ok) return null;
      const data = (await response.json()) as PlanespottersApiResponse;
      const photo = data.photos?.[0];
      const src = photo?.thumbnail_large?.src;
      if (!photo || !src || !photo.link || !photo.photographer) return null;
      return { thumbnailLargeSrc: src, link: photo.link, photographer: photo.photographer };
    } catch {
      return null;
    }
  })();

  photoCache.set(key, promise);
  return promise;
}

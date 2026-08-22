export interface GeoCoords {
  latitude: number;
  longitude: number;
}

const GEOLOCATION_TIMEOUT_MS = 8000;

/**
 * Requests the browser's current position. Always resolves (never rejects):
 * `null` on denial, timeout, or an unsupported browser, so callers can fall
 * back to a default view without hanging.
 */
export function getCurrentLocation(): Promise<GeoCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}

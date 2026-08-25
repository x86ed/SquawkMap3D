import { getFeederUrl } from "./constants";
import type { GeoCoords } from "./geolocation";

/**
 * Points at this app's own nginx sidecar, which proxies to the feeder's
 * receiver.json server-side (see scripts/squawkmap3d.nginx.conf). Unlike
 * aircraft.json, the ultrafeeder image's nginx config only patches CORS
 * onto aircraft.json's location block (see docker-tar1090's
 * 07-nginx-configure), so a direct cross-origin browser fetch against
 * receiver.json is blocked. Proxying server-side sidesteps that gap
 * without touching the ultrafeeder container.
 */
function getReceiverUrl(): string | undefined {
  const feederUrl = getFeederUrl();
  if (!feederUrl) return undefined;
  return "/data/receiver.json";
}

/**
 * Fetches the feeder's own surveyed antenna position from its receiver.json
 * (tar1090/readsb convention). This is the actual transmitter location —
 * fixed and far more reliable than the viewing browser's own geolocation,
 * which reflects wherever the device loading the page happens to be, not
 * where the receiver's antenna actually sits. Always resolves (never
 * rejects): no feeder configured, a network failure, or a response missing
 * `lat`/`lon` all resolve to `null`, mirroring `getCurrentLocation` so
 * callers can fall back the same way.
 */
export async function getFeederLocation(): Promise<GeoCoords | null> {
  const receiverUrl = getReceiverUrl();
  if (!receiverUrl) return null;
  try {
    const response = await fetch(receiverUrl);
    if (!response.ok) return null;
    const data: { lat?: number; lon?: number } = await response.json();
    if (typeof data.lat !== "number" || typeof data.lon !== "number") return null;
    return { latitude: data.lat, longitude: data.lon };
  } catch {
    return null;
  }
}

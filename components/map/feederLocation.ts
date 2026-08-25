import { getFeederUrl } from "./constants";
import type { GeoCoords } from "./geolocation";

/**
 * Derives the feeder's receiver.json URL from its configured aircraft.json
 * URL — tar1090/readsb serve both from the same `/data/` directory, so no
 * separate env var is needed.
 */
function getReceiverUrl(): string | undefined {
  const feederUrl = getFeederUrl();
  if (!feederUrl) return undefined;
  return feederUrl.replace(/aircraft\.json(?=(\?|$))/, "receiver.json");
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

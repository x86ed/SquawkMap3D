/**
 * adsb.win Aircraft Card API — per-account, per-aircraft-type fleet-wide
 * stats (unique registrations spotted, flights captured, observed flight
 * time, highest altitude observed, XP, current material tier).
 *
 * Mirrors `flightRoute.ts`'s structure field-for-field (see
 * openspec/changes/adsb-win-aircraft-card-api/design.md Decision 6):
 * `fetchAircraftModelCard()` never throws, `getCachedAircraftModelCard()` is
 * a module-level `Map` cache, `clearAircraftModelCardCache()` is exported for
 * parity/tests. Deliberate divergences from `flightRoute.ts`: cache key
 * includes the feeder UUID (so switching accounts can never serve stale
 * cross-account data), and `"error"` results are never cached (a transient
 * failure deserves a retry on the next ~1s poll tick, not a sticky result).
 *
 * Never uses the response's `meta.embed_url`/iframe path — hydrates only
 * from `data.attributes`. Never sends the feeder UUID anywhere but the
 * `Authorization` header, and never includes it in any thrown/caught error
 * message or `console.*` call.
 */

const AIRCRAFT_MODEL_CARD_API_BASE = "https://app-api.adsb.win/api/v1/aircraft-models";

export interface AircraftModelCardAttributes {
  name: string;
  manufacturer: string;
  tier: string;
  xp: number;
  uniqueAircraft: number;
  uniqueRegistrations: number;
  flightsCaptured: number;
  observedSeconds: number;
  /** API: "may be null". */
  maximumAltitudeFt: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  historicalThrough: string;
}

export type AircraftModelCardResult =
  | { status: "ok"; attributes: AircraftModelCardAttributes }
  /** Caller-synthesized: no feeder UUID stored, request never sent. */
  | { status: "not_configured" }
  /** API 401. */
  | { status: "invalid_token" }
  /** API 404. */
  | { status: "not_found" }
  /** Network failure, non-2xx/non-404/401, unparseable body. */
  | { status: "error" };

interface AircraftModelCardResponseBody {
  data?: {
    attributes?: Record<string, unknown>;
  };
}

function parseAttributes(body: AircraftModelCardResponseBody): AircraftModelCardAttributes | null {
  const raw = body.data?.attributes;
  if (!raw) return null;
  if (
    typeof raw.name !== "string" ||
    typeof raw.manufacturer !== "string" ||
    typeof raw.tier !== "string" ||
    typeof raw.xp !== "number" ||
    typeof raw.unique_aircraft !== "number" ||
    typeof raw.unique_registrations !== "number" ||
    typeof raw.flights_captured !== "number" ||
    typeof raw.observed_seconds !== "number" ||
    (raw.maximum_altitude_ft !== null && typeof raw.maximum_altitude_ft !== "number") ||
    typeof raw.first_seen_at !== "string" ||
    typeof raw.last_seen_at !== "string" ||
    typeof raw.historical_through !== "string"
  ) {
    return null;
  }
  return {
    name: raw.name,
    manufacturer: raw.manufacturer,
    tier: raw.tier,
    xp: raw.xp,
    uniqueAircraft: raw.unique_aircraft,
    uniqueRegistrations: raw.unique_registrations,
    flightsCaptured: raw.flights_captured,
    observedSeconds: raw.observed_seconds,
    maximumAltitudeFt: raw.maximum_altitude_ft as number | null,
    firstSeenAt: raw.first_seen_at,
    lastSeenAt: raw.last_seen_at,
    historicalThrough: raw.historical_through,
  };
}

/**
 * Fetches `typeDesignator`'s aircraft-model card, authenticated with
 * `feederUuid`. Never rejects — every failure mode (network throw, non-2xx
 * status other than 401/404, unparseable/unexpected body shape) resolves
 * `{status:"error"}` rather than throwing, mirroring `flightRoute.ts`'s
 * `getFlightRoute()` contract.
 */
export async function fetchAircraftModelCard(
  typeDesignator: string,
  feederUuid: string,
): Promise<AircraftModelCardResult> {
  try {
    const url = `${AIRCRAFT_MODEL_CARD_API_BASE}/${encodeURIComponent(typeDesignator.toUpperCase())}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${feederUuid}` },
    });

    if (response.status === 401) return { status: "invalid_token" };
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "error" };

    const body = (await response.json()) as AircraftModelCardResponseBody;
    const attributes = parseAttributes(body);
    if (!attributes) return { status: "error" };

    return { status: "ok", attributes };
  } catch {
    return { status: "error" };
  }
}

/**
 * Module-level cache keyed `${feederUuid}::${typeDesignator.toUpperCase()}`
 * (design.md Decision 6) — bounded by the number of distinct aircraft types
 * seen in a session, so it's intentionally never cleared on deselect (see
 * `MapView.tsx`'s `refreshAircraft()`, which does clear `flightRoute.ts`'s
 * cache on deselect but not this one).
 */
const aircraftModelCardCache = new Map<string, AircraftModelCardResult>();

function cacheKey(typeDesignator: string, feederUuid: string): string {
  return `${feederUuid}::${typeDesignator.toUpperCase()}`;
}

/**
 * Cache-wrapped `fetchAircraftModelCard()`. Every status except `"error"` is
 * cached — a transient failure is retried on the next call rather than
 * sticking for the rest of the session (design.md Decision 6's deliberate
 * divergence from `flightRoute.ts`, which caches its own `null` "no match"
 * result unconditionally).
 */
export async function getCachedAircraftModelCard(
  typeDesignator: string,
  feederUuid: string,
): Promise<AircraftModelCardResult> {
  const key = cacheKey(typeDesignator, feederUuid);
  const cached = aircraftModelCardCache.get(key);
  if (cached) return cached;

  const result = await fetchAircraftModelCard(typeDesignator, feederUuid);
  if (result.status !== "error") {
    aircraftModelCardCache.set(key, result);
  }
  return result;
}

export function clearAircraftModelCardCache(): void {
  aircraftModelCardCache.clear();
}

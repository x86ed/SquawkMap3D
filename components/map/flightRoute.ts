/**
 * Flight route (origin/destination) lookup for `FlightInfoPane`.
 *
 * **Discovery finding (see openspec/changes/aircraft-info-overlay/tasks.md
 * section 3's blocking discovery task):** this design originally assumed
 * tar1090 serves its own route database as a static file bundled with its
 * install (something this app's nginx sidecar could proxy same-origin,
 * mirroring `feederLocation.ts`'s `receiver.json`/`outline.json` pattern).
 * That assumption was checked directly against tar1090's own current source
 * (`wiedehopf/tar1090`, `html/planeObject.js`'s `routeDoLookup()` /
 * `html/defaults.js`'s `routeApiUrl`) rather than guessed, and is **false**:
 * tar1090 has no local/feeder-side route file at all. Its own web UI
 * resolves routes by POSTing `{ planes: [{ callsign, lat, lng }, ...] }`
 * directly from the browser to a public third-party API —
 * `https://adsb.im/api/0/routeset` by default (alternative:
 * `https://api.adsb.lol/api/0/routeset`).
 *
 * design.md Decision 12 originally scoped calling that third-party API as a
 * Non-Goal; revisited and reversed per explicit user request (there's no
 * feeder-local alternative — see above). Calls `adsb.im` directly from the
 * browser, matching what every real tar1090 install does.
 *
 * **Endpoint choice — `adsb.im`, not `api.adsb.lol`:** confirmed directly
 * against both live APIs before picking one. `api.adsb.lol/api/0/routeset`
 * silently no-ops for any request whose `Origin`/`Referer` isn't
 * `adsb.lol` itself (any other origin, or none at all, gets a fake
 * `201`/empty-body "success" rather than a real error) — that would make it
 * silently never work when called from this app's own origin. `adsb.im`
 * has no such restriction (`access-control-allow-origin: *`, verified with
 * an arbitrary `Origin` header), matches this file's own original research
 * into tar1090's actual default, and is what every real self-hosted
 * tar1090 instance in the world already calls cross-origin.
 */
export interface FlightRoute {
  origin?: string;
  destination?: string;
}

const ROUTESET_API_URL = "https://adsb.im/api/0/routeset";

interface RoutesetAirport {
  iata?: string;
  icao?: string;
}

interface RoutesetResult {
  _airports?: RoutesetAirport[];
  plausible?: boolean;
}

/**
 * Looks up `callsign`'s route via `adsb.im`'s public routeset API, which
 * also wants the aircraft's current position (`lat`/`lon`) to disambiguate
 * callsigns that could plausibly match more than one real-world route.
 * Never rejects — a network failure, a non-2xx response, or a callsign the
 * API has no match for all resolve `null` (mirroring
 * `feederLocation.ts`'s `getFeederLocation()` contract), so callers always
 * get `FlightInfoPane`'s legitimate "no route data available" empty state
 * rather than an unhandled rejection.
 */
export async function getFlightRoute(
  callsign: string,
  lat: number,
  lon: number,
): Promise<FlightRoute | null> {
  try {
    const response = await fetch(ROUTESET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planes: [{ callsign, lat, lng: lon }] }),
    });
    if (!response.ok) return null;

    const results = (await response.json()) as RoutesetResult[];
    const match = results[0];
    const airports = match?._airports;
    if (!match || !airports || airports.length < 2) return null;

    const [originAirport, destinationAirport] = airports;
    const origin = originAirport.iata || originAirport.icao;
    const destination = destinationAirport.iata || destinationAirport.icao;
    if (!origin && !destination) return null;

    return { origin, destination };
  } catch {
    return null;
  }
}

/**
 * Module-level cache shared by every consumer of `getCachedFlightRoute()` —
 * the selected-aircraft info overlay and the plane-listing panel both hit
 * this one `Map`, keyed `${hex}:${callsign}` (matching the key format
 * `MapView.tsx` used for its own now-removed local `routeCacheRef`), so a
 * given aircraft's route is only ever fetched once per cache lifetime no
 * matter how many consumers ask for it (design.md Decision 9).
 */
const routeCache = new Map<string, FlightRoute | null>();

/**
 * Cache-wrapped `getFlightRoute()`. Returns the cached entry for
 * `${hex}:${callsign}` if present, otherwise fetches and caches the result
 * (including a `null` no-match result, so a callsign with no route data
 * isn't re-fetched every call either). No debounce, queue, rate limit, or
 * staggering is added here — a first-ever ask for a given key fetches
 * immediately, exactly as `MapView.tsx` did with its own local cache before
 * this extraction (design.md Decision 9).
 */
export async function getCachedFlightRoute(
  hex: string,
  callsign: string,
  lat: number,
  lon: number,
): Promise<FlightRoute | null> {
  const cacheKey = `${hex}:${callsign}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey) ?? null;
  }
  const route = await getFlightRoute(callsign, lat, lon);
  routeCache.set(cacheKey, route);
  return route;
}

/** Clears every cached route — called on deselect/drop-out, mirroring what
 * `MapView.tsx`'s own local `routeCacheRef.current.clear()` did before this
 * extraction. */
export function clearFlightRouteCache(): void {
  routeCache.clear();
}

import * as turf from "@turf/turf";
import type { Aircraft } from "../aircraft";
import type { GeoCoords } from "../geolocation";
import { computeRarityTier, computeRarityValue, type RarityTier } from "../aircraftRarity";
import { countryCodeForRegistration } from "../registrationCountry";
import { airlineNameForCallsign } from "../airlineLookup";
import type { FlightRoute } from "../flightRoute";

/**
 * Fully-derived display row for one aircraft in the plane-listing table
 * (tasks.md 9.2) — every field the table's columns need except `route`,
 * which is resolved asynchronously via `getCachedFlightRoute()` and merged
 * in separately by `PlaneListingPanel` (design.md Decision 6/9), since a
 * pure per-poll builder shouldn't itself kick off network requests.
 */
export interface PlaneListingRow {
  hex: string;
  countryCode: string | null;
  callsign?: string;
  airlineName: string | null;
  route: FlightRoute | null;
  registration?: string;
  typeDesignator?: string;
  squawk?: string;
  altitude?: number;
  groundSpeed?: number;
  verticalRate?: number;
  distanceNm?: number;
  track?: number;
  messages?: number;
  secondsSinceLastMessage?: number;
  rssi?: number;
  lat?: number;
  lon?: number;
  sourceType?: string;
  isMilitary?: boolean;
  /** ADS-B emitter category, e.g. "A3" (readsb's `category`) — used only by
   * the Filters tab's Category filter, not rendered as a column
   * (design.md Decision 14). */
  category?: string;
  /** Privacy ICAO Address flag (`dbFlags` bit `0x4`) — used only by the
   * Filters tab's DB-flags chip row (design.md Decision 14). */
  isPia?: boolean;
  /** Limiting Aircraft Data Displayed flag (`dbFlags` bit `0x8`) — used only
   * by the Filters tab's DB-flags chip row (design.md Decision 14). */
  isLadd?: boolean;
  windDirection?: number;
  windSpeed?: number;
  rarityTier: RarityTier;
  rarityValue?: number;
}

/**
 * Builds a `PlaneListingRow` from real feeder/site data only — no invented
 * values (plane-listing-panel spec's "Columns with real underlying data
 * render actual values" requirement). `route` starts `null` here; callers
 * merge in a resolved route separately (see this file's doc comment above).
 */
export function buildPlaneListingRow(aircraft: Aircraft, siteLocation: GeoCoords | null): PlaneListingRow {
  let distanceNm: number | undefined;
  if (siteLocation && aircraft.lat !== undefined && aircraft.lon !== undefined) {
    distanceNm = turf.distance(
      [siteLocation.longitude, siteLocation.latitude],
      [aircraft.lon, aircraft.lat],
      { units: "nauticalmiles" },
    );
  }

  return {
    hex: aircraft.hex,
    countryCode: countryCodeForRegistration(aircraft.registration),
    callsign: aircraft.callsign,
    airlineName: airlineNameForCallsign(aircraft.callsign),
    route: null,
    registration: aircraft.registration,
    typeDesignator: aircraft.typeDesignator,
    squawk: aircraft.squawk,
    altitude: aircraft.altitude,
    groundSpeed: aircraft.groundSpeed,
    verticalRate: aircraft.verticalRate,
    distanceNm,
    track: aircraft.track,
    messages: aircraft.messages,
    secondsSinceLastMessage: aircraft.secondsSinceLastMessage,
    rssi: aircraft.rssi,
    lat: aircraft.lat,
    lon: aircraft.lon,
    sourceType: aircraft.sourceType,
    isMilitary: aircraft.isMilitary,
    category: aircraft.category,
    isPia: aircraft.isPia,
    isLadd: aircraft.isLadd,
    windDirection: aircraft.windDirection,
    windSpeed: aircraft.windSpeed,
    rarityTier: computeRarityTier(aircraft),
    rarityValue: computeRarityValue(aircraft),
  };
}

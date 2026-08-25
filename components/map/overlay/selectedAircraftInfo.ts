import * as turf from "@turf/turf";
import type { Aircraft, TrackPoint } from "../aircraft";
import { computeRarityTier, RARITY_TIER_COLORS, type RarityTier } from "../aircraftRarity";
import type { FlightRoute } from "../flightRoute";
import type { GeoCoords } from "../geolocation";

/** One point of a sparkline series, in chronological order (oldest first). */
export interface SparklinePoint {
  timestamp: number;
  value: number;
}

/**
 * Shared view-model for the overlay's four components (design.md Decision
 * 9) — assembled once per poll in MapView.tsx from real feeder/track/site
 * data (plus the vendored rarity snapshot and, when resolved, a route), and
 * handed down as props. No component reaches back into MapView state or
 * re-fetches/re-derives anything itself.
 */
export interface SelectedAircraftInfo {
  hex: string;
  callsign?: string;
  registration?: string;
  manufacturerModel?: string;
  operator?: string;
  year?: string;
  rarityTier: RarityTier;
  rarityColor: string;
  altitude?: number;
  groundSpeed?: number;
  track?: number;
  verticalRate?: number;
  squawk?: string;
  secondsSinceLastMessage?: number;
  /** Great-circle distance from the resolved feeder/user site, nautical
   * miles — `undefined` when the site or the aircraft's position isn't
   * known (design.md Decision 8). */
  distanceNm?: number;
  altitudeSeries: SparklinePoint[];
  groundSpeedSeries: SparklinePoint[];
  /** `null` when the feeder's route lookup found nothing for this
   * aircraft's callsign, or (currently) unconditionally — see
   * components/map/flightRoute.ts's doc comment for why. */
  route: FlightRoute | null;
  /** Oldest retained track point's timestamp — used as the "first seen this
   * session" honest fallback when a route has no real departure timestamp
   * (design.md Decision 12). `undefined` with no retained track points. */
  firstSeenThisSessionAt?: number;
}

export function buildSelectedAircraftInfo(
  aircraft: Aircraft,
  track: TrackPoint[],
  site: GeoCoords | null,
  route: FlightRoute | null,
): SelectedAircraftInfo {
  const rarityTier = computeRarityTier(aircraft);

  let distanceNm: number | undefined;
  if (site && aircraft.lat !== undefined && aircraft.lon !== undefined) {
    distanceNm = turf.distance(
      [site.longitude, site.latitude],
      [aircraft.lon, aircraft.lat],
      { units: "nauticalmiles" },
    );
  }

  return {
    hex: aircraft.hex,
    callsign: aircraft.callsign,
    registration: aircraft.registration,
    manufacturerModel: aircraft.manufacturerModel,
    operator: aircraft.operator,
    year: aircraft.year,
    rarityTier,
    rarityColor: RARITY_TIER_COLORS[rarityTier],
    altitude: aircraft.altitude,
    groundSpeed: aircraft.groundSpeed,
    track: aircraft.track,
    verticalRate: aircraft.verticalRate,
    squawk: aircraft.squawk,
    secondsSinceLastMessage: aircraft.secondsSinceLastMessage,
    distanceNm,
    altitudeSeries: track.map((p) => ({ timestamp: p.timestamp, value: p.altitude })),
    groundSpeedSeries: track
      .filter((p) => p.groundSpeed !== undefined)
      .map((p) => ({ timestamp: p.timestamp, value: p.groundSpeed as number })),
    route,
    firstSeenThisSessionAt: track[0]?.timestamp,
  };
}

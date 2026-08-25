import { AIRCRAFT_TRACK_RETENTION_MS, getFeederUrl } from "./constants";

/**
 * Normalized aircraft state, mapped from a feeder's aircraft.json entry.
 * Field names/shape confirmed against readsb's own JSON field reference
 * (hex, flight, lat/lon, alt_baro [number, or the string "ground"],
 * alt_geom, gs, track, baro_rate, squawk, category "A0"-"D7", `t` — the
 * ICAO type designator, `r` — registration, `desc` — manufacturer/model
 * description string, `ownOp` — operator name, `year`, `seen` — seconds
 * since the last message, only populated when the feeder loads a
 * tar1090-db aircraft.csv.gz). Every field there is documented as
 * optional/omittable when the feeder has no current value, hence the
 * `| undefined`s below.
 */
export interface Aircraft {
  hex: string;
  callsign?: string;
  lat?: number;
  lon?: number;
  /** Barometric altitude in feet. `undefined` when omitted or reported as
   * the ground string — ground-status aircraft aren't given a 3D elevation. */
  altitude?: number;
  groundSpeed?: number;
  /** True track over ground, degrees 0-359. */
  track?: number;
  verticalRate?: number;
  squawk?: string;
  /** ADS-B emitter category, "A0"-"D7". */
  category?: string;
  /** ICAO type designator (e.g. "A320"), used for icon resolution. */
  typeDesignator?: string;
  /** Tail number/registration (readsb's `r`). Only populated when the
   * feeder loads a tar1090-db aircraft.csv.gz — same optional treatment as
   * `typeDesignator`. */
  registration?: string;
  /** Manufacturer/model description string (readsb's `desc`). */
  manufacturerModel?: string;
  /** Operator name (readsb's `ownOp`). */
  operator?: string;
  /** Year of manufacture (readsb's `year`), kept as a string to match the
   * raw field verbatim rather than assuming a parseable 4-digit number. */
  year?: string;
  /** Seconds since the last message received from this aircraft (readsb's
   * `seen`). */
  secondsSinceLastMessage?: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  altitude: number;
  timestamp: number;
  groundSpeed?: number;
}

interface RawAircraftJson {
  aircraft?: Array<{
    hex?: string;
    flight?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | "ground";
    gs?: number;
    track?: number;
    baro_rate?: number;
    squawk?: string;
    category?: string;
    t?: string;
    r?: string;
    desc?: string;
    ownOp?: string;
    year?: string;
    seen?: number;
  }>;
}

function normalize(raw: NonNullable<RawAircraftJson["aircraft"]>[number]): Aircraft | null {
  if (!raw.hex) return null;
  return {
    hex: raw.hex,
    callsign: raw.flight?.trim() || undefined,
    lat: raw.lat,
    lon: raw.lon,
    altitude: typeof raw.alt_baro === "number" ? raw.alt_baro : undefined,
    groundSpeed: raw.gs,
    track: raw.track,
    verticalRate: raw.baro_rate,
    squawk: raw.squawk,
    category: raw.category,
    typeDesignator: raw.t,
    registration: raw.r?.trim() || undefined,
    manufacturerModel: raw.desc?.trim() || undefined,
    operator: raw.ownOp?.trim() || undefined,
    year: raw.year?.trim() || undefined,
    secondsSinceLastMessage: raw.seen,
  };
}

/**
 * Fetches current aircraft from the configured feeder's aircraft.json.
 * Returns `[]` (not an error) when no feeder is configured or the request
 * fails, mirroring `tfr.ts`/`specialUseAirspace.ts` — the layer stays empty
 * rather than breaking the map.
 */
export async function fetchAircraft(): Promise<Aircraft[]> {
  const feederUrl = getFeederUrl();
  if (!feederUrl) return [];
  try {
    const response = await fetch(feederUrl);
    if (!response.ok) return [];
    const data: RawAircraftJson = await response.json();
    if (!data.aircraft) return [];
    const aircraft: Aircraft[] = [];
    for (const raw of data.aircraft) {
      const normalized = normalize(raw);
      if (normalized) aircraft.push(normalized);
    }
    return aircraft;
  } catch {
    return [];
  }
}

const trackBuffers = new Map<string, TrackPoint[]>();

/**
 * Appends each aircraft's current position to its in-memory track buffer,
 * prunes points older than `AIRCRAFT_TRACK_RETENTION_MS`, and drops buffers
 * for hexes no longer present in `aircraft` — this is the entire "track
 * history" this layer has: session-local, built from successive polls,
 * never persisted or backed by a feeder trace file (see design.md's
 * Non-Goals). Aircraft missing a position or altitude are skipped (no point
 * to record).
 */
export function updateTracks(aircraft: Aircraft[]): void {
  const now = Date.now();
  const cutoff = now - AIRCRAFT_TRACK_RETENTION_MS;
  const seenHexes = new Set<string>();

  for (const a of aircraft) {
    seenHexes.add(a.hex);
    if (a.lat === undefined || a.lon === undefined || a.altitude === undefined) {
      continue;
    }
    const points = trackBuffers.get(a.hex) ?? [];
    points.push({ lat: a.lat, lon: a.lon, altitude: a.altitude, timestamp: now });
    const pruned = points.filter((p) => p.timestamp >= cutoff);
    trackBuffers.set(a.hex, pruned);
  }

  for (const hex of trackBuffers.keys()) {
    if (!seenHexes.has(hex)) trackBuffers.delete(hex);
  }
}

/** Current track trail for one aircraft, oldest point first. */
export function getTrack(hex: string): TrackPoint[] {
  return trackBuffers.get(hex) ?? [];
}

/** All current track trails, keyed by hex. */
export function getAllTracks(): ReadonlyMap<string, TrackPoint[]> {
  return trackBuffers;
}

/** Clears all track buffers — called when the aircraft layer is toggled
 * off, so re-enabling it starts fresh rather than resuming a stale trail. */
export function clearTracks(): void {
  trackBuffers.clear();
}

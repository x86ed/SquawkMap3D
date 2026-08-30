import type { PlaneListingRow } from "./aircraftDisplay";

export type ColumnKey =
  | "hex"
  | "flag"
  | "callsign"
  | "airline"
  | "route"
  | "registration"
  | "type"
  | "squawk"
  | "altitude"
  | "speed"
  | "vrate"
  | "distance"
  | "track"
  | "messages"
  | "seen"
  | "rssi"
  | "lat"
  | "lon"
  | "source"
  | "mil"
  | "windD"
  | "windS"
  | "xp"
  | "rarity"
  | "regsSeen"
  | "flightTime"
  | "level";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** Whether this column is part of the default-visible set. */
  def: boolean;
  align: "left" | "right" | "center";
  /** Defaults to `true` when omitted — only the Flag column (an image, no
   * natural sort order) opts out. */
  sortable?: boolean;
}

/**
 * All 27 plane-listing columns (plane-listing-panel spec's "Sortable data
 * table with the full column set" requirement), in display order. `def`
 * mirrors the reference file's own `def: true`/`def: false` split (tasks.md
 * 9.1) — XP, Registrations, and Flight Time are `def: false` and are, along
 * with Level, stubbed-for-now placeholder columns (design.md Decision 6):
 * no per-hex XP/registrations-seen/flight-time/level tracking system exists
 * anywhere in this codebase yet (only `aircraftRarity.ts`'s tier/value
 * system, used by the separate Rarity column). These four render a plain
 * "—" for every row until a follow-up change wires in real per-hex
 * tracking data — this is a deliberate, called-out deferral, not
 * fabricated/randomized data.
 */
export const COLUMNS: ColumnDef[] = [
  { key: "hex", label: "Hex ID", def: true, align: "left" },
  { key: "flag", label: "Flag", def: true, align: "center", sortable: false },
  { key: "callsign", label: "Callsign", def: true, align: "left" },
  { key: "airline", label: "Airline", def: false, align: "left" },
  { key: "route", label: "Route", def: false, align: "left" },
  { key: "registration", label: "Registration", def: true, align: "left" },
  { key: "type", label: "Type", def: true, align: "left" },
  { key: "squawk", label: "Squawk", def: true, align: "right" },
  { key: "altitude", label: "Altitude", def: true, align: "right" },
  { key: "speed", label: "Speed", def: true, align: "right" },
  { key: "vrate", label: "Vertical Rate", def: false, align: "right" },
  { key: "distance", label: "Distance", def: true, align: "right" },
  { key: "track", label: "Track", def: false, align: "right" },
  { key: "messages", label: "Messages", def: false, align: "right" },
  { key: "seen", label: "Seen", def: true, align: "right" },
  { key: "rssi", label: "RSSI", def: false, align: "right" },
  { key: "lat", label: "Latitude", def: false, align: "right" },
  { key: "lon", label: "Longitude", def: false, align: "right" },
  { key: "source", label: "Source", def: false, align: "left" },
  { key: "mil", label: "Mil.", def: false, align: "center" },
  { key: "windD", label: "Wind D.", def: false, align: "right" },
  { key: "windS", label: "Wind S.", def: false, align: "right" },
  { key: "xp", label: "XP", def: false, align: "right" },
  { key: "rarity", label: "Rarity", def: false, align: "left" },
  { key: "regsSeen", label: "Registrations", def: false, align: "right" },
  { key: "flightTime", label: "Flight Time", def: false, align: "right" },
  { key: "level", label: "Level", def: false, align: "right" },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS: ColumnKey[] = COLUMNS.filter((c) => c.def).map(
  (c) => c.key,
);

export const ALL_COLUMN_KEYS: ColumnKey[] = COLUMNS.map((c) => c.key);

/** Columns with no real underlying data source yet (design.md Decision 6) —
 * always render the same placeholder, regardless of row content. */
export const STUBBED_COLUMN_KEYS: ReadonlySet<ColumnKey> = new Set([
  "xp",
  "regsSeen",
  "flightTime",
  "level",
]);

const PLACEHOLDER = "—";

/** Plain-text display value for `row`'s `key` column (tasks.md 9.3) — unit
 * suffixes, empty-state dashes, etc. Badge/color styling (rarity, Mil.,
 * emergency squawk) is layered on top of this in `PlaneTable.tsx`, which
 * has access to JSX; this stays pure string formatting so `columns.ts`
 * doesn't need a JSX runtime. */
export function formatCell(row: PlaneListingRow, key: ColumnKey): string {
  if (STUBBED_COLUMN_KEYS.has(key)) return PLACEHOLDER;

  switch (key) {
    case "hex":
      return row.hex.toUpperCase();
    case "flag":
      return row.countryCode ?? PLACEHOLDER;
    case "callsign":
      return row.callsign ?? PLACEHOLDER;
    case "airline":
      return row.airlineName ?? PLACEHOLDER;
    case "route": {
      const { origin, destination } = row.route ?? {};
      if (!origin && !destination) return PLACEHOLDER;
      return `${origin ?? "?"} – ${destination ?? "?"}`;
    }
    case "registration":
      return row.registration ?? PLACEHOLDER;
    case "type":
      return row.typeDesignator ?? PLACEHOLDER;
    case "squawk":
      return row.squawk ?? PLACEHOLDER;
    case "altitude":
      return row.altitude !== undefined ? `${row.altitude.toLocaleString()} ft` : PLACEHOLDER;
    case "speed":
      return row.groundSpeed !== undefined ? `${Math.round(row.groundSpeed)} kt` : PLACEHOLDER;
    case "vrate": {
      if (row.verticalRate === undefined) return PLACEHOLDER;
      if (row.verticalRate === 0) return "level";
      const arrow = row.verticalRate > 0 ? "↑" : "↓";
      return `${arrow} ${Math.abs(row.verticalRate)}`;
    }
    case "distance":
      return row.distanceNm !== undefined ? `${row.distanceNm.toFixed(1)} nm` : PLACEHOLDER;
    case "track":
      return row.track !== undefined ? `${Math.round(row.track)}°` : PLACEHOLDER;
    case "messages":
      return row.messages !== undefined ? row.messages.toLocaleString() : PLACEHOLDER;
    case "seen":
      return row.secondsSinceLastMessage !== undefined
        ? `${Math.round(row.secondsSinceLastMessage)}s`
        : PLACEHOLDER;
    case "rssi":
      return row.rssi !== undefined ? `${row.rssi.toFixed(1)} dBm` : PLACEHOLDER;
    case "lat":
      return row.lat !== undefined ? row.lat.toFixed(4) : PLACEHOLDER;
    case "lon":
      return row.lon !== undefined ? row.lon.toFixed(4) : PLACEHOLDER;
    case "source":
      return row.sourceType ?? PLACEHOLDER;
    case "mil":
      return row.isMilitary ? "MIL" : PLACEHOLDER;
    case "windD":
      return row.windDirection !== undefined ? `${Math.round(row.windDirection)}°` : PLACEHOLDER;
    case "windS":
      return row.windSpeed !== undefined ? `${Math.round(row.windSpeed)} kt` : PLACEHOLDER;
    case "rarity":
      return row.rarityTier.charAt(0).toUpperCase() + row.rarityTier.slice(1);
    default:
      return PLACEHOLDER;
  }
}

/** Sort key for `row`'s `key` column — lower-cased strings sort
 * case-insensitively, mirroring the reference file's own `sortVal`. */
export function sortValue(row: PlaneListingRow, key: ColumnKey): string | number {
  switch (key) {
    case "hex":
      return row.hex.toLowerCase();
    case "flag":
      return row.countryCode?.toLowerCase() ?? "";
    case "callsign":
      return row.callsign?.toLowerCase() ?? "";
    case "airline":
      return row.airlineName?.toLowerCase() ?? "";
    case "route":
      return (row.route?.origin ?? row.route?.destination ?? "").toLowerCase();
    case "registration":
      return row.registration?.toLowerCase() ?? "";
    case "type":
      return row.typeDesignator?.toLowerCase() ?? "";
    case "squawk":
      return row.squawk ?? "";
    case "altitude":
      return row.altitude ?? -Infinity;
    case "speed":
      return row.groundSpeed ?? -Infinity;
    case "vrate":
      return row.verticalRate ?? -Infinity;
    case "distance":
      return row.distanceNm ?? Infinity;
    case "track":
      return row.track ?? -Infinity;
    case "messages":
      return row.messages ?? -Infinity;
    case "seen":
      return row.secondsSinceLastMessage ?? Infinity;
    case "rssi":
      return row.rssi ?? -Infinity;
    case "lat":
      return row.lat ?? -Infinity;
    case "lon":
      return row.lon ?? -Infinity;
    case "source":
      return row.sourceType?.toLowerCase() ?? "";
    case "mil":
      return row.isMilitary ? 1 : 0;
    case "windD":
      return row.windDirection ?? -Infinity;
    case "windS":
      return row.windSpeed ?? -Infinity;
    case "rarity":
      return row.rarityValue ?? -Infinity;
    default:
      return "";
  }
}

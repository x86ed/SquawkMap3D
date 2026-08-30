import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlaneListingPanel.module.css";
import { fetchAircraft, type Aircraft } from "../aircraft";
import { AIRCRAFT_FEED_REFRESH_INTERVAL_MS } from "../constants";
import type { GeoCoords } from "../geolocation";
import { getCachedFlightRoute, type FlightRoute } from "../flightRoute";
import { countryNameForCode } from "../registrationCountry";
import { typeDescriptionForCode } from "../typeDescriptionLookup";
import { buildPlaneListingRow, type PlaneListingRow } from "./aircraftDisplay";
import { COLUMNS, DEFAULT_VISIBLE_COLUMN_KEYS, sortValue, type ColumnKey } from "./columns";
import { PlaneTable, type SortState } from "./PlaneTable";
import { SourceChipRow } from "./SourceChipRow";
import { bucketForSourceType, type SourceBucket } from "./sourceBucket";

const SEARCH_STORAGE_KEY = "squawkmap3d:planeListing:search";
const FILTERS_STORAGE_KEY = "squawkmap3d:planeListing:filters";
const COLUMNS_STORAGE_KEY = "squawkmap3d:planeListing:columns";

/** DB-flags chip row keys (design.md Decision 14) — replaces the earlier
 * plain "military only" boolean filter. */
type DbFlag = "military" | "pia" | "ladd";

const DB_FLAGS: { key: DbFlag; label: string }[] = [
  { key: "military", label: "Military" },
  { key: "pia", label: "PIA" },
  { key: "ladd", label: "LADD" },
];

interface Filters {
  altMin: number | null;
  altMax: number | null;
  distMin: number | null;
  distMax: number | null;
  callsign: string;
  squawk: string;
  registration: string;
  hex: string;
  typeCode: string;
  typeDescription: string;
  route: string;
  country: string;
  category: string;
  sourceBuckets: SourceBucket[];
  dbFlags: DbFlag[];
}

const DEFAULT_FILTERS: Filters = {
  altMin: null,
  altMax: null,
  distMin: null,
  distMax: null,
  callsign: "",
  squawk: "",
  registration: "",
  hex: "",
  typeCode: "",
  typeDescription: "",
  route: "",
  country: "",
  category: "",
  sourceBuckets: [],
  dbFlags: [],
};

type Tab = "search" | "filters" | "columns";

function readStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStoredJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (e.g. private browsing) — just won't persist.
  }
}

function removeStored(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function routeCacheKey(hex: string, callsign: string): string {
  return `${hex}:${callsign}`;
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.altMin === b.altMin &&
    a.altMax === b.altMax &&
    a.distMin === b.distMin &&
    a.distMax === b.distMax &&
    a.callsign === b.callsign &&
    a.squawk === b.squawk &&
    a.registration === b.registration &&
    a.hex === b.hex &&
    a.typeCode === b.typeCode &&
    a.typeDescription === b.typeDescription &&
    a.route === b.route &&
    a.country === b.country &&
    a.category === b.category &&
    stringArraysEqual(a.sourceBuckets, b.sourceBuckets) &&
    stringArraysEqual(a.dbFlags, b.dbFlags)
  );
}

function routeText(row: PlaneListingRow): string {
  const { origin, destination } = row.route ?? {};
  return `${origin ?? ""} ${destination ?? ""}`.trim();
}

function countryText(row: PlaneListingRow): string {
  const name = countryNameForCode(row.countryCode ?? undefined) ?? "";
  return `${row.countryCode ?? ""} ${name}`.trim();
}

function columnSetsEqual(a: ColumnKey[], b: ColumnKey[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((key) => bSet.has(key));
}

/**
 * The drawer's plane-listing panel (plane-listing-panel spec) — owns its
 * own `fetchAircraft()` poll, independent of `MapView.tsx`'s aircraft-icon
 * poll and the range-outline's own poll (design.md Decision 7, following
 * the precedent both of those already set), started on mount / cleared on
 * unmount. `LayerDrawer`'s caller only mounts this while the drawer is open
 * (design.md Decision 8), so this poll only runs then.
 */
export function PlaneListingPanel({
  siteLocation,
  selectedHex = null,
  onAircraftClick,
}: {
  siteLocation: GeoCoords | null;
  /** Hex of the aircraft currently selected on the map, so the matching
   * table row can be highlighted regardless of how it was selected. */
  selectedHex?: string | null;
  /** Same handler the map's own aircraft-icon click uses (`MapView.tsx`'s
   * `handleAircraftClick`) — clicking a row selects that aircraft and opens
   * the same info overlay a map click would, with the same toggle-to-
   * deselect behavior. Optional so this panel still renders standalone
   * (e.g. in tests) without a selection handler wired up. */
  onAircraftClick?: (hex: string | null, picked?: Aircraft) => void;
}) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [routesByKey, setRoutesByKey] = useState<Record<string, FlightRoute | null>>({});
  const requestedRouteKeysRef = useRef<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [search, setSearch] = useState<string>(() => readStoredJson<string>(SEARCH_STORAGE_KEY) ?? "");
  const [filters, setFilters] = useState<Filters>(() => ({
    // Spread over `DEFAULT_FILTERS` (not just `?? DEFAULT_FILTERS`) so a
    // filters object persisted by an older build of this panel — missing
    // fields this change adds (source buckets, DB flags, the new text
    // filters) — still restores with valid defaults for those, rather than
    // `undefined` values breaking `.length`/`.includes` calls below.
    ...DEFAULT_FILTERS,
    ...(readStoredJson<Partial<Filters>>(FILTERS_STORAGE_KEY) ?? {}),
  }));
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<ColumnKey[]>(() => {
    const stored = readStoredJson<ColumnKey[]>(COLUMNS_STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBLE_COLUMN_KEYS;
    const knownKeys = new Set(COLUMNS.map((c) => c.key));
    const filtered = stored.filter((key) => knownKeys.has(key));
    return filtered.length > 0 ? filtered : DEFAULT_VISIBLE_COLUMN_KEYS;
  });
  const [sort, setSort] = useState<SortState>({ key: "distance", dir: "asc" });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const next = await fetchAircraft();
      if (!cancelled) setAircraft(next);
    };
    void poll();
    const intervalId = setInterval(() => void poll(), AIRCRAFT_FEED_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // Each persistence effect removes its key rather than writing when the
  // current value equals its default — otherwise `handleClearAll` below
  // removing all three keys would immediately be undone by these same
  // effects re-writing the (now-default) values back on the next render,
  // violating "no persisted state for this panel remains in localStorage"
  // (plane-listing-panel spec's "Clear all resets and wipes persisted state
  // in one action" scenario).
  useEffect(() => {
    if (search === "") removeStored(SEARCH_STORAGE_KEY);
    else writeStoredJson(SEARCH_STORAGE_KEY, search);
  }, [search]);

  useEffect(() => {
    if (filtersEqual(filters, DEFAULT_FILTERS)) removeStored(FILTERS_STORAGE_KEY);
    else writeStoredJson(FILTERS_STORAGE_KEY, filters);
  }, [filters]);

  useEffect(() => {
    if (columnSetsEqual(visibleColumnKeys, DEFAULT_VISIBLE_COLUMN_KEYS)) {
      removeStored(COLUMNS_STORAGE_KEY);
    } else {
      writeStoredJson(COLUMNS_STORAGE_KEY, visibleColumnKeys);
    }
  }, [visibleColumnKeys]);

  // Route resolution (tasks.md 10.6): for every aircraft with a callsign and
  // position not yet asked for locally, fetch once via the shared cache
  // (design.md Decision 9 — no additional throttling beyond that cache).
  // `requestedRouteKeysRef` only prevents this component from firing a
  // second redundant call for a key it already has in flight/resolved; the
  // module-level cache in `flightRoute.ts` is what actually prevents a
  // network re-fetch, shared with the selected-aircraft overlay.
  useEffect(() => {
    for (const a of aircraft) {
      if (!a.callsign || a.lat === undefined || a.lon === undefined) continue;
      const key = routeCacheKey(a.hex, a.callsign);
      if (requestedRouteKeysRef.current.has(key)) continue;
      requestedRouteKeysRef.current.add(key);
      const callsign = a.callsign;
      const lat = a.lat;
      const lon = a.lon;
      getCachedFlightRoute(a.hex, callsign, lat, lon).then((route) => {
        setRoutesByKey((prev) => ({ ...prev, [key]: route }));
      });
    }
  }, [aircraft]);

  const allRows = useMemo<PlaneListingRow[]>(() => {
    return aircraft.map((a) => {
      const row = buildPlaneListingRow(a, siteLocation);
      if (a.callsign) {
        const key = routeCacheKey(a.hex, a.callsign);
        if (key in routesByKey) row.route = routesByKey[key];
      }
      return row;
    });
  }, [aircraft, siteLocation, routesByKey]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (filters.altMin !== null && (row.altitude ?? -Infinity) < filters.altMin) return false;
      if (filters.altMax !== null && (row.altitude ?? Infinity) > filters.altMax) return false;
      if (filters.distMin !== null && (row.distanceNm ?? -Infinity) < filters.distMin) return false;
      if (filters.distMax !== null && (row.distanceNm ?? Infinity) > filters.distMax) return false;

      if (filters.callsign && !(row.callsign ?? "").toLowerCase().includes(filters.callsign.toLowerCase())) {
        return false;
      }
      if (filters.squawk && !(row.squawk ?? "").toLowerCase().includes(filters.squawk.toLowerCase())) {
        return false;
      }
      if (
        filters.registration &&
        !(row.registration ?? "").toLowerCase().includes(filters.registration.toLowerCase())
      ) {
        return false;
      }
      if (filters.hex && !row.hex.toLowerCase().includes(filters.hex.toLowerCase())) return false;
      if (
        filters.typeCode &&
        !(row.typeDesignator ?? "").toLowerCase().includes(filters.typeCode.toLowerCase())
      ) {
        return false;
      }
      if (filters.typeDescription) {
        const description = typeDescriptionForCode(row.typeDesignator) ?? "";
        if (!description.toLowerCase().includes(filters.typeDescription.toLowerCase())) return false;
      }
      if (filters.route && !routeText(row).toLowerCase().includes(filters.route.toLowerCase())) {
        return false;
      }
      if (filters.country && !countryText(row).toLowerCase().includes(filters.country.toLowerCase())) {
        return false;
      }
      if (
        filters.category &&
        !(row.category ?? "").toLowerCase().includes(filters.category.toLowerCase())
      ) {
        return false;
      }
      if (filters.sourceBuckets.length > 0) {
        if (!filters.sourceBuckets.includes(bucketForSourceType(row.sourceType))) return false;
      }
      if (filters.dbFlags.length > 0) {
        const matchesAny = filters.dbFlags.some((flag) => {
          if (flag === "military") return !!row.isMilitary;
          if (flag === "pia") return !!row.isPia;
          return !!row.isLadd;
        });
        if (!matchesAny) return false;
      }

      if (query) {
        const haystack = `${row.callsign ?? ""} ${row.registration ?? ""} ${row.hex}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [allRows, search, filters]);

  const sortedRows = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key);
    if (!column || column.sortable === false) return filteredRows;
    const withValues = filteredRows.map((row) => ({ row, value: sortValue(row, sort.key) }));
    withValues.sort((a, b) => {
      if (a.value < b.value) return sort.dir === "asc" ? -1 : 1;
      if (a.value > b.value) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return withValues.map((w) => w.row);
  }, [filteredRows, sort]);

  const handleSort = (key: ColumnKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  const handleToggleColumn = (key: ColumnKey) => {
    setVisibleColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleToggleSourceBucket = (bucket: SourceBucket) => {
    if (bucket === "acars") return; // always disabled/no-op — no ACARS data source
    setFilters((prev) => ({
      ...prev,
      sourceBuckets: prev.sourceBuckets.includes(bucket)
        ? prev.sourceBuckets.filter((b) => b !== bucket)
        : [...prev.sourceBuckets, bucket],
    }));
  };

  const handleToggleDbFlag = (flag: DbFlag) => {
    setFilters((prev) => ({
      ...prev,
      dbFlags: prev.dbFlags.includes(flag)
        ? prev.dbFlags.filter((f) => f !== flag)
        : [...prev.dbFlags, flag],
    }));
  };

  const selectedSourceBuckets = useMemo(() => new Set(filters.sourceBuckets), [filters.sourceBuckets]);

  const handleResetColumnsToDefault = () => setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMN_KEYS);
  const handleShowAllColumns = () => setVisibleColumnKeys(COLUMNS.map((c) => c.key));

  const handleClearAll = () => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMN_KEYS);
    removeStored(SEARCH_STORAGE_KEY);
    removeStored(FILTERS_STORAGE_KEY);
    removeStored(COLUMNS_STORAGE_KEY);
  };

  return (
    <div className={styles.listing}>
      <div className={styles.tabnav}>
        <button
          type="button"
          className={styles.tabButton}
          data-active={activeTab === "search"}
          onClick={() => setActiveTab("search")}
        >
          Search
        </button>
        <button
          type="button"
          className={styles.tabButton}
          data-active={activeTab === "filters"}
          onClick={() => setActiveTab("filters")}
        >
          Filters
        </button>
        <button
          type="button"
          className={styles.tabButton}
          data-active={activeTab === "columns"}
          onClick={() => setActiveTab("columns")}
        >
          Columns
        </button>
      </div>

      <div className={styles.tabpanel} hidden={activeTab !== "search"}>
        <div className={styles.searchInput}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search callsign, registration, or hex"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.tabpanel} hidden={activeTab !== "filters"}>
        <div className={styles.fieldLabel}>Altitude (ft)</div>
        <div className={styles.rangeRow}>
          <input
            type="number"
            placeholder="Min"
            value={filters.altMin ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                altMin: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
          />
          <span>–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.altMax ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                altMax: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
          />
        </div>
        <div className={styles.fieldLabel}>Distance (nm)</div>
        <div className={styles.rangeRow}>
          <input
            type="number"
            placeholder="Min"
            value={filters.distMin ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                distMin: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
          />
          <span>–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.distMax ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                distMax: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
          />
        </div>

        <div className={styles.fieldLabel}>Fields</div>
        <div className={styles.textFieldGrid}>
          <label className={styles.textField}>
            <span>Callsign</span>
            <input
              type="text"
              value={filters.callsign}
              onChange={(event) => setFilters((prev) => ({ ...prev, callsign: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Squawk</span>
            <input
              type="text"
              value={filters.squawk}
              onChange={(event) => setFilters((prev) => ({ ...prev, squawk: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Registration</span>
            <input
              type="text"
              value={filters.registration}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, registration: event.target.value }))
              }
            />
          </label>
          <label className={styles.textField}>
            <span>ICAO hex ID</span>
            <input
              type="text"
              value={filters.hex}
              onChange={(event) => setFilters((prev) => ({ ...prev, hex: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Type code</span>
            <input
              type="text"
              value={filters.typeCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, typeCode: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Type description</span>
            <input
              type="text"
              value={filters.typeDescription}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, typeDescription: event.target.value }))
              }
            />
          </label>
          <label className={styles.textField}>
            <span>Route</span>
            <input
              type="text"
              value={filters.route}
              onChange={(event) => setFilters((prev) => ({ ...prev, route: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Country of registration</span>
            <input
              type="text"
              value={filters.country}
              onChange={(event) => setFilters((prev) => ({ ...prev, country: event.target.value }))}
            />
          </label>
          <label className={styles.textField}>
            <span>Category</span>
            <input
              type="text"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            />
          </label>
        </div>

        <div className={styles.fieldLabel}>Source</div>
        <SourceChipRow selected={selectedSourceBuckets} onToggle={handleToggleSourceBucket} />

        <div className={styles.fieldLabel}>DB flags</div>
        <div className={styles.chipFieldRow}>
          {DB_FLAGS.map((flag) => (
            <button
              key={flag.key}
              type="button"
              className={styles.dbFlagChip}
              data-selected={filters.dbFlags.includes(flag.key)}
              aria-pressed={filters.dbFlags.includes(flag.key)}
              onClick={() => handleToggleDbFlag(flag.key)}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabpanel} hidden={activeTab !== "columns"}>
        <div className={styles.colActions}>
          <button type="button" onClick={handleResetColumnsToDefault}>
            Reset defaults
          </button>
          <button type="button" onClick={handleShowAllColumns}>
            Show all
          </button>
          <button type="button" onClick={handleClearAll}>
            Clear all
          </button>
        </div>
        <div className={styles.colGrid}>
          {COLUMNS.map((column) => (
            <label key={column.key} className={styles.colItem}>
              <input
                type="checkbox"
                checked={visibleColumnKeys.includes(column.key)}
                onChange={() => handleToggleColumn(column.key)}
              />
              {column.label}
            </label>
          ))}
        </div>
      </div>

      <PlaneTable
        rows={sortedRows}
        totalCount={allRows.length}
        visibleColumnKeys={visibleColumnKeys}
        sort={sort}
        onSort={handleSort}
        selectedHex={selectedHex}
        onRowClick={
          onAircraftClick
            ? (hex) => onAircraftClick(hex, aircraft.find((a) => a.hex === hex))
            : undefined
        }
      />
      <SourceChipRow selected={selectedSourceBuckets} onToggle={handleToggleSourceBucket} />
    </div>
  );
}

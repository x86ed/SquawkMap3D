import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./PlaneListingPanel.module.css";
import { fetchAircraft, type Aircraft } from "../aircraft";
import { AIRCRAFT_FEED_REFRESH_INTERVAL_MS } from "../constants";
import type { GeoCoords } from "../geolocation";
import { getCachedFlightRoute, type FlightRoute } from "../flightRoute";
import { buildPlaneListingRow, type PlaneListingRow } from "./aircraftDisplay";
import { COLUMNS, DEFAULT_VISIBLE_COLUMN_KEYS, sortValue, type ColumnKey } from "./columns";
import { PlaneTable, type SortState } from "./PlaneTable";

const SEARCH_STORAGE_KEY = "squawkmap3d:planeListing:search";
const FILTERS_STORAGE_KEY = "squawkmap3d:planeListing:filters";
const COLUMNS_STORAGE_KEY = "squawkmap3d:planeListing:columns";

interface Filters {
  militaryOnly: boolean;
  altMin: number | null;
  altMax: number | null;
  distMin: number | null;
  distMax: number | null;
}

const DEFAULT_FILTERS: Filters = {
  militaryOnly: false,
  altMin: null,
  altMax: null,
  distMin: null,
  distMax: null,
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

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.militaryOnly === b.militaryOnly &&
    a.altMin === b.altMin &&
    a.altMax === b.altMax &&
    a.distMin === b.distMin &&
    a.distMax === b.distMax
  );
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
export function PlaneListingPanel({ siteLocation }: { siteLocation: GeoCoords | null }) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [routesByKey, setRoutesByKey] = useState<Record<string, FlightRoute | null>>({});
  const requestedRouteKeysRef = useRef<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [search, setSearch] = useState<string>(() => readStoredJson<string>(SEARCH_STORAGE_KEY) ?? "");
  const [filters, setFilters] = useState<Filters>(
    () => readStoredJson<Filters>(FILTERS_STORAGE_KEY) ?? DEFAULT_FILTERS,
  );
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
      if (filters.militaryOnly && !row.isMilitary) return false;
      if (filters.altMin !== null && (row.altitude ?? -Infinity) < filters.altMin) return false;
      if (filters.altMax !== null && (row.altitude ?? Infinity) > filters.altMax) return false;
      if (filters.distMin !== null && (row.distanceNm ?? -Infinity) < filters.distMin) return false;
      if (filters.distMax !== null && (row.distanceNm ?? Infinity) > filters.distMax) return false;
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
        <div className={styles.filterToggleRow}>
          <span>Military only</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.militaryOnly}
            data-on={filters.militaryOnly}
            className={styles.filterSwitch}
            onClick={() =>
              setFilters((prev) => ({ ...prev, militaryOnly: !prev.militaryOnly }))
            }
          >
            <span className={styles.filterSwitchThumb} />
          </button>
        </div>
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
      />
    </div>
  );
}

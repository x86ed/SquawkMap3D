import styles from "./PlaneTable.module.css";
import { COLUMNS, formatCell, type ColumnKey } from "./columns";
import type { PlaneListingRow } from "./aircraftDisplay";
import { RARITY_TIER_STYLES } from "../aircraftRarity";
import { bucketForSourceType } from "./sourceBucket";

const SOURCE_ROW_CLASS: Record<string, string> = {
  adsb: styles.rowAdsb,
  uat_adsr: styles.rowUatAdsr,
  mlat: styles.rowMlat,
  tisb: styles.rowTisb,
  mode_s: styles.rowModeS,
  other: styles.rowOther,
};

export interface SortState {
  key: ColumnKey;
  dir: "asc" | "desc";
}

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") {
    return (
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
      <polyline points="8 9 12 5 16 9" />
      <polyline points="8 15 12 19 16 15" />
    </svg>
  );
}

function alignClass(align: "left" | "right" | "center"): string | undefined {
  if (align === "right") return styles.right;
  if (align === "center") return styles.center;
  return undefined;
}

function CellContent({ row, columnKey }: { row: PlaneListingRow; columnKey: ColumnKey }) {
  const text = formatCell(row, columnKey);

  if (columnKey === "flag") {
    if (!row.countryCode) return <span className={styles.muted}>{text}</span>;
    return (
      <img
        src={`/flags/${row.countryCode.toLowerCase()}.svg`}
        alt={`${row.countryCode} flag`}
        width={18}
        height={13}
        className={styles.flagImg}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  if (columnKey === "callsign") {
    return <span className={styles.callsignCell}>{text}</span>;
  }

  if (columnKey === "hex") {
    return <span className={styles.muted}>{text}</span>;
  }

  if (columnKey === "squawk" && row.squawk && EMERGENCY_SQUAWKS.has(row.squawk)) {
    return <span className={styles.badgeEmerg}>{text}</span>;
  }

  if (columnKey === "mil") {
    return row.isMilitary ? (
      <span className={styles.badgeMil}>{text}</span>
    ) : (
      <span className={styles.muted}>{text}</span>
    );
  }

  if (columnKey === "vrate") {
    if (row.verticalRate === undefined) return <>{text}</>;
    if (row.verticalRate === 0) return <span className={styles.vrLevel}>{text}</span>;
    return (
      <span className={row.verticalRate > 0 ? styles.vrUp : styles.vrDown}>{text}</span>
    );
  }

  if (columnKey === "rarity") {
    const { color } = RARITY_TIER_STYLES[row.rarityTier];
    return (
      <span className={styles.badge} style={{ color }}>
        {text}
      </span>
    );
  }

  return <>{text}</>;
}

/**
 * Sortable data table of currently-tracked aircraft (plane-listing-panel's
 * "Sortable data table with the full column set" requirement) — plain
 * `<table>`/`<tbody>`, no virtualization (design.md Decision 10).
 */
export function PlaneTable({
  rows,
  totalCount,
  visibleColumnKeys,
  sort,
  onSort,
}: {
  rows: PlaneListingRow[];
  totalCount: number;
  visibleColumnKeys: ColumnKey[];
  sort: SortState;
  onSort: (key: ColumnKey) => void;
}) {
  const visibleColumns = COLUMNS.filter((c) => visibleColumnKeys.includes(c.key));

  return (
    <div className={styles.wrap}>
      <div className={styles.status}>
        <span>
          Showing {rows.length} of {totalCount} aircraft
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const sortable = column.sortable !== false;
                const active = sortable && sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    className={[alignClass(column.align), active ? styles.sorted : undefined]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={sortable ? () => onSort(column.key) : undefined}
                    style={sortable ? { cursor: "pointer" } : undefined}
                  >
                    {column.label}
                    {sortable && (
                      <span className={styles.sortIcon}>
                        <SortIcon dir={active ? sort.dir : null} />
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={visibleColumns.length}>
                  {totalCount === 0
                    ? "No aircraft tracked."
                    : "No aircraft match your search or filters."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.hex} className={SOURCE_ROW_CLASS[bucketForSourceType(row.sourceType)]}>
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={alignClass(column.align)}>
                      <CellContent row={row} columnKey={column.key} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The 7 source buckets used by the Filters tab's Source chip row and the
 * plane-listing table's row coloring (design.md Decision 14/15). "acars" is
 * never returned by `bucketForSourceType` — this application has no ACARS
 * data source, so no aircraft can ever resolve to it; the chip exists only
 * as a disabled/no-op UI element (design.md Decision 14's "explicit
 * placeholder, not fabricated" principle).
 */
export type SourceBucket = "adsb" | "uat_adsr" | "mlat" | "tisb" | "mode_s" | "other" | "acars";

export interface SourceBucketDef {
  key: SourceBucket;
  label: string;
  disabled?: boolean;
}

/** Chip definitions in display order, shared by every render of
 * `SourceChipRow` (design.md Decision 15 — one shared component/state). */
export const SOURCE_BUCKETS: SourceBucketDef[] = [
  { key: "adsb", label: "ADS-B" },
  { key: "uat_adsr", label: "UAT/ADS-R" },
  { key: "mlat", label: "MLAT" },
  { key: "tisb", label: "TIS-B" },
  { key: "mode_s", label: "Mode-S" },
  { key: "other", label: "Other" },
  { key: "acars", label: "ACARS", disabled: true },
];

const ADSB_TYPES = new Set(["adsb_icao", "adsb_icao_nt", "adsb_other", "adsb_nonicao"]);
const UAT_ADSR_TYPES = new Set(["adsr_icao", "adsr_other", "adsr_nonicao", "uat", "adsc"]);
const TISB_TYPES = new Set(["tisb_icao", "tisb_other", "tisb_nonicao", "tisb_trackfile"]);
const MODE_S_TYPES = new Set(["mode_s", "mode_ac"]);

/**
 * Resolves readsb's raw `sourceType` (its own `type` field) to one of the 7
 * source buckets, per design.md Decision 14's exact mapping. `undefined` and
 * any unrecognized value both resolve to "other" (readsb/tar1090's own
 * catch-all), never `null`, since every row's background/filter membership
 * needs exactly one bucket.
 */
export function bucketForSourceType(sourceType: string | undefined): SourceBucket {
  if (!sourceType) return "other";
  if (ADSB_TYPES.has(sourceType)) return "adsb";
  if (UAT_ADSR_TYPES.has(sourceType)) return "uat_adsr";
  if (sourceType === "mlat") return "mlat";
  if (TISB_TYPES.has(sourceType)) return "tisb";
  if (MODE_S_TYPES.has(sourceType)) return "mode_s";
  return "other";
}

import styles from "./SourceChipRow.module.css";
import { SOURCE_BUCKETS, type SourceBucket } from "./sourceBucket";

/**
 * Multi-select row of colored source-bucket toggle chips (design.md
 * Decisions 14/15) — one shared component/state rendered in two places:
 * inside the Filters tab and pinned beneath `PlaneTable`. Both callers pass
 * the exact same `selected`/`onToggle` state, so clicking a chip in either
 * location toggles the same underlying filter (plane-listing-panel spec's
 * "Clicking a legend chip toggles the Source filter" scenario) — this is
 * not two separate copies of the UI, just two render sites for one control.
 * The ACARS chip always renders `disabled` — this application has no ACARS
 * data source, so selecting it would never match anything.
 */
export function SourceChipRow({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<SourceBucket>;
  onToggle: (bucket: SourceBucket) => void;
}) {
  return (
    <div className={styles.row}>
      {SOURCE_BUCKETS.map((bucket) => (
        <button
          key={bucket.key}
          type="button"
          className={`${styles.chip} ${styles[bucket.key]}`}
          data-selected={selected.has(bucket.key)}
          disabled={bucket.disabled}
          aria-pressed={selected.has(bucket.key)}
          onClick={() => onToggle(bucket.key)}
        >
          <span className={styles.dot} />
          {bucket.label}
        </button>
      ))}
    </div>
  );
}

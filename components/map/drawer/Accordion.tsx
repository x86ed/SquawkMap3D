import { useState, type ReactNode } from "react";
import styles from "./Accordion.module.css";

/**
 * Toggle switch primitive (layer-control-drawer's `.switch` chrome), used
 * both by `LayerToggleRow` below and directly by filter toggles in
 * `PlaneListingPanel`'s Filters tab.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.switch}
      data-on={checked}
      onClick={onChange}
    >
      <span className={styles.thumb} />
    </button>
  );
}

/**
 * One layer-visibility row inside an `AccordionGroup` (layer-control-drawer's
 * "Toggling a layer row shows or hides that layer" scenario). `disabled`
 * renders a dimmed, no-op switch (task 5.2) — the Wildfires placeholder row.
 */
export function LayerToggleRow({
  name,
  tag,
  checked,
  onToggle,
  disabled,
}: {
  name: string;
  tag?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.layerRow} data-disabled={disabled}>
      <span className={styles.layerName}>
        {name}
        {tag && <span className={styles.tag}>{tag}</span>}
      </span>
      <Switch
        checked={checked}
        onChange={disabled ? () => {} : onToggle}
        disabled={disabled}
        label={name}
      />
    </div>
  );
}

/**
 * Collapsible accordion group (layer-control-drawer's "Accordion-grouped
 * layer controls" requirement) — header with icon/title/description/count
 * and a chevron, collapsible body. Manages its own open/closed UI state
 * (not layer-visibility state, which stays owned by `MapView.tsx` and is
 * only read/written via each row's own `checked`/`onToggle` props) so
 * expanding one group never affects another's expanded state (the
 * "Accordion group expands and collapses independently" scenario).
 * Reusable recursively (task 5.3) — the Weather row inside Environmental is
 * itself another `AccordionGroup` nested in this one's `children`, giving
 * the same open/closed chevron mechanic one level deeper (design.md
 * Decision 4).
 */
export function AccordionGroup({
  icon,
  title,
  description,
  count,
  defaultOpen = false,
  nested = false,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  count?: string;
  defaultOpen?: boolean;
  nested?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.group} data-open={open} data-nested={nested}>
      <button
        type="button"
        className={styles.groupButton}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.text}>
          <div className={styles.groupTitle}>{title}</div>
          {description && <div className={styles.groupDescription}>{description}</div>}
        </span>
        {count && <span className={styles.count}>{count}</span>}
        <span className={styles.chevron} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div className={styles.content}>
        <div>
          <div className={styles.inner}>{children}</div>
        </div>
      </div>
    </div>
  );
}

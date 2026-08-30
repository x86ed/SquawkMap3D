import styles from "./DrawerTabs.module.css";

export type DrawerTabKey = "layers" | "aircraft";

const TABS: { key: DrawerTabKey; label: string }[] = [
  { key: "layers", label: "Layers" },
  { key: "aircraft", label: "Aircraft" },
];

/**
 * Top-level, mutually-exclusive Layers/Aircraft tab bar (layer-control-
 * drawer's "Top-level Layers/Aircraft tab navigation" requirement,
 * design.md Decision 17) — rendered directly below the drawer header, above
 * everything else in the drawer body. Deliberately a filled segmented-button
 * style so it reads as a different, higher level of navigation than the
 * Aircraft tab's own nested Search/Filters/Columns underline-style sub-tab
 * nav (`PlaneListingPanel.module.css`'s `.tabnav`/`.tabButton`).
 */
export function DrawerTabs({
  active,
  onChange,
}: {
  active: DrawerTabKey;
  onChange: (tab: DrawerTabKey) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Drawer sections">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={styles.tab}
          data-active={active === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

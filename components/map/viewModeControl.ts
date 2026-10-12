import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import type { ViewMode } from "./viewMode";

interface ViewModeControlOptions {
  getMode: () => ViewMode;
  onToggle: () => void;
}

/** A separate button below the NavigationControl group — the compass keeps
 * its own reset-north behavior and is never touched here. The label shows
 * the CURRENT mode; title/aria-label name the action a click performs. */
export class ViewModeControl implements IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  constructor(private readonly options: ViewModeControlOptions) {}

  onAdd(_map: MapLibreMap): HTMLElement {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-view-mode";
    button.addEventListener("click", () => this.options.onToggle());
    container.appendChild(button);
    this.container = container;
    this.button = button;
    this.setMode(this.options.getMode());
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.button = null;
  }

  setMode(mode: ViewMode): void {
    if (!this.button) return;
    const target = mode === "2d" ? "3D" : "2D";
    this.button.textContent = mode === "2d" ? "2D" : "3D";
    this.button.title = `Switch to ${target} view`;
    this.button.setAttribute("aria-label", `Switch to ${target} view`);
  }
}

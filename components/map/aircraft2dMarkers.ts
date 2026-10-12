import type { Aircraft } from "./aircraft";
import { GENERIC_ICON_KEY } from "./aircraftIcons";
import {
  AIRCRAFT_ICON_SIZE_PIXELS,
  MARKER_CULL_DEBOUNCE_MS,
  MARKER_VIEWPORT_PADDING,
  MAX_2D_DOM_MARKERS,
  ROTOR_ANIMATION_MAX_FPS,
} from "./constants";
import { applyRotorSpin, readRotorBindings, resetRotors, type RotorBinding } from "./rotorSpin";
import { computeTightViewBox } from "./svgBBox";

export const AIRCRAFT_2D_MARKER_CLASS = "aircraft-2d-marker";
export const AIRCRAFT_2D_MARKER_SELECTED_CLASS = "aircraft-2d-marker--selected";
export const AIRCRAFT_TINT_PROPERTY = "--aircraft-tint";

// The atlas draws a shape at 84/96 of its icon cell (aircraftIcons.ts's
// CELL_SIZE/CELL_PADDING); the same ratio keeps a marker the same on-screen
// size as the fallback IconLayer icon.
const MARKER_SVG_SIZE_PIXELS = Math.round((AIRCRAFT_ICON_SIZE_PIXELS * 84) / 96);

type PositionedAircraft = Aircraft & { lat: number; lon: number };

export interface MarkerLike {
  setLngLat(lngLat: [number, number]): unknown;
  setRotation(degrees: number): unknown;
  addTo(map: never): unknown;
  remove(): unknown;
}

export interface MarkerMapLike {
  project(lngLat: [number, number]): { x: number; y: number };
  getContainer(): {
    clientWidth: number;
    clientHeight: number;
    getBoundingClientRect?: () => { left: number; top: number };
  };
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
}

export interface MarkerUpdateInputs {
  selectedId: string | null;
  hoveredId: string | null;
  colorFor: (aircraft: Aircraft) => [number, number, number];
}

export interface Aircraft2dMarkerOptions {
  map: MarkerMapLike;
  /** Wraps `element` in a MapLibre `Marker` (anchor center, map-aligned). */
  createMarker: (element: HTMLElement) => MarkerLike;
  resolveTypeKey: (aircraft: Aircraft) => string;
  onSelect: (hex: string, aircraft: Aircraft) => void;
  /** `x`/`y` are relative to the map container, like deck.gl's `info.x/y`. */
  onHover: (aircraft: PositionedAircraft | null, x: number, y: number) => void;
  /** Called when a viewport move or a finished SVG load changes the set of
   * marker-held ids outside of an `update()` call. */
  onMarkerIdsChange: (ids: ReadonlySet<string>) => void;
  /** Resolves a ready-to-clone `<svg>` for a type key, or null. */
  loadTemplate?: (typeKey: string) => Promise<Element | null>;
  maxMarkers?: number;
  viewportPadding?: number;
}

export interface Aircraft2dMarkerManager {
  update(aircraft: Aircraft[], inputs: MarkerUpdateInputs): ReadonlySet<string>;
  /** Re-runs culling/cap with the last inputs and reports changed ids. */
  reevaluate(): void;
  getMarkerIds(): ReadonlySet<string>;
  /** Removes every marker, empties the pool, stops the rotor loop. */
  clear(): void;
  destroy(): void;
}

interface MarkerEntry {
  id: string;
  aircraft: PositionedAircraft;
  marker: MarkerLike;
  root: HTMLElement;
  svg: Element;
  bindings: RotorBinding[];
  typeKey: string;
  tint: string;
  attached: boolean;
}

/** Default template loader: fetches the vendored per-type SVG, parses it,
 * crops its viewBox to the real drawing (same crop the atlas uses) and sets
 * the on-screen size. Pivots stay valid since they are in user units. */
export async function loadAircraftSvgTemplate(typeKey: string): Promise<Element | null> {
  if (typeKey === GENERIC_ICON_KEY) return null;
  let response: Response;
  try {
    response = await fetch(`/aircraft-shapes/${encodeURIComponent(typeKey)}.svg`);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const doc = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) return null;
  const imported = document.importNode(svg, true) as unknown as SVGSVGElement;
  const viewBox = imported.getAttribute("viewBox") ?? "0 0 100 100";
  imported.setAttribute("viewBox", computeTightViewBox(imported.innerHTML, viewBox));
  imported.setAttribute("width", String(MARKER_SVG_SIZE_PIXELS));
  imported.setAttribute("height", String(MARKER_SVG_SIZE_PIXELS));
  return imported;
}

export function createAircraft2dMarkerManager(
  options: Aircraft2dMarkerOptions,
): Aircraft2dMarkerManager {
  const {
    map,
    createMarker,
    resolveTypeKey,
    onSelect,
    onHover,
    onMarkerIdsChange,
    loadTemplate = loadAircraftSvgTemplate,
    maxMarkers = MAX_2D_DOM_MARKERS,
    viewportPadding = MARKER_VIEWPORT_PADDING,
  } = options;

  const live = new Map<string, MarkerEntry>();
  const parked = new Map<string, MarkerEntry[]>();
  let parkedCount = 0;
  const templates = new Map<string, Element | null>();
  const pendingLoads = new Set<string>();

  let lastAircraft: Aircraft[] | null = null;
  let lastInputs: MarkerUpdateInputs | null = null;
  let destroyed = false;
  let cullTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId: number | null = null;
  let lastFrameMs = -Infinity;
  let currentIds: ReadonlySet<string> = new Set();

  const containerPoint = (clientX: number, clientY: number) => {
    const rect = map.getContainer().getBoundingClientRect?.();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const ensureTemplate = (typeKey: string): Element | null => {
    if (templates.has(typeKey)) return templates.get(typeKey) ?? null;
    if (!pendingLoads.has(typeKey)) {
      pendingLoads.add(typeKey);
      loadTemplate(typeKey)
        .catch(() => null)
        .then((template) => {
          pendingLoads.delete(typeKey);
          templates.set(typeKey, template);
          if (!destroyed && template) reevaluate();
        });
    }
    return null;
  };

  const buildEntry = (id: string, aircraft: PositionedAircraft, typeKey: string, template: Element): MarkerEntry => {
    const root = document.createElement("div");
    root.className = AIRCRAFT_2D_MARKER_CLASS;
    const svg = template.cloneNode(true) as Element;
    root.appendChild(svg);
    const entry: MarkerEntry = {
      id,
      aircraft,
      marker: createMarker(root),
      root,
      svg,
      bindings: readRotorBindings(svg),
      typeKey,
      tint: "",
      attached: false,
    };
    root.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(entry.id, entry.aircraft);
    });
    root.addEventListener("mouseenter", (event) => {
      const e = event as MouseEvent;
      const p = containerPoint(e.clientX, e.clientY);
      onHover(entry.aircraft, p.x, p.y);
    });
    root.addEventListener("mouseleave", () => onHover(null, 0, 0));
    return entry;
  };

  const swapSvg = (entry: MarkerEntry, typeKey: string, template: Element) => {
    resetRotors(entry.bindings);
    const svg = template.cloneNode(true) as Element;
    entry.root.replaceChild(svg, entry.svg);
    entry.svg = svg;
    entry.bindings = readRotorBindings(svg);
    entry.typeKey = typeKey;
  };

  const park = (entry: MarkerEntry) => {
    live.delete(entry.id);
    if (entry.attached) {
      entry.marker.remove();
      entry.attached = false;
    }
    resetRotors(entry.bindings);
    entry.root.classList.remove(AIRCRAFT_2D_MARKER_SELECTED_CLASS);
    const list = parked.get(entry.typeKey) ?? [];
    list.push(entry);
    parked.set(entry.typeKey, list);
    parkedCount++;
    if (parkedCount > maxMarkers) {
      // Drop the oldest parked element of any type.
      for (const [key, items] of parked) {
        if (items.length === 0) continue;
        items.shift();
        parkedCount--;
        if (items.length === 0) parked.delete(key);
        break;
      }
    }
  };

  const takeParked = (typeKey: string): MarkerEntry | undefined => {
    const list = parked.get(typeKey);
    const entry = list?.pop();
    if (entry) {
      parkedCount--;
      if (list && list.length === 0) parked.delete(typeKey);
    }
    return entry;
  };

  const syncLoop = () => {
    const wanted =
      !destroyed && [...live.values()].some((entry) => entry.bindings.length > 0);
    if (!wanted) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  };

  // One shared loop, one common clock, DOM attribute writes only.
  const frame = (nowMs: number) => {
    rafId = requestAnimationFrame(frame);
    if (nowMs - lastFrameMs < 1000 / ROTOR_ANIMATION_MAX_FPS) return;
    lastFrameMs = nowMs;
    const t = nowMs / 1000;
    for (const entry of live.values()) {
      if (entry.bindings.length > 0) applyRotorSpin(entry.bindings, t);
    }
  };

  const idsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  };

  const apply = (aircraft: Aircraft[], inputs: MarkerUpdateInputs): ReadonlySet<string> => {
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const padX = w * viewportPadding;
    const padY = h * viewportPadding;
    const cx = w / 2;
    const cy = h / 2;

    const candidates: Array<{
      aircraft: PositionedAircraft;
      typeKey: string;
      template: Element;
      priority: number;
      dist: number;
    }> = [];
    for (const a of aircraft) {
      if (a.lat === undefined || a.lon === undefined) continue;
      const positioned = a as PositionedAircraft;
      const p = map.project([positioned.lon, positioned.lat]);
      if (p.x < -padX || p.x > w + padX || p.y < -padY || p.y > h + padY) continue;
      const typeKey = resolveTypeKey(positioned);
      // Not loaded yet (or none exists): stays on the IconLayer fallback.
      const template = ensureTemplate(typeKey);
      if (!template) continue;
      const priority = a.hex === inputs.selectedId || a.hex === inputs.hoveredId ? 0 : 1;
      candidates.push({
        aircraft: positioned,
        typeKey,
        template,
        priority,
        dist: (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy),
      });
    }
    candidates.sort((a, b) => a.priority - b.priority || a.dist - b.dist);
    const chosen = candidates.slice(0, maxMarkers);
    const chosenIds = new Set(chosen.map((c) => c.aircraft.hex));

    for (const entry of [...live.values()]) {
      if (!chosenIds.has(entry.id)) park(entry);
    }

    for (const c of chosen) {
      const id = c.aircraft.hex;
      let entry = live.get(id);
      if (!entry) {
        entry = takeParked(c.typeKey);
        if (entry) {
          entry.id = id;
          entry.aircraft = c.aircraft;
        } else {
          entry = buildEntry(id, c.aircraft, c.typeKey, c.template);
        }
        live.set(id, entry);
      } else if (entry.typeKey !== c.typeKey) {
        swapSvg(entry, c.typeKey, c.template);
      }
      entry.aircraft = c.aircraft;
      entry.marker.setLngLat([c.aircraft.lon, c.aircraft.lat]);
      entry.marker.setRotation(c.aircraft.track ?? 0);
      if (!entry.attached) {
        entry.marker.addTo(map as never);
        entry.attached = true;
      }
      const [r, g, b] = inputs.colorFor(c.aircraft);
      const tint = `rgb(${r}, ${g}, ${b})`;
      if (entry.tint !== tint) {
        entry.root.style.setProperty(AIRCRAFT_TINT_PROPERTY, tint);
        entry.tint = tint;
      }
      entry.root.classList.toggle(AIRCRAFT_2D_MARKER_SELECTED_CLASS, id === inputs.selectedId);
    }

    syncLoop();
    currentIds = new Set(live.keys());
    return currentIds;
  };

  function reevaluate() {
    if (destroyed || !lastAircraft || !lastInputs) return;
    const before = currentIds;
    const after = apply(lastAircraft, lastInputs);
    if (!idsEqual(before, after)) onMarkerIdsChange(after);
  }

  const onMapMoveEnd = () => {
    if (cullTimer !== null) clearTimeout(cullTimer);
    cullTimer = setTimeout(() => {
      cullTimer = null;
      reevaluate();
    }, MARKER_CULL_DEBOUNCE_MS);
  };
  map.on("moveend", onMapMoveEnd);
  map.on("zoomend", onMapMoveEnd);

  const clear = () => {
    lastAircraft = null;
    lastInputs = null;
    if (cullTimer !== null) {
      clearTimeout(cullTimer);
      cullTimer = null;
    }
    for (const entry of [...live.values()]) {
      live.delete(entry.id);
      if (entry.attached) entry.marker.remove();
      entry.attached = false;
    }
    parked.clear();
    parkedCount = 0;
    currentIds = new Set();
    syncLoop();
  };

  return {
    update(aircraft, inputs) {
      lastAircraft = aircraft;
      lastInputs = inputs;
      if (destroyed) return currentIds;
      return apply(aircraft, inputs);
    },
    reevaluate,
    getMarkerIds: () => currentIds,
    clear,
    destroy() {
      clear();
      destroyed = true;
      map.off("moveend", onMapMoveEnd);
      map.off("zoomend", onMapMoveEnd);
      syncLoop();
    },
  };
}

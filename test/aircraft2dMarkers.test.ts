import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AIRCRAFT_2D_MARKER_SELECTED_CLASS,
  AIRCRAFT_TINT_PROPERTY,
  createAircraft2dMarkerManager,
  type MarkerLike,
  type MarkerMapLike,
} from "../components/map/aircraft2dMarkers";
import { MAX_2D_DOM_MARKERS } from "../components/map/constants";
import type { Aircraft } from "../components/map/aircraft";

// --- Minimal fake DOM (no jsdom in this repo) ---

class FakeEl {
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  className = "";
  props = new Map<string, string>();
  classes = new Set<string>();
  listeners = new Map<string, Array<(e: unknown) => void>>();
  style = { setProperty: (k: string, v: string) => this.props.set(k, v) };
  classList = {
    add: (c: string) => this.classes.add(c),
    remove: (c: string) => this.classes.delete(c),
    toggle: (c: string, on: boolean) => (on ? this.classes.add(c) : this.classes.delete(c)),
  };
  constructor(public tag: string, attrs: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
  appendChild(c: FakeEl) {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  replaceChild(n: FakeEl, o: FakeEl) {
    this.children[this.children.indexOf(o)] = n;
    n.parent = this;
    o.parent = null;
    return o;
  }
  cloneNode(deep: boolean): FakeEl {
    const c = new FakeEl(this.tag, Object.fromEntries(this.attrs));
    if (deep) for (const ch of this.children) c.appendChild(ch.cloneNode(true));
    return c;
  }
  addEventListener(t: string, fn: (e: unknown) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  fire(t: string, e: unknown = {}) {
    for (const fn of this.listeners.get(t) ?? []) fn(e);
  }
  descendants(): FakeEl[] {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  querySelectorAll(sel: string) {
    assert.equal(sel, "[data-rotor]");
    return this.descendants().filter((d) => d.attrs.has("data-rotor"));
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let rafCallbacks: Map<number, (t: number) => void>;
let nextRaf: number;
const saved: Record<string, unknown> = {};

beforeEach(() => {
  rafCallbacks = new Map();
  nextRaf = 1;
  for (const k of ["document", "requestAnimationFrame", "cancelAnimationFrame"]) saved[k] = g[k];
  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    rafCallbacks.set(nextRaf, cb);
    return nextRaf++;
  };
  g.cancelAnimationFrame = (id: number) => void rafCallbacks.delete(id);
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) g[k] = v;
});

function stepFrame(nowMs: number) {
  const cbs = [...rafCallbacks.values()];
  rafCallbacks.clear();
  for (const cb of cbs) cb(nowMs);
}

// --- Harness ---

const W = 1000;
const H = 800;

class FakeMarker implements MarkerLike {
  lngLat: [number, number] | null = null;
  rotation = 0;
  added = 0;
  removed = 0;
  attached = false;
  constructor(public element: FakeEl) {}
  setLngLat(l: [number, number]) {
    this.lngLat = l;
  }
  setRotation(d: number) {
    this.rotation = d;
  }
  addTo() {
    this.added++;
    this.attached = true;
  }
  remove() {
    this.removed++;
    this.attached = false;
  }
}

// lon -> x pixels, lat -> y pixels directly: project([lon, lat]) = {x: lon, y: lat}.
function harness(opts: { maxMarkers?: number; rotorTypes?: string[] } = {}) {
  const mapListeners = new Map<string, Array<() => void>>();
  const map: MarkerMapLike = {
    project: ([x, y]) => ({ x, y }),
    getContainer: () => ({
      clientWidth: W,
      clientHeight: H,
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    }),
    on: (t, fn) => void mapListeners.set(t, [...(mapListeners.get(t) ?? []), fn]),
    off: (t, fn) => void mapListeners.set(t, (mapListeners.get(t) ?? []).filter((f) => f !== fn)),
  };
  const markers: FakeMarker[] = [];
  const selects: Array<[string, Aircraft]> = [];
  const hovers: Array<[string | null, number, number]> = [];
  const idChanges: Array<ReadonlySet<string>> = [];
  const rotorTypes = new Set(opts.rotorTypes ?? ["HELI"]);
  const manager = createAircraft2dMarkerManager({
    map,
    maxMarkers: opts.maxMarkers,
    createMarker: (el) => {
      const m = new FakeMarker(el as unknown as FakeEl);
      markers.push(m);
      return m;
    },
    resolveTypeKey: (a) => a.typeDesignator ?? "PLAIN",
    loadTemplate: async (key) => {
      const svg = new FakeEl("svg", { viewBox: "-10 -10 100 100" });
      svg.appendChild(new FakeEl("path"));
      if (rotorTypes.has(key)) {
        svg.appendChild(
          new FakeEl("g", {
            "data-rotor": "r1",
            "data-rotor-pivot": "5 7",
            "data-rotor-direction": "cw",
          }),
        );
        svg.appendChild(
          new FakeEl("g", {
            "data-rotor": "r1-mirror",
            "data-rotor-pivot": "-5 7",
            "data-rotor-direction": "ccw",
          }),
        );
      }
      return svg as unknown as Element;
    },
    onSelect: (hex, a) => void selects.push([hex, a]),
    onHover: (a, x, y) => void hovers.push([a?.hex ?? null, x, y]),
    onMarkerIdsChange: (ids) => void idChanges.push(ids),
  });
  return { manager, map, markers, selects, hovers, idChanges, mapListeners };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function ac(hex: string, x: number, y: number, extra: Partial<Aircraft> = {}): Aircraft {
  return { hex, lon: x, lat: y, track: 90, altitude: 5000, ...extra } as Aircraft;
}

const inputs = (over: Partial<Parameters<ReturnType<typeof harness>["manager"]["update"]>[1]> = {}) => ({
  selectedId: null,
  hoveredId: null,
  colorFor: () => [10, 20, 30] as [number, number, number],
  ...over,
});

async function populate(h: ReturnType<typeof harness>, list: Aircraft[], over = {}) {
  h.manager.update(list, inputs(over)); // kicks off template loads
  await tick();
  return h.manager.update(list, inputs(over));
}

// --- Tests ---

test("tints the whole SVG (rotor groups included) via one custom property; no-binding SVG gets no transform or extras", async () => {
  const h = harness();
  const ids = await populate(h, [ac("heli", 100, 100, { typeDesignator: "HELI" }), ac("plane", 200, 100)]);
  assert.deepEqual([...ids].sort(), ["heli", "plane"]);
  const [heliM, planeM] = h.markers;
  assert.equal(heliM.element.props.get(AIRCRAFT_TINT_PROPERTY), "rgb(10, 20, 30)");
  // Rotor groups are descendants of the tinted root; they carry no own tint.
  const svg = heliM.element.children[0];
  const rotors = svg.descendants().filter((d) => d.attrs.has("data-rotor"));
  assert.equal(rotors.length, 2);
  assert.ok(rotors.every((r) => !r.props.has(AIRCRAFT_TINT_PROPERTY) && !r.attrs.has("style")));

  stepFrame(1000);
  assert.equal(rotors[0].getAttribute("transform"), "rotate(0 5 7)");
  stepFrame(1250);
  assert.equal(rotors[0].getAttribute("transform"), "rotate(90 5 7)");
  assert.equal(rotors[1].getAttribute("transform"), "rotate(-90 -5 7)");

  const planeSvg = planeM.element.children[0];
  assert.equal(planeSvg.descendants().length, 1);
  assert.equal(planeSvg.descendants().some((d) => d.attrs.has("transform")), false);
  assert.equal(planeSvg.attrs.has("transform"), false);

  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  assert.match(css, /\.aircraft-2d-marker svg \*\s*\{[^}]*fill:\s*var\(--aircraft-tint\)/);
});

test("markers are positioned, rotated by track, and highlight the selected aircraft", async () => {
  const h = harness();
  await populate(h, [ac("a", 300, 200, { track: 135 }), ac("b", 400, 200)], { selectedId: "a" });
  const [a, b] = h.markers;
  assert.deepEqual(a.lngLat, [300, 200]);
  assert.equal(a.rotation, 135);
  assert.ok(a.element.classes.has(AIRCRAFT_2D_MARKER_SELECTED_CLASS));
  assert.ok(!b.element.classes.has(AIRCRAFT_2D_MARKER_SELECTED_CLASS));
});

test("culling excludes aircraft outside bounds plus padding and includes them after a move", async () => {
  const h = harness();
  const inside = ac("in", 500, 400);
  const nearEdge = ac("edge", W + 100, 400); // inside the 15% (150px) padding
  const outside = ac("out", W + 400, 400);
  const ids = await populate(h, [inside, nearEdge, outside]);
  assert.deepEqual([...ids].sort(), ["edge", "in"]);

  // The map "pans": the same geographic point now projects on-screen.
  outside.lon = 600;
  h.manager.reevaluate();
  assert.ok(h.manager.getMarkerIds().has("out"));
  assert.deepEqual([...h.idChanges.at(-1)!].sort(), ["edge", "in", "out"]);
});

test("moveend/zoomend are debounced and re-evaluate culling", async () => {
  const h = harness();
  const a = ac("a", 500, 400);
  const far = ac("far", 5000, 400);
  await populate(h, [a, far]);
  assert.ok(!h.manager.getMarkerIds().has("far"));
  far.lon = 500;
  for (const fn of h.mapListeners.get("moveend") ?? []) fn();
  for (const fn of h.mapListeners.get("zoomend") ?? []) fn();
  assert.ok(!h.manager.getMarkerIds().has("far")); // not yet: debounced
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(h.manager.getMarkerIds().has("far"));
});

test("cap leaves overflow out of domMarkerIds; selected and hovered first, then nearest the center", async () => {
  const h = harness({ maxMarkers: 3 });
  const list = [
    ac("c-far", 50, 50),
    ac("c-mid", 300, 300),
    ac("c-near", 480, 390),
    ac("sel", 900, 700),
    ac("hov", 20, 780),
  ];
  const ids = await populate(h, list, { selectedId: "sel", hoveredId: "hov" });
  assert.deepEqual([...ids].sort(), ["c-near", "hov", "sel"]);
  assert.ok(!ids.has("c-mid") && !ids.has("c-far"));
});

test("cap default is MAX_2D_DOM_MARKERS (300)", async () => {
  assert.equal(MAX_2D_DOM_MARKERS, 300);
  const h = harness();
  const list = Array.from({ length: 320 }, (_, i) => ac(`x${i}`, 100 + (i % 20) * 40, 100 + Math.floor(i / 20) * 30));
  const ids = await populate(h, list);
  assert.equal(ids.size, 300);
});

test("selected aircraft always gets a marker even when far from center under a full cap", async () => {
  const h = harness({ maxMarkers: 2 });
  const list = [ac("n1", 500, 400), ac("n2", 510, 400), ac("sel", 5, 5)];
  const ids = await populate(h, list, { selectedId: "sel" });
  assert.ok(ids.has("sel"));
  assert.equal(ids.size, 2);
});

test("aircraft whose SVG has not loaded stay out of domMarkerIds (IconLayer fallback) until it resolves", async () => {
  const h = harness();
  const ids = h.manager.update([ac("a", 100, 100)], inputs());
  assert.equal(ids.size, 0);
  await tick();
  assert.deepEqual([...h.idChanges.at(-1)!], ["a"]);
});

test("pooling reuses the Marker/element for the same id across polls and for a new id of the same type", async () => {
  const h = harness();
  await populate(h, [ac("a", 100, 100)]);
  assert.equal(h.markers.length, 1);
  h.manager.update([ac("a", 120, 110, { track: 10 })], inputs());
  assert.equal(h.markers.length, 1);
  assert.deepEqual(h.markers[0].lngLat, [120, 110]);
  assert.equal(h.markers[0].rotation, 10);
  assert.equal(h.markers[0].added, 1);

  // "a" leaves, "b" (same type) arrives: the parked element is reused.
  h.manager.update([ac("b", 300, 300)], inputs());
  assert.equal(h.markers.length, 1);
  assert.equal(h.markers[0].removed, 1);
  assert.equal(h.markers[0].added, 2);
  assert.deepEqual(h.markers[0].lngLat, [300, 300]);
});

test("clear() removes every marker and stops the rotor rAF loop", async () => {
  const h = harness();
  await populate(h, [ac("heli", 100, 100, { typeDesignator: "HELI" }), ac("p", 200, 200)]);
  assert.ok(rafCallbacks.size > 0);
  h.manager.clear();
  assert.ok(h.markers.every((m) => !m.attached));
  assert.equal(h.manager.getMarkerIds().size, 0);
  assert.equal(rafCallbacks.size, 0);
});

test("rotor loop does not run without a rotor-bearing marker", async () => {
  const h = harness();
  await populate(h, [ac("p", 200, 200)]);
  assert.equal(rafCallbacks.size, 0);
});

test("destroy() clears and unsubscribes from map events", async () => {
  const h = harness();
  await populate(h, [ac("heli", 100, 100, { typeDesignator: "HELI" })]);
  h.manager.destroy();
  assert.equal(rafCallbacks.size, 0);
  assert.equal((h.mapListeners.get("moveend") ?? []).length, 0);
});

// --- Interaction (4.3e) ---

test("marker click selects that aircraft and stops propagation so map deselect does not fire", async () => {
  const h = harness();
  await populate(h, [ac("a", 100, 100), ac("b", 200, 100)]);
  let stopped = 0;
  const target = h.markers.find((m) => m.lngLat?.[0] === 200)!;
  target.element.fire("click", { stopPropagation: () => stopped++ });
  assert.equal(stopped, 1);
  assert.equal(h.selects.length, 1);
  assert.equal(h.selects[0][0], "b");
});

test("marker hover reports the aircraft with container-relative coords; leave clears it", async () => {
  const h = harness();
  await populate(h, [ac("a", 100, 100)]);
  h.markers[0].element.fire("mouseenter", { clientX: 160, clientY: 270 });
  assert.deepEqual(h.hovers.at(-1), ["a", 150, 250]);
  h.markers[0].element.fire("mouseleave");
  assert.deepEqual(h.hovers.at(-1), [null, 0, 0]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { applyRotorSpin, readRotorBindings, resetRotors } from "../components/map/rotorSpin";
import { ROTOR_DISPLAY_REVS_PER_SECOND } from "../components/map/constants";

class FakeGroup {
  attrs = new Map<string, string>();
  constructor(attrs: Record<string, string>) {
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
}

function root(...groups: FakeGroup[]) {
  return {
    querySelectorAll: (sel: string) => {
      assert.equal(sel, "[data-rotor]");
      return groups;
    },
  };
}

function rotor(extra: Record<string, string> = {}) {
  return new FakeGroup({
    "data-rotor": "r1",
    "data-rotor-pivot": "144 296.35",
    "data-rotor-direction": "cw",
    "data-rotor-rpm": "600",
    ...extra,
  });
}

test("readRotorBindings parses pivot and cw/ccw sign", () => {
  const cw = rotor();
  const ccw = rotor({ "data-rotor-direction": "ccw", "data-rotor-pivot": "-10, 20" });
  const [a, b] = readRotorBindings(root(cw, ccw));
  assert.deepEqual({ cx: a.cx, cy: a.cy, sign: a.sign }, { cx: 144, cy: 296.35, sign: 1 });
  assert.deepEqual({ cx: b.cx, cy: b.cy, sign: b.sign }, { cx: -10, cy: 20, sign: -1 });
  assert.equal(a.el, cw);
});

test("readRotorBindings never assumes a direction and skips bad pivots", () => {
  for (const dir of [undefined, "", "CW", "clockwise"]) {
    const attrs: Record<string, string> = {};
    const g = rotor();
    if (dir === undefined) g.attrs.delete("data-rotor-direction");
    else attrs["data-rotor-direction"] = dir;
    const target = dir === undefined ? g : rotor(attrs);
    assert.deepEqual(readRotorBindings(root(target)), [], `direction ${String(dir)}`);
  }
  for (const pivot of ["", "1", "1 2 3", "a b", "NaN 4"]) {
    assert.deepEqual(readRotorBindings(root(rotor({ "data-rotor-pivot": pivot }))), [], pivot);
  }
});

test("mirror groups keep their own pivot and direction; rpm is ignored", () => {
  const main = rotor({ "data-rotor": "m", "data-rotor-rpm": "60" });
  const mirror = rotor({
    "data-rotor": "m-mirror",
    "data-rotor-pivot": "-144 296.35",
    "data-rotor-direction": "ccw",
    "data-rotor-rpm": "6000",
  });
  const bindings = readRotorBindings(root(main, mirror));
  assert.deepEqual(bindings.map((b) => [b.cx, b.sign]), [[144, 1], [-144, -1]]);
});

test("an SVG without bindings (fixed-wing, tail rotor, prop) yields none", () => {
  assert.deepEqual(readRotorBindings(root()), []);
});

test("applyRotorSpin writes rotate(deg cx cy) in viewBox units, 1 rev/s, cw positive, ccw negative", () => {
  assert.equal(ROTOR_DISPLAY_REVS_PER_SECOND, 1);
  const cw = rotor({ "data-rotor-rpm": "60" });
  const ccw = rotor({ "data-rotor-direction": "ccw", "data-rotor-rpm": "60000" });
  const bindings = readRotorBindings(root(cw, ccw));
  applyRotorSpin(bindings, 0.25);
  assert.equal(cw.getAttribute("transform"), "rotate(90 144 296.35)");
  assert.equal(ccw.getAttribute("transform"), "rotate(-90 144 296.35)");
  applyRotorSpin(bindings, 1.25);
  assert.equal(cw.getAttribute("transform"), "rotate(90 144 296.35)");
});

test("resetRotors removes the transform attribute", () => {
  const g = rotor();
  const bindings = readRotorBindings(root(g));
  applyRotorSpin(bindings, 0.1);
  assert.ok(g.getAttribute("transform"));
  resetRotors(bindings);
  assert.equal(g.getAttribute("transform"), null);
});

// --- Shipped assets ---

const SHAPES_DIR = path.join(process.cwd(), "public", "aircraft-shapes");

function groupsOf(svg: string): FakeGroup[] {
  const tags = svg.match(/<[a-zA-Z]+\b[^>]*\bdata-rotor(?:=|\s|>)[^>]*>/g) ?? [];
  return tags.map((tag) => {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    return new FakeGroup(attrs);
  });
}

test("every shipped data-rotor group is a valid binding with an explicit direction", () => {
  let withBindings = 0;
  for (const file of readdirSync(SHAPES_DIR).filter((f) => f.endsWith(".svg"))) {
    const groups = groupsOf(readFileSync(path.join(SHAPES_DIR, file), "utf8"));
    if (groups.length === 0) continue;
    withBindings++;
    assert.equal(readRotorBindings(root(...groups)).length, groups.length, file);
  }
  assert.ok(withBindings > 0);
});

test("fixed-wing SVGs declare no data-rotor groups", () => {
  for (const file of ["C172.svg", "B738.svg", "A320.svg"]) {
    let svg: string;
    try {
      svg = readFileSync(path.join(SHAPES_DIR, file), "utf8");
    } catch {
      continue;
    }
    assert.deepEqual(groupsOf(svg), [], file);
  }
});

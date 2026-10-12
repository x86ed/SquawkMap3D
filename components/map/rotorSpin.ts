import { ROTOR_DISPLAY_REVS_PER_SECOND } from "./constants";

/** The minimal slice of `Element` rotor spinning needs. */
export interface RotorElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface RotorSpinRoot {
  querySelectorAll(selector: string): ArrayLike<RotorElement>;
}

/** A `[data-rotor]` group of a live SVG: pivot (cx, cy) in the SVG's own
 * viewBox user units and the spin sign (+1 `cw`, -1 `ccw`, as seen on the
 * nose-up icon; SVG `rotate()` is clockwise-positive). */
export interface RotorBinding {
  el: RotorElement;
  cx: number;
  cy: number;
  sign: 1 | -1;
}

/** Reads the rotor bindings of an SVG subtree. Direction is always taken
 * from `data-rotor-direction` (never assumed), so a group with a missing or
 * invalid direction, or an unparsable pivot, is skipped. `data-rotor-rpm` is
 * deliberately ignored: every rotor spins at one fixed display rate. */
export function readRotorBindings(svgRoot: RotorSpinRoot): RotorBinding[] {
  const out: RotorBinding[] = [];
  for (const el of Array.from(svgRoot.querySelectorAll("[data-rotor]"))) {
    const pivot = (el.getAttribute("data-rotor-pivot") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (pivot.length !== 2 || !pivot.every(Number.isFinite)) continue;
    const direction = el.getAttribute("data-rotor-direction");
    if (direction !== "cw" && direction !== "ccw") continue;
    out.push({ el, cx: pivot[0], cy: pivot[1], sign: direction === "cw" ? 1 : -1 });
  }
  return out;
}

/** Sets every rotor's `transform` attribute to `rotate(deg cx cy)` for
 * `tSeconds` of wall time. The attribute form (pivot in viewBox units) is
 * used rather than CSS `transform-origin`, which resolves against the
 * viewBox in browser-dependent ways. DOM writes only. */
export function applyRotorSpin(bindings: RotorBinding[], tSeconds: number): void {
  for (const { el, cx, cy, sign } of bindings) {
    const deg = (sign * 360 * ROTOR_DISPLAY_REVS_PER_SECOND * tSeconds) % 360;
    el.setAttribute("transform", `rotate(${Math.round(deg * 100) / 100} ${cx} ${cy})`);
  }
}

/** Restores the static pose (removes the transforms `applyRotorSpin` set). */
export function resetRotors(bindings: RotorBinding[]): void {
  for (const { el } of bindings) el.removeAttribute("transform");
}

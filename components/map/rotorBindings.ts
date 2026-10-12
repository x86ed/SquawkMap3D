import { ROTOR_DEFAULT_RPM, ROTOR_DISPLAY_REVS_PER_SECOND } from "./constants";

/** A top-mounted rotor declared on an icon SVG via a
 * `<g data-rotor data-rotor-pivot data-rotor-direction data-rotor-rpm>`
 * group. `pivot` is in the SVG's own viewBox user units; `sign` is +1 for
 * `cw` and -1 for `ccw` as seen looking at the nose-up icon. */
export interface RotorBinding {
  id: string;
  pivot: [number, number];
  sign: 1 | -1;
  rpm: number;
}

/** A binding plus where its hub sits in the atlas (see aircraftIcons.ts):
 * `offset` is the hub's offset from the fuselage sprite's center, in
 * fuselage-cell pixels (+x right, +y down, for a nose-up icon). */
export interface RotorAtlasBinding extends RotorBinding {
  atlasKey: string;
  offset: [number, number];
}

interface AttributeSource {
  getAttribute(name: string): string | null;
}

/** Parses one `[data-rotor]` element. Returns null when its pivot is not
 * two finite numbers or its direction is not `cw`/`ccw` — direction is
 * always read from the attribute, never guessed. A missing/zero rpm
 * defaults to ROTOR_DEFAULT_RPM. */
export function parseRotorBinding(el: AttributeSource, fallbackId: string): RotorBinding | null {
  const pivotParts = (el.getAttribute("data-rotor-pivot") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (pivotParts.length !== 2 || !pivotParts.every(Number.isFinite)) return null;

  const direction = el.getAttribute("data-rotor-direction");
  if (direction !== "cw" && direction !== "ccw") return null;

  const rpm = Number(el.getAttribute("data-rotor-rpm")) || ROTOR_DEFAULT_RPM;
  const id = el.getAttribute("data-rotor") || fallbackId;
  return {
    id,
    pivot: [pivotParts[0], pivotParts[1]],
    sign: direction === "cw" ? 1 : -1,
    rpm,
  };
}

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** Parses an SVG `viewBox` string; a missing/invalid one falls back to an
 * origin of 0 and the SVG's own width/height. */
export function parseViewBox(
  viewBox: string | null,
  fallbackWidth: number,
  fallbackHeight: number,
): ViewBox {
  const parts = (viewBox ?? "").trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  }
  return { minX: 0, minY: 0, width: fallbackWidth, height: fallbackHeight };
}

/** Maps a pivot in viewBox user units to pixels within a canvas that the
 * viewBox is stretched across. The min-x/min-y subtraction matters: icon
 * viewBoxes usually have a non-zero origin. */
export function pivotToCanvasPixels(
  pivot: [number, number],
  viewBox: ViewBox,
  canvasWidth: number,
  canvasHeight: number,
): [number, number] {
  return [
    ((pivot[0] - viewBox.minX) * canvasWidth) / viewBox.width,
    ((pivot[1] - viewBox.minY) * canvasHeight) / viewBox.height,
  ];
}

/** Clockwise-positive spin (degrees, SVG `rotate()` convention) at wall
 * time `tSeconds`. Fixed display rate; only the sign comes from the binding. */
export function rotorSpinDegrees(binding: Pick<RotorBinding, "sign"> & Partial<Pick<RotorBinding, "rpm">>, tSeconds: number): number {
  return (binding.sign * ROTOR_DISPLAY_REVS_PER_SECOND * 360 * tSeconds) % 360;
}

/** deck.gl `IconLayer` angles are counter-clockwise-positive while both the
 * track and the SVG spin are clockwise-positive, so both are negated. */
export function rotorDeckAngle(trackDeg: number | undefined, spinDeg: number): number {
  return -(trackDeg ?? 0) - spinDeg;
}

/** Rotates a nose-up-icon-frame pixel offset (+x right, +y down) clockwise
 * by `trackDeg`, so a hub offset follows the fuselage's heading. */
export function rotateOffsetByTrack(
  offset: [number, number],
  trackDeg: number | undefined,
): [number, number] {
  const rad = ((trackDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [offset[0] * cos - offset[1] * sin, offset[0] * sin + offset[1] * cos];
}

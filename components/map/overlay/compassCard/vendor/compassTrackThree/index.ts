// Vendored from https://github.com/plens-win/Card
// packages/compass-track-three/src/index.ts @ 066e0e3 (2026-10-02, branch "11-compass-card-needs-to-have-some-issues-fixed").
// `"private": true` npm workspace, never published — vendored directly
// (matching this app's existing vendoring pattern, see
// components/map/aircraftShapes.ts's doc comment). Re-run manually and
// re-commit if upstream changes; not part of `npm run build`/CI.
// LOCAL ADDITION: rotor/prop spin (see the marked block below).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import {
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_PITCH_HUD_ID,
  CARD_COMPASS_TRACK_ROLL_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
  CARD_COMPASS_TRACK_CARDINAL_ID,
  CARD_COMPASS_TRACK_HEADING_VALUE_CLASS,
  CARD_COMPASS_TRACK_PITCH_VALUE_CLASS,
  CARD_COMPASS_TRACK_ROLL_VALUE_CLASS,
  CARD_COMPASS_TRACK_LAT_VALUE_CLASS,
  CARD_COMPASS_TRACK_LON_VALUE_CLASS,
  CARD_COMPASS_TRACK_CREDIT_LINK_CLASS,
  RARITY_TIER_STYLES,
} from '../core';
import type { CompassTrackModel, CompassTrackState } from '../core';

export {
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_PITCH_HUD_ID,
  CARD_COMPASS_TRACK_ROLL_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
  CARD_COMPASS_TRACK_CARDINAL_ID,
};

/** The compass ring's orientation mode — see the "Compass ring orientation
 * mode toggle" requirement of `compass-track-render`. `'true-north-locked'`
 * (default) keeps the ring fixed to true north (`rotation.y = 0`);
 * `'map-view-locked'` keeps the ring fixed to the map's constant view
 * azimuth ({@link DEFAULT_VIEW_AZIMUTH_DEGREES}) instead. In both modes the
 * needle always rotates to track current heading relative to the ring's
 * fixed reference — only the ring's fixed rotation differs between modes
 * (design Decision 5, second amendment). */
export type CompassMode = 'true-north-locked' | 'map-view-locked';

/** The handle `mountCompassTrackCard` returns: `update` pushes a new
 * telemetry frame (never fetched/polled internally — see design Decision
 * 2), `dispose` cancels the animation loop/`ResizeObserver`/GPU resources. */
export interface CompassTrackCardHandle {
  /** Pushes a new telemetry frame; the visual heading/pitch/ground-scroll
   * tween toward it over subsequent animation frames rather than jumping
   * instantly (see design Decision 3). */
  update(state: CompassTrackState): void;
  /** Cancels the animation loop, disconnects the `ResizeObserver`, and
   * disposes the renderer/geometries/materials — no further rendering
   * occurs after this returns. */
  dispose(): void;
  /** Sets the compass ring's orientation mode (see {@link CompassMode}),
   * updating the cardinal badge's visible mode cue immediately. Drives the
   * exact same code path as clicking the cardinal badge itself, so both
   * stay in sync. Never touches the camera, manual drag offset, or
   * aircraft transform (design Decision 5, amended and second amendment). */
  setCompassMode(mode: CompassMode): void;
  /** The compass ring's current orientation mode. */
  getCompassMode(): CompassMode;
}

/** Grid squares are 1 hectare each: a 100m x 100m square (10,000 m²) — per
 * proposal/spec: "1 grid square = 1 hectare (100m x 100m)". */
const METERS_PER_GRID_SQUARE = 100;

/** How quickly the rendered heading/pitch approach the latest pushed
 * `state` per second of animation time — an exponential ease (not a fixed
 * duration) so tweening keeps working regardless of how far apart two
 * `update()` calls land in time. */
const TWEEN_RATE_HZ = 6;

/** Shortest signed delta (degrees), in `(-180, 180]`, from `fromDegrees` to
 * `toDegrees` — interpolating `from + t * delta` always crosses the
 * 359°/0° boundary the short way rather than the long way through 180°. */
export function shortestHeadingDelta(fromDegrees: number, toDegrees: number): number {
  return (((toDegrees - fromDegrees) % 360) + 540) % 360 - 180;
}

/** One exponential-ease step of `current` toward `target`, taking the
 * shortest-arc route (see {@link shortestHeadingDelta}), normalized back
 * into `[0, 360)`. */
export function tweenHeadingStep(current: number, target: number, elapsedSeconds: number): number {
  const delta = shortestHeadingDelta(current, target);
  const factor = 1 - Math.exp(-TWEEN_RATE_HZ * elapsedSeconds);
  return ((current + delta * factor) % 360 + 360) % 360;
}

/** One exponential-ease step of `current` toward `target` (no wrap — used
 * for pitch). */
export function tweenLinearStep(current: number, target: number, elapsedSeconds: number): number {
  const factor = 1 - Math.exp(-TWEEN_RATE_HZ * elapsedSeconds);
  return current + (target - current) * factor;
}

/** New ground-grid scroll offset, in grid squares (not wrapped — the raw
 * accumulated distance-implied offset), after `elapsedSeconds` at
 * `speedMetersPerSecond` — 1 square = 100 meters (1 hectare). */
export function advanceGroundScrollSquares(
  currentSquares: number,
  speedMetersPerSecond: number,
  elapsedSeconds: number,
): number {
  return currentSquares + (speedMetersPerSecond * elapsedSeconds) / METERS_PER_GRID_SQUARE;
}

/** Wraps a grid-square offset into `[0, 1)` so the ground grid scrolls
 * seamlessly (repeats every square) instead of drifting the mesh
 * arbitrarily far from the origin. */
export function wrapGridOffset(squares: number): number {
  return squares - Math.floor(squares);
}

/** Whether the landing-gear mesh group should be visible: a hard altitude
 * threshold, no hysteresis (per design Decision 4). */
export function isGearVisible(altitudeMeters: number, gearDeploymentAltitudeMeters: number): boolean {
  return altitudeMeters <= gearDeploymentAltitudeMeters;
}

// ---------------------------------------------------------------------------
// LOCAL ADDITION (not upstream): rotor/prop spin, matching the map's own
// `animatedAircraftScenegraphLayer.ts`. Every node whose name starts with
// "Rotor" is an independently-spinning assembly (same prefix convention, for
// the same split-rotor-export reason). Pivot/axis come from the model's own
// authored `node.extras.rotor` (three's GLTFLoader copies extras into
// `userData`) — the real hub/shaft — and only fall back to a mesh
// bounding-box guess when a model has none, since that guess is off-hub for
// asymmetric rotors (e.g. a 3-blade main rotor) and makes the disc orbit.
// ---------------------------------------------------------------------------
const ROTOR_NODE_PREFIX = 'Rotor';

// Degrees/ms a rotor node spins — matches the map layer's `ROTOR_DEG_PER_MS`,
// so a model spins at the same (deliberately slow, alias-free) display rate
// in both places; the authored `rpm` is intentionally not applied.
const ROTOR_DEG_PER_MS = 1 / 7;

const FUSELAGE_AXIS = new THREE.Vector3(1, 0, 0);

interface RotorSpinInfo {
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
  direction: 1 | -1;
}

/** All descendants of `root` whose name starts with `prefix`. */
function findAllByPrefix(root: THREE.Object3D, prefix: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse(obj => {
    if (obj.name.startsWith(prefix)) found.push(obj);
  });
  return found;
}

/** `node`'s own bounding box in its *local* space (unaffected by `node`'s or
 * any ancestor's current transform, which keep changing as heading/pitch
 * tween). */
function localBoundingBox(node: THREE.Object3D): THREE.Box3 {
  node.updateWorldMatrix(true, false);
  const worldToLocal = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  node.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    meshBox.copy(child.geometry.boundingBox!);
    meshBox.applyMatrix4(new THREE.Matrix4().multiplyMatrices(worldToLocal, child.matrixWorld));
    box.union(meshBox);
  });
  return box;
}

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));

/** `rotorNode`'s spin pivot + axis: the model's authored `userData.rotor`
 * when present; else its bounding-box center with the fuselage axis
 * (fixed-wing) or shortest-extent axis (`rotorcraft`). */
function rotorSpinInfo(rotorNode: THREE.Object3D, rotorcraft: boolean): RotorSpinInfo {
  const authored = rotorNode.userData?.rotor as
    | { pivot?: unknown; axis?: unknown; direction?: unknown }
    | undefined;
  if (authored && isVec3(authored.pivot) && isVec3(authored.axis)) {
    return {
      pivot: new THREE.Vector3(...authored.pivot),
      axis: new THREE.Vector3(...authored.axis).normalize(),
      direction: authored.direction === -1 ? -1 : 1,
    };
  }
  const box = localBoundingBox(rotorNode);
  if (box.isEmpty()) return { pivot: new THREE.Vector3(), axis: FUSELAGE_AXIS.clone(), direction: 1 };
  const pivot = box.getCenter(new THREE.Vector3());
  if (!rotorcraft) return { pivot, axis: FUSELAGE_AXIS.clone(), direction: 1 };
  const size = box.getSize(new THREE.Vector3());
  const extents = [size.x, size.y, size.z];
  const axis = new THREE.Vector3();
  axis.setComponent(extents.indexOf(Math.min(...extents)), 1);
  return { pivot, axis, direction: 1 };
}

/** Spins `rotorNode` to `spinDeg` about its pivot/axis by writing its local
 * matrix directly (`matrixAutoUpdate` off so three doesn't overwrite it). */
function spinRotor(rotorNode: THREE.Object3D, info: RotorSpinInfo, spinDeg: number): void {
  rotorNode.matrixAutoUpdate = false;
  rotorNode.matrix
    .makeTranslation(info.pivot.x, info.pivot.y, info.pivot.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(info.axis, THREE.MathUtils.degToRad(spinDeg * info.direction)))
    .multiply(new THREE.Matrix4().makeTranslation(-info.pivot.x, -info.pivot.y, -info.pivot.z));
}

/** Feet-to-meters conversion factor for the GLB-embedded gear-deployment
 * extras value (`hideAboveFeetAGL` is authored in feet AGL; the rest of this
 * module's altitude comparisons — `gearDeploymentAltitudeMeters`,
 * `state.altitudeMeters` — are meters). */
const FEET_TO_METERS = 0.3048;

/** Minimal shape of the object three.js's `GLTFLoader` success-callback
 * argument exposes for extras resolution — only the two `userData`-bearing
 * fields this helper reads. */
interface GltfUserDataSource {
  userData?: { landingGear?: { hideAboveFeetAGL?: number } };
  scene?: { userData?: { landingGear?: { hideAboveFeetAGL?: number } } };
}

/** Resolves the gear-deployment altitude threshold (in meters), preferring
 * the loaded GLB's own embedded `extras.landingGear.hideAboveFeetAGL` value
 * over the externally-supplied `fallbackMeters`
 * (`model.gearDeploymentAltitudeMeters`) — design Decision 7. Three.js's
 * `GLTFLoader` copies each glTF structural level's own `extras` into that
 * level's `userData` independently (node, scene, and document root are
 * populated separately), so this checks, in precedence order: the gear
 * node's own `userData` (most likely authoring location for gear-specific
 * metadata), then the glTF scene root's `userData`, then the glTF document
 * root's `userData` (`gltf.userData`) — first match wins. When present, the
 * value (feet AGL) is converted to meters (`* 0.3048`); when absent at all
 * three levels, `fallbackMeters` is returned unchanged. */
export function resolveGearDeploymentAltitudeMeters(
  gearGroup: THREE.Object3D | null,
  gltf: GltfUserDataSource,
  fallbackMeters: number,
): number {
  const feetAgl =
    gearGroup?.userData.landingGear?.hideAboveFeetAGL ??
    gltf.scene?.userData?.landingGear?.hideAboveFeetAGL ??
    gltf.userData?.landingGear?.hideAboveFeetAGL;
  return feetAgl === undefined ? fallbackMeters : feetAgl * FEET_TO_METERS;
}

/** The 8 compass points, in clockwise order starting at north — index `i`
 * covers headings in `[i * 45 - 22.5, i * 45 + 22.5)`. */
const CARDINAL_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Nearest of the 8 cardinal/intercardinal points (`N`/`NE`/`E`/`SE`/`S`/
 * `SW`/`W`/`NW`) to `headingDegrees` — used both for the upper-left DOM
 * badge and (indirectly) to keep it in sync with the same tweened heading
 * driving the 3D compass ring's needle and the aircraft's own yaw. */
export function nearestCardinal(headingDegrees: number): string {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return CARDINAL_LABELS[index];
}

/** Formats `decimalDegrees` as a `D°M′S.s″`-style DMS string, preserving
 * sign via a leading `-` on the degrees component (one of the two
 * sign-preserving forms `compass-track-hud`'s DMS requirement explicitly
 * allows). Seconds are rounded to one decimal place; a rounding carry into
 * the next minute/degree boundary is normalized away. */
export function formatDms(decimalDegrees: number): string {
  const sign = decimalDegrees < 0 ? '-' : '';
  const abs = Math.abs(decimalDegrees);
  let degrees = Math.floor(abs);
  let minutes = Math.floor((abs - degrees) * 60);
  let seconds = Math.round((((abs - degrees) * 60 - minutes) * 60) * 10) / 10;
  if (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }
  return `${sign}${degrees}°${minutes}′${seconds.toFixed(1)}″`;
}

/** Clamps `value`'s integer-part digit count to `maxDigits` (default `4`),
 * preserving sign and leaving any decimal part untouched — e.g. `99999.5`
 * with `maxDigits: 4` clamps to `9999.5`, not `9999` or `10000`. Duplicated
 * (not imported) from `@card/core`'s identically-behaved `capIntegerDigits`
 * (used by `formatHeadingDegreesLabel`) for the same dependency-free
 * duplication convention as {@link nearestCardinal}/{@link formatDms}.
 * Scoped to the plain-signed-degree formatter (heading/pitch/roll) only —
 * {@link formatDms} (lat/lon) is unaffected (design Decision 12). */
export function capIntegerDigits(value: number, maxDigits: number = 4): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (Math.floor(abs).toString().length <= maxDigits) return value;
  return sign * (10 ** maxDigits - 1);
}

/** Formats a heading-in-degrees value for HUD text display, appending the
 * degree symbol (e.g. `45` -> `"45°"`), after clamping its integer-part
 * digit count via {@link capIntegerDigits}. Used for all three of
 * heading/pitch/roll. */
export function formatHeadingDegrees(headingDegrees: number): string {
  const text = Math.abs(capIntegerDigits(headingDegrees)).toFixed(4);
  let kept = '';
  let digits = 0;
  for (const ch of text) {
    if (ch !== '.') {
      if (digits === 4) break;
      digits++;
    }
    kept += ch;
  }
  kept = kept.replace(/0+$/, '').replace(/\.$/, '');
  const negative = headingDegrees < 0 && Number(kept) !== 0;
  return `${negative ? '-' : ''}${kept}°`;
}

/** Frames `camera` on `sphere` from `direction`, at the distance that makes
 * `sphere` the largest that fits the camera's field of view — same framing
 * math family as `@card/wireframe-three`'s single-frame wireframe render,
 * re-run on every call instead of once. */
export function fitCameraToSphere(
  camera: THREE.PerspectiveCamera,
  sphere: THREE.Sphere,
  direction: THREE.Vector3,
  aspect: number,
): void {
  camera.aspect = aspect;
  const distance = (sphere.radius || 1) * 2.4;
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  camera.lookAt(sphere.center);
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
}

/** Fraction of the mini viewport's half-width (from the canvas centerline)
 * at which each instrument's center projects: 0.5 puts them on the
 * centerlines of the left/right halves. */
const ATTITUDE_CENTER_NDC_X = 0.5;

/** Tilt of the mini viewport camera above the instruments' plane. */
const ATTITUDE_VIEW_DIRECTION = new THREE.Vector3(0, 0.5, 1.6).normalize();

/** Frames `camera` so objects at world x = ±`centerOffsetX` (on the
 * look-at plane) project to NDC x = ±{@link ATTITUDE_CENTER_NDC_X}, i.e.
 * the centerlines of the canvas's two halves, at any `aspect`. */
export function fitAttitudeCamera(
  camera: THREE.PerspectiveCamera,
  centerOffsetX: number,
  aspect: number,
): void {
  camera.aspect = aspect;
  const halfHeightPerUnitDistance = Math.tan((camera.fov * Math.PI) / 360);
  const distance = centerOffsetX / (ATTITUDE_CENTER_NDC_X * halfHeightPerUnitDistance * aspect);
  camera.position.copy(ATTITUDE_VIEW_DIRECTION).multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
}

/** Uniform scale of each instrument within the mini viewport; shrinking them
 * (centers stay put on the half-width centerlines) widens the gap between
 * the two instruments and between each and the canvas edge. */
const ATTITUDE_INSTRUMENT_SCALE = 0.85;

/** Horizontal offset of each instrument's center from the mini viewport's
 * origin, in world units (compass radius 1.2 x 1.25). */
const ATTITUDE_CENTER_OFFSET_X = 1.2 * 1.25;

/** The default 3/4, magnetic-north-oriented camera framing direction —
 * reused both at mount time and whenever the compass indicator is clicked
 * to recenter the camera (design Decision 4). World -Z is true north
 * (matching the ground grid's fixed frame), so this direction reads as a
 * 3/4 view "from the south-east, looking north-west". */
const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1.4, 0.9, 1.6).normalize();

/** The map's fixed view azimuth (degrees, rotation about world Y) that
 * `DEFAULT_VIEW_DIRECTION` projects onto the ground (XZ) plane — computed
 * once as a constant, never per-frame, since this app's camera is only
 * ever repositioned (`fitCameraToSphere`/`recenterCamera`), never
 * reoriented to a different azimuth (design Decision 5, second
 * amendment). Used as the compass ring's fixed reference rotation in
 * `'map-view-locked'` mode. The `atan2(x, -z)` argument order matches this
 * file's existing heading↔world-direction convention (see
 * `createCompassRing`'s tick placement), so `'true-north-locked'`'s fixed
 * `rotation.y = 0` is the special case of the same formula. */
const DEFAULT_VIEW_AZIMUTH_DEGREES = THREE.MathUtils.radToDeg(
  Math.atan2(DEFAULT_VIEW_DIRECTION.x, -DEFAULT_VIEW_DIRECTION.z),
);

/** Positions/colors (in a `Float32Array`, `[x0,y0,z0, x1,y1,z1, ...]`) for a
 * flat `size` x `size` ground grid with `divisions` squares per side,
 * centered at the origin in the XZ plane — the same layout
 * `THREE.GridHelper` produces, rebuilt here so the grid can be rendered via
 * `LineSegments2`/`LineMaterial` (a "fat line" material whose width is
 * respected on all platforms, unlike `GridHelper`'s default
 * `LineBasicMaterial`). */
export function buildGridLinePositions(size: number, divisions: number): Float32Array {
  const half = size / 2;
  const step = size / divisions;
  const positions: number[] = [];
  for (let i = 0; i <= divisions; i++) {
    const coordinate = -half + i * step;
    // Line parallel to X axis (varies along Z).
    positions.push(-half, 0, coordinate, half, 0, coordinate);
    // Line parallel to Z axis (varies along X).
    positions.push(coordinate, 0, -half, coordinate, 0, half);
  }
  return new Float32Array(positions);
}

function createFatLineGrid(size: number, divisions: number, color: THREE.Color, resolution: THREE.Vector2): LineSegments2 {
  const positions = buildGridLinePositions(size, divisions);
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  geometry.setColors(colors);

  const material = new LineMaterial({
    linewidth: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    resolution,
  });

  const grid = new LineSegments2(geometry, material);
  grid.name = 'compass-track-grid';
  grid.computeLineDistances();
  return grid;
}

/** A flat annulus lying in the XZ plane (parallel to the ground grid), fixed
 * to true north, with small tick marks at the 8 compass points — the fixed
 * "compass card" ring a needle mesh (added separately, see
 * {@link createCompassNeedle}) rotates against. */
function createCompassRing(radius: number, color: THREE.Color): THREE.Group {
  const ringGroup = new THREE.Group();
  ringGroup.name = 'compass-track-ring';

  const ringGeometry = new THREE.RingGeometry(radius * 0.85, radius, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = -Math.PI / 2;
  ringGroup.add(ringMesh);

  // 8 tick marks at the cardinal/intercardinal points, north (`0°`) aligned
  // with world -Z — matching the ground grid's fixed true-north frame.
  const tickGeometry = new THREE.BoxGeometry(radius * 0.04, radius * 0.02, radius * 0.16);
  for (let i = 0; i < 8; i++) {
    const angle = THREE.MathUtils.degToRad(i * 45);
    const tick = new THREE.Mesh(tickGeometry, ringMaterial);
    tick.position.set(radius * Math.sin(angle), 0.01, -radius * Math.cos(angle));
    tick.rotation.y = angle;
    ringGroup.add(tick);
  }

  return ringGroup;
}

/** The needle/pointer sub-mesh that rotates (about world Y) to indicate the
 * current tweened heading relative to the fixed {@link createCompassRing}. */
function createCompassNeedle(radius: number, color: THREE.Color): THREE.Group {
  const needleGroup = new THREE.Group();
  needleGroup.name = 'compass-track-needle';
  const needleGeometry = new THREE.ConeGeometry(radius * 0.08, radius * 0.7, 8);
  const needleMaterial = new THREE.MeshBasicMaterial({ color });
  const needleMesh = new THREE.Mesh(needleGeometry, needleMaterial);
  needleMesh.rotation.x = -Math.PI / 2;
  needleMesh.position.z = -radius * 0.35;
  needleGroup.add(needleMesh);
  return needleGroup;
}

/** Sky/ground hemisphere colors for the artificial-horizon ball (design
 * Decision 7) — the coloring itself is the nose-up/nose-down cue (more sky
 * visible above the seam = nose up or level, more ground visible = nose
 * down), so no separate sign-color marker is needed, unlike the retired
 * horizon-line-plus-marker design. Palette is an "outrun"/synthwave take
 * (deep magenta-purple sky, sunset-orange ground, hot-pink horizon seam)
 * rather than a literal sky-blue/ground-brown instrument face. Ground uses a
 * warm orange instead of the originally-chosen cyan because cyan read as
 * another "sky" color, undermining the sky/ground visual cue. */
const HORIZON_BALL_SKY_COLOR = new THREE.Color(0x7c1fa0);
const HORIZON_BALL_GROUND_COLOR = new THREE.Color(0xea580c);
const HORIZON_BALL_SEAM_COLOR = new THREE.Color(0xf72585);
const HORIZON_BALL_TICK_COLOR = new THREE.Color(0x5eead4);

/** Degrees between each pitch-ladder tick mark on the artificial-horizon
 * ball's face (design Decision 7's "every 15-30 degrees" guidance). */
const HORIZON_BALL_TICK_INTERVAL_DEGREES = 30;

/** A classic cockpit artificial-horizon "ball" instrument: a sphere split
 * into a sky-colored upper hemisphere and a ground-colored lower hemisphere
 * sharing one center (a real geometric seam via `thetaStart`/`thetaLength`,
 * not a UV-mapped texture), a thin equatorial ring as the horizon seam
 * accent, and a handful of pitch-ladder tick marks (the same
 * `LineSegments2`/`LineMaterial` fat-line technique used by the ground grid)
 * — all parented under one rigid group whose local X rotation tracks
 * (tweened, negated) pitch each frame (design Decision 7). Replaces the
 * retired `createHorizonIndicator` fat-line-plus-billboarded-marker design.
 * Not billboarded — a real 3D instrument viewed from a fixed camera
 * vantage, and never a click-to-recenter raycast target. */
function createArtificialHorizonBall(radius: number, resolution: THREE.Vector2): THREE.Group {
  const group = new THREE.Group();
  group.name = 'compass-track-horizon-ball';

  const segments = 24;
  const skyGeometry = new THREE.SphereGeometry(radius, segments, segments, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyMesh = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ color: HORIZON_BALL_SKY_COLOR }));
  skyMesh.name = 'compass-track-horizon-ball-sky';
  group.add(skyMesh);

  const groundGeometry = new THREE.SphereGeometry(
    radius,
    segments,
    segments,
    0,
    Math.PI * 2,
    Math.PI / 2,
    Math.PI / 2,
  );
  const groundMesh = new THREE.Mesh(groundGeometry, new THREE.MeshBasicMaterial({ color: HORIZON_BALL_GROUND_COLOR }));
  groundMesh.name = 'compass-track-horizon-ball-ground';
  group.add(groundMesh);

  // Crisp equatorial seam accent — a thin torus, not a texture boundary.
  const seamMesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.02, 8, 32),
    new THREE.MeshBasicMaterial({ color: HORIZON_BALL_SEAM_COLOR }),
  );
  seamMesh.name = 'compass-track-horizon-ball-seam';
  seamMesh.rotation.x = Math.PI / 2;
  group.add(seamMesh);

  // Pitch-ladder ticks: short fat-line segments at fixed angular intervals
  // around the ball's surface, rigidly parented so they rotate together
  // with the hemispheres/seam as one group (never independently).
  const tickPositions: number[] = [];
  for (let angle = -90; angle <= 90; angle += HORIZON_BALL_TICK_INTERVAL_DEGREES) {
    if (angle === 0) continue;
    const y = radius * Math.sin(THREE.MathUtils.degToRad(angle));
    const z = radius * Math.cos(THREE.MathUtils.degToRad(angle));
    tickPositions.push(-radius * 0.25, y, z, radius * 0.25, y, z);
  }
  const tickGeometry = new LineSegmentsGeometry();
  tickGeometry.setPositions(tickPositions);
  const tickMaterial = new LineMaterial({
    linewidth: 2,
    color: HORIZON_BALL_TICK_COLOR,
    transparent: true,
    opacity: 0.8,
    resolution,
  });
  const ticks = new LineSegments2(tickGeometry, tickMaterial);
  ticks.name = 'compass-track-horizon-ball-ticks';
  ticks.computeLineDistances();
  group.add(ticks);

  return group;
}

function createRenderer(
  clearColor: number = 0x0b1220,
  clearAlpha: number = 1,
): { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.className = 'compass-track-canvas';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(clearColor, clearAlpha);
  return { renderer, canvas };
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse(obj => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Line)) return;
    obj.geometry.dispose();
    const material = obj.material;
    if (Array.isArray(material)) material.forEach(m => m.dispose());
    else material.dispose();
  });
}

/**
 * Mounts a live, continuously-updating Three.js scene into `slot` (the
 * `compass-track` kind's `CARD_COMPASS_TRACK_SLOT_ID` mount element): the
 * aircraft model at `model.modelUrl` flying over a scrolling ground grid,
 * oriented by heading/pitch, with its landing-gear mesh group
 * (`model.gearMeshGroupName`) shown/hidden by altitude — and drives the
 * card's HUD elements (heading/pitch, lat/lon, cardinal badge, and the
 * static modeler credit) from the same `slot`'s enclosing
 * `.compass-track-card` markup. Also mounts a second, fully independent
 * renderer/canvas/scene/camera (the mini attitude viewport) into the
 * sibling `CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID` slot, fixed in the card's
 * upper-left corner: it renders the 3D compass ring + needle and the 3D
 * artificial-horizon-ball pitch indicator, fully decoupled from the main
 * aircraft
 * scene/camera's framing, resize, and dispose lifecycle (see
 * `openspec/changes/compass-attitude-corner-viewport/design.md`). Wires up
 * drag-to-pan/roll on the aircraft (main canvas) plus click-to-recenter via
 * the compass ring (mini viewport's own canvas/camera raycast).
 *
 * The returned handle's `update(state)` pushes a new telemetry frame (the
 * sub-package never fetches/polls on its own); the internal animation loop
 * only tweens the *visual* heading/pitch/ground-scroll between whatever was
 * last pushed, taking the shortest arc across the 359°/0° heading wrap, and
 * renders both the main scene and the mini attitude viewport scene each
 * frame tick (design Decision 5 — one `requestAnimationFrame` loop, not
 * two). `dispose()` cancels that loop, disconnects the `ResizeObserver`(s),
 * and frees both renderers'/scenes' GPU resources.
 */
export function mountCompassTrackCard(
  slot: HTMLElement,
  model: CompassTrackModel,
  initialState: CompassTrackState,
): CompassTrackCardHandle {
  slot.innerHTML = '';

  const container = slot.closest<HTMLElement>('.compass-track-card');
  const attitudeSlot = container?.querySelector<HTMLElement>(`#${CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID}`) ?? null;
  const headingValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_HEADING_VALUE_CLASS}`) ?? null;
  const pitchValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_PITCH_VALUE_CLASS}`) ?? null;
  const rollValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_ROLL_VALUE_CLASS}`) ?? null;
  const latValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_LAT_VALUE_CLASS}`) ?? null;
  const lonValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_LON_VALUE_CLASS}`) ?? null;
  const creditLinkEl = container?.querySelector<HTMLAnchorElement>(`.${CARD_COMPASS_TRACK_CREDIT_LINK_CLASS}`) ?? null;
  const cardinalEl = container?.querySelector<HTMLElement>(`#${CARD_COMPASS_TRACK_CARDINAL_ID}`) ?? null;

  // Static per-model metadata, set once at mount — never touched by update().
  // Blank modeler name/profile is already rendered server-side as the
  // "+ Add a model" CTA (or unknown placeholder) by `creditLinkMarkup`;
  // overwriting it here unconditionally would replace that with a bare "@".
  if (creditLinkEl && model.modelerName.trim() && model.modelerProfileUrl.trim()) {
    creditLinkEl.textContent = `@${model.modelerName}`;
    creditLinkEl.href = model.modelerProfileUrl;
  }

  const { renderer, canvas } = createRenderer();
  slot.appendChild(canvas);

  // The mini attitude viewport: a second, fully independent
  // renderer/canvas/scene/camera, mounted into the upper-left
  // `CARD_COMPASS_TRACK_ATTITUDE_SLOT_ID` slot — see design Decision 1. It
  // contains the compass ring/needle and the artificial-horizon-ball pitch
  // indicator, decoupled entirely from the main aircraft scene/camera's
  // construction, resize, and dispose lifecycle. Transparent clear alpha
  // (design Decision 6) so the card's own background shows through anywhere
  // neither instrument paints.
  const { renderer: attitudeRenderer, canvas: attitudeCanvas } = createRenderer(0x000000, 0);
  attitudeSlot?.appendChild(attitudeCanvas);
  const attitudeScene = new THREE.Scene();
  const attitudeCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  // Sized to the mini viewport's own pixel dimensions (set in `resize()`),
  // not the main canvas's — shared by the horizon ball's pitch-ladder tick
  // `LineMaterial` so its fat-line width stays screen-space-consistent
  // within its own small frame.
  const attitudeLineResolution = new THREE.Vector2(1, 1);

  const scene = new THREE.Scene();
  const aircraftGroup = new THREE.Group();
  scene.add(aircraftGroup);

  // Cyberpunk-styled rim lighting: PBR materials render fully black with no
  // lights in the scene, so a dim cool ambient plus a cyan key light and a
  // magenta rim light silhouette the aircraft against the dark navy background.
  const ambientLight = new THREE.HemisphereLight(0x1fd1ff, 0x2a0a3c, 0.6);
  scene.add(ambientLight);
  const keyLight = new THREE.PointLight(0x22d3ee, 6, 0, 2);
  keyLight.position.set(4, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xff2ec4, 6, 0, 2);
  rimLight.position.set(-4, 1, -3);
  scene.add(rimLight);

  const glowColor = new THREE.Color(RARITY_TIER_STYLES[model.rarityTier].color);

  // Squares are 1 hectare (100m) each — 20 squares keeps the total extent
  // (2km) generously larger than any card's visible framing without adding
  // grid lines far outside the camera's view frustum.
  const gridSquareCount = 20;
  const gridSize = gridSquareCount * METERS_PER_GRID_SQUARE;
  const lineResolution = new THREE.Vector2(1, 1);
  const grid = createFatLineGrid(gridSize, gridSquareCount, glowColor, lineResolution);
  scene.add(grid);

  const compassRadius = 1.2;
  // Ring on the left half, ball on the right half of the mini viewport's own
  // frame — side by side, non-overlapping (design Decision 7).
  const compassRing = createCompassRing(compassRadius, glowColor);
  compassRing.position.set(-ATTITUDE_CENTER_OFFSET_X, 0.02, 0);
  compassRing.scale.setScalar(ATTITUDE_INSTRUMENT_SCALE);
  attitudeScene.add(compassRing);
  const compassNeedle = createCompassNeedle(compassRadius, glowColor);
  compassNeedle.position.set(-ATTITUDE_CENTER_OFFSET_X, 0, 0);
  compassNeedle.scale.setScalar(ATTITUDE_INSTRUMENT_SCALE);
  attitudeScene.add(compassNeedle);

  const horizonBallGroup = createArtificialHorizonBall(compassRadius * 0.9, attitudeLineResolution);
  horizonBallGroup.position.set(ATTITUDE_CENTER_OFFSET_X, 0, 0);
  horizonBallGroup.scale.setScalar(ATTITUDE_INSTRUMENT_SCALE);
  attitudeScene.add(horizonBallGroup);

  // The mini viewport's camera is framed so the ring's and ball's centers
  // project exactly onto the centerlines of the canvas's left and right
  // halves — where the HUD text above/below each instrument is centered.
  fitAttitudeCamera(attitudeCamera, ATTITUDE_CENTER_OFFSET_X, 1);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  let lastSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);

  function recenterCamera(): void {
    fitCameraToSphere(camera, lastSphere, DEFAULT_VIEW_DIRECTION, camera.aspect);
  }

  let gearGroup: THREE.Object3D | null = null;
  let rotorNodes: { node: THREE.Object3D; info: RotorSpinInfo }[] = [];
  // Gear-deployment altitude threshold (meters) — defaults to
  // `model.gearDeploymentAltitudeMeters` and is overwritten once per model
  // load if the GLB's own embedded extras supply a value; see
  // `resolveGearDeploymentAltitudeMeters` and design Decision 7. `gearGroup`
  // stays `null` until the same load callback runs, so `isGearVisible`'s
  // call site below is a no-op until then regardless of this value.
  let gearDeploymentAltitudeMetersOverride = model.gearDeploymentAltitudeMeters;

  new GLTFLoader().load(model.modelUrl, gltf => {
    aircraftGroup.add(gltf.scene);
    rotorNodes = findAllByPrefix(gltf.scene, ROTOR_NODE_PREFIX).map(node => ({
      node,
      info: rotorSpinInfo(node, model.rotorcraft ?? false),
    }));
    gltf.scene.traverse(obj => {
      if (obj.name === model.gearMeshGroupName) gearGroup = obj;
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.emissive = glowColor;
        material.emissiveIntensity = 1.2;
      }
    });
    gearDeploymentAltitudeMetersOverride = resolveGearDeploymentAltitudeMeters(
      gearGroup,
      gltf,
      model.gearDeploymentAltitudeMeters,
    );
    lastSphere = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
    recenterCamera();
  });

  function resize(): void {
    const width = slot.clientWidth || 1;
    const height = slot.clientHeight || 1;
    renderer.setSize(width, height, false);
    lineResolution.set(width, height);
    fitCameraToSphere(camera, lastSphere, DEFAULT_VIEW_DIRECTION, width / height);

    // The mini viewport sizes itself from its own slot element's box, not
    // `slot`'s — fully independent of the main canvas's size/aspect (design
    // Decision 1/2).
    const attitudeWidth = attitudeSlot?.clientWidth || 1;
    const attitudeHeight = attitudeSlot?.clientHeight || 1;
    attitudeRenderer.setSize(attitudeWidth, attitudeHeight, false);
    attitudeLineResolution.set(attitudeWidth, attitudeHeight);
    fitAttitudeCamera(attitudeCamera, ATTITUDE_CENTER_OFFSET_X, attitudeWidth / attitudeHeight);
  }

  resize();
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(slot);
  if (attitudeSlot) resizeObserver.observe(attitudeSlot);

  let latestState: CompassTrackState = initialState;
  let renderedHeading = initialState.headingDegrees;
  let renderedPitch = initialState.pitchDegrees;
  // Tweened the same linear (non-wrapping) way as `renderedPitch`, not the
  // wrapping `tweenHeadingStep` used for heading — bank angle has no 360°
  // wrap (design Decision 9). Readout-only: never drives a rotation axis on
  // the artificial-horizon ball's mesh group (explicitly out of scope).
  let renderedRoll = initialState.rollDegrees;
  let lastKnownGroundSpeed = initialState.groundSpeedMetersPerSecond ?? 0;
  let scrollX = 0;
  let scrollZ = 0;
  const tailDirection = new THREE.Vector3();

  // Manual pan/roll offset (radians) applied additively on top of the
  // telemetry-tweened orientation — see design Decision 3. Cleared only by
  // `recenterCamera`'s companion click handler (Decision 4), never by
  // `update()`.
  let manualYawOffset = 0;
  let manualRollOffset = 0;
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  const DRAG_SENSITIVITY = 0.01;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function updatePointerNdc(event: PointerEvent | MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    pointerNdc.x = ((event.clientX - rect.left) / width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / height) * 2 + 1;
  }

  function hitsAircraft(event: PointerEvent): boolean {
    updatePointerNdc(event);
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObject(aircraftGroup, true).length > 0;
  }

  function updateAttitudePointerNdc(event: MouseEvent): void {
    const rect = attitudeCanvas.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    pointerNdc.x = ((event.clientX - rect.left) / width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / height) * 2 + 1;
  }

  // The ring's raycast is read against the mini viewport's own canvas and
  // camera — design Decision 1/`compass-track-render`'s click-to-recenter
  // requirement — not the main aircraft canvas/camera.
  function hitsCompassRing(event: MouseEvent): boolean {
    updateAttitudePointerNdc(event);
    raycaster.setFromCamera(pointerNdc, attitudeCamera);
    return raycaster.intersectObject(compassRing, true).length > 0;
  }

  function recenter(): void {
    manualYawOffset = 0;
    manualRollOffset = 0;
    recenterCamera();
  }

  // Compass ring orientation mode — fully independent of the camera/manual
  // drag offset state above (design Decision 5); toggling it never calls
  // `recenterCamera()` nor touches `manualYawOffset`/`manualRollOffset`.
  let compassMode: CompassMode = 'true-north-locked';

  function setCompassMode(mode: CompassMode): void {
    compassMode = mode;
    // Mode cue lives on the cardinal badge itself as a CSS class, not
    // replacing the badge's letter text (design Decision 5, amended) — the
    // letter is load-bearing HUD content that must keep updating regardless
    // of mode.
    cardinalEl?.classList.toggle('compass-track-cardinal-map-view-locked', mode === 'map-view-locked');
  }

  function getCompassMode(): CompassMode {
    return compassMode;
  }

  function onModeToggleClick(): void {
    setCompassMode(compassMode === 'true-north-locked' ? 'map-view-locked' : 'true-north-locked');
  }

  function onPointerDown(event: PointerEvent): void {
    if (!hitsAircraft(event)) return;
    isDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isDragging) return;
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    manualYawOffset += deltaX * DRAG_SENSITIVITY;
    manualRollOffset += deltaY * DRAG_SENSITIVITY;
  }

  function onPointerUp(): void {
    isDragging = false;
  }

  // The ring click is now read from the mini viewport's own canvas, not the
  // main canvas — see `hitsCompassRing`/design Decision 1.
  function onAttitudeCanvasClick(event: MouseEvent): void {
    if (hitsCompassRing(event)) recenter();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  attitudeCanvas.addEventListener('click', onAttitudeCanvasClick);
  // The cardinal badge exclusively toggles compass mode — it never
  // recenters; recenter is exclusively triggered by clicking the mini
  // viewport's 3D ring (`onAttitudeCanvasClick` above), per design Decision
  // 4/5 (amended).
  cardinalEl?.addEventListener('click', onModeToggleClick);

  function applyHudText(state: CompassTrackState): void {
    if (headingValueEl) headingValueEl.textContent = formatHeadingDegrees(state.headingDegrees);
    if (pitchValueEl) pitchValueEl.textContent = formatHeadingDegrees(state.pitchDegrees);
    if (rollValueEl) rollValueEl.textContent = formatHeadingDegrees(state.rollDegrees);
    if (latValueEl) latValueEl.textContent = formatDms(state.latitude);
    if (lonValueEl) lonValueEl.textContent = formatDms(state.longitude);
  }

  applyHudText(initialState);
  if (cardinalEl) cardinalEl.textContent = nearestCardinal(initialState.headingDegrees);

  function update(state: CompassTrackState): void {
    latestState = state;
    if (state.groundSpeedMetersPerSecond !== undefined) lastKnownGroundSpeed = state.groundSpeedMetersPerSecond;
    applyHudText(state);
  }

  let disposed = false;
  let rafHandle = 0;
  // `null` until the first frame: the initial synchronous render has no
  // prior timestamp to diff against, so it always renders `elapsedSeconds:
  // 0` rather than depending on the wall clock at mount time.
  let lastFrameTime: number | null = null;

  function renderFrame(now: number): void {
    const elapsedSeconds = lastFrameTime === null ? 0 : Math.max(0, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    renderedHeading = tweenHeadingStep(renderedHeading, latestState.headingDegrees, elapsedSeconds);
    renderedPitch = tweenLinearStep(renderedPitch, latestState.pitchDegrees, elapsedSeconds);
    renderedRoll = tweenLinearStep(renderedRoll, latestState.rollDegrees, elapsedSeconds);

    // Manual drag offset (Decision 3) composes additively on top of the
    // telemetry-tweened base orientation — never overwritten by it.
    aircraftGroup.rotation.y = THREE.MathUtils.degToRad(-renderedHeading) + manualYawOffset;
    aircraftGroup.rotation.x = THREE.MathUtils.degToRad(renderedPitch) + manualRollOffset;

    // The ground streams past opposite the aircraft's *actual* current
    // world-space nose direction (not a hand-rederived sin/cos formula that
    // assumes the loaded model's nose points along local -Z) — reading the
    // real orientation keeps this correct regardless of the loaded model's
    // authored forward axis. `getWorldDirection` returns the object's local
    // +Z axis in world space (the tail direction, i.e. already the opposite
    // of the nose) — exactly the direction the ground should scroll in, so
    // it's used unnegated.
    aircraftGroup.updateMatrixWorld();
    aircraftGroup.getWorldDirection(tailDirection);
    scrollX = advanceGroundScrollSquares(scrollX, lastKnownGroundSpeed * tailDirection.x, elapsedSeconds);
    scrollZ = advanceGroundScrollSquares(scrollZ, lastKnownGroundSpeed * tailDirection.z, elapsedSeconds);

    // Grid orientation stays fixed to true north (never rotates with
    // heading) — only its scroll position moves.
    grid.position.x = wrapGridOffset(scrollX) * METERS_PER_GRID_SQUARE;
    grid.position.z = wrapGridOffset(scrollZ) * METERS_PER_GRID_SQUARE;

    // Only the ring's fixed reference rotation differs between modes:
    // true-north-locked fixes it at 0 (true north); map-view-locked fixes
    // it at the constant map-view azimuth. The needle always tracks
    // current heading relative to that fixed reference in both modes — see
    // design Decision 5, second amendment.
    compassRing.rotation.y = THREE.MathUtils.degToRad(
      compassMode === 'true-north-locked' ? 0 : -DEFAULT_VIEW_AZIMUTH_DEGREES,
    );
    compassNeedle.rotation.y = THREE.MathUtils.degToRad(-renderedHeading);
    const nextCardinal = nearestCardinal(renderedHeading);
    if (cardinalEl && cardinalEl.textContent !== nextCardinal) cardinalEl.textContent = nextCardinal;

    // The artificial-horizon ball's local X rotation tracks (tweened,
    // negated) pitch each frame — nose-up tilts the sky/ground down
    // relative to the fixed viewing reference, not the other way around
    // (design Decision 7). It is a real 3D instrument, not billboarded.
    horizonBallGroup.rotation.x = THREE.MathUtils.degToRad(-renderedPitch);

    if (rotorNodes.length > 0) {
      const spinDeg = (now * ROTOR_DEG_PER_MS) % 360;
      for (const { node, info } of rotorNodes) spinRotor(node, info, spinDeg);
    }

    if (gearGroup) gearGroup.visible = isGearVisible(latestState.altitudeMeters, gearDeploymentAltitudeMetersOverride);

    renderer.render(scene, camera);
    // Folded into the same per-frame tick as the main scene's render, not a
    // second independent RAF loop (design Decision 5).
    attitudeRenderer.render(attitudeScene, attitudeCamera);
  }

  function loop(now: number): void {
    if (disposed) return;
    renderFrame(now);
    rafHandle = requestAnimationFrame(loop);
  }

  // Initial synchronous frame — the mount scenario requires the aircraft to
  // already be rendered at `initialState`'s orientation before the first
  // `requestAnimationFrame` callback fires.
  renderFrame(0);
  rafHandle = requestAnimationFrame(loop);

  function dispose(): void {
    disposed = true;
    cancelAnimationFrame(rafHandle);
    resizeObserver.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    attitudeCanvas.removeEventListener('click', onAttitudeCanvasClick);
    cardinalEl?.removeEventListener('click', onModeToggleClick);
    disposeObject3D(scene);
    disposeObject3D(attitudeScene);
    renderer.dispose();
    attitudeRenderer.dispose();
    slot.innerHTML = '';
    if (attitudeSlot) attitudeSlot.innerHTML = '';
  }

  return { update, dispose, setCompassMode, getCompassMode };
}

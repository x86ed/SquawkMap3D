// Vendored from https://github.com/plens-win/Card
// packages/compass-track-three/src/index.ts @ 39734839 (2026-09-28).
// `"private": true` npm workspace, never published — vendored directly
// (see ../core/compass-track-card.ts's doc comment for the same rationale).
// Only needs `three`'s `GLTFLoader`, already a dependency of this app (see
// components/map/overlay/planeCardFrontArt.ts, which imports the same
// `three/examples/jsm/loaders/GLTFLoader.js` path). Re-run manually and
// re-commit if upstream changes; not part of `npm run build`/CI.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
  CARD_COMPASS_TRACK_HEADING_VALUE_CLASS,
  CARD_COMPASS_TRACK_PITCH_VALUE_CLASS,
  CARD_COMPASS_TRACK_LAT_VALUE_CLASS,
  CARD_COMPASS_TRACK_LON_VALUE_CLASS,
  CARD_COMPASS_TRACK_CREDIT_LINK_CLASS,
  RARITY_TIER_STYLES,
} from '../core';
import type { CompassTrackModel, CompassTrackState } from '../core';

export {
  CARD_COMPASS_TRACK_SLOT_ID,
  CARD_COMPASS_TRACK_HEADING_HUD_ID,
  CARD_COMPASS_TRACK_LATLON_HUD_ID,
  CARD_COMPASS_TRACK_CREDIT_HUD_ID,
};

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

function createRenderer(): { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.className = 'compass-track-canvas';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0b1220, 1);
  return { renderer, canvas };
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
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
 * card's four HUD elements (heading/pitch, lat/lon, and the static modeler
 * credit) from the same `slot`'s enclosing `.compass-track-card` markup.
 *
 * The returned handle's `update(state)` pushes a new telemetry frame (the
 * sub-package never fetches/polls on its own); the internal animation loop
 * only tweens the *visual* heading/pitch/ground-scroll between whatever was
 * last pushed, taking the shortest arc across the 359°/0° heading wrap.
 * `dispose()` cancels that loop, disconnects the `ResizeObserver`, and frees
 * the renderer/geometries/materials.
 */
export function mountCompassTrackCard(
  slot: HTMLElement,
  model: CompassTrackModel,
  initialState: CompassTrackState,
): CompassTrackCardHandle {
  slot.innerHTML = '';

  const container = slot.closest<HTMLElement>('.compass-track-card');
  const headingValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_HEADING_VALUE_CLASS}`) ?? null;
  const pitchValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_PITCH_VALUE_CLASS}`) ?? null;
  const latValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_LAT_VALUE_CLASS}`) ?? null;
  const lonValueEl = container?.querySelector<HTMLElement>(`.${CARD_COMPASS_TRACK_LON_VALUE_CLASS}`) ?? null;
  const creditLinkEl = container?.querySelector<HTMLAnchorElement>(`.${CARD_COMPASS_TRACK_CREDIT_LINK_CLASS}`) ?? null;

  // Static per-model metadata, set once at mount — never touched by update().
  // Only overwrites when both fields are non-blank; otherwise the "+ Add a
  // model" CTA (or unknown placeholder) `buildCompassTrackCard` already
  // rendered via `creditLinkMarkup` is left untouched.
  if (creditLinkEl && model.modelerName.trim() && model.modelerProfileUrl.trim()) {
    creditLinkEl.textContent = `@${model.modelerName}`;
    creditLinkEl.href = model.modelerProfileUrl;
  }

  const { renderer, canvas } = createRenderer();
  slot.appendChild(canvas);

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
  const grid = new THREE.GridHelper(gridSize, gridSquareCount, glowColor, glowColor);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  const viewDirection = new THREE.Vector3(1.4, 0.9, 1.6).normalize();
  let lastSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);

  let gearGroup: THREE.Object3D | null = null;

  new GLTFLoader().load(model.modelUrl, gltf => {
    aircraftGroup.add(gltf.scene);
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
    lastSphere = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
    fitCameraToSphere(camera, lastSphere, viewDirection, camera.aspect);
  });

  function resize(): void {
    const width = slot.clientWidth || 1;
    const height = slot.clientHeight || 1;
    renderer.setSize(width, height, false);
    fitCameraToSphere(camera, lastSphere, viewDirection, width / height);
  }

  resize();
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(slot);

  let latestState: CompassTrackState = initialState;
  let renderedHeading = initialState.headingDegrees;
  let renderedPitch = initialState.pitchDegrees;
  let lastKnownGroundSpeed = initialState.groundSpeedMetersPerSecond ?? 0;
  let scrollX = 0;
  let scrollZ = 0;
  const tailDirection = new THREE.Vector3();

  function applyHudText(state: CompassTrackState): void {
    if (headingValueEl) headingValueEl.textContent = String(state.headingDegrees);
    if (pitchValueEl) pitchValueEl.textContent = String(state.pitchDegrees);
    if (latValueEl) latValueEl.textContent = String(state.latitude);
    if (lonValueEl) lonValueEl.textContent = String(state.longitude);
  }

  applyHudText(initialState);

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

    aircraftGroup.rotation.y = THREE.MathUtils.degToRad(-renderedHeading);
    aircraftGroup.rotation.x = THREE.MathUtils.degToRad(renderedPitch);

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

    grid.rotation.y = THREE.MathUtils.degToRad(-renderedHeading);
    grid.position.x = wrapGridOffset(scrollX) * METERS_PER_GRID_SQUARE;
    grid.position.z = wrapGridOffset(scrollZ) * METERS_PER_GRID_SQUARE;

    if (gearGroup) gearGroup.visible = isGearVisible(latestState.altitudeMeters, model.gearDeploymentAltitudeMeters);

    renderer.render(scene, camera);
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
    disposeObject3D(scene);
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
    renderer.dispose();
    slot.innerHTML = '';
  }

  return { update, dispose };
}

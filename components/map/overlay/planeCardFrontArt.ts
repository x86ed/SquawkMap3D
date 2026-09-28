import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelUrl, resolveModelKeyForTypeAndCategory } from "../aircraftModels";

/**
 * `PlaneCard`'s front-face art (design.md Decision 4/"3D model" follow-up):
 * a themed wireframe render of the aircraft's vendored `.glb` model —
 * ported verbatim from `plens-win/Card`'s `@card/wireframe-three` package
 * (`mountCardArt`/`collectMeshes`, vendored locally in the sibling
 * `iconizer` project at `3D-modeler/vendor/card/wireframe-three`), the
 * canonical library this app's flip card is standardized against. Only the
 * model source differs: the library renders a live in-app 3D reconstruction
 * scene; this app has no such reconstruction, so `loadAircraftGltfScene`
 * below loads this app's own existing vendored `.glb` models
 * (`public/aircraft-models/`, the same files `aircraftModels.ts` feeds to
 * the map's `ScenegraphLayer`) instead. Falls back to the flat 2D icon SVG
 * (tier-tinted) when the aircraft has no vendored model, exactly like the
 * library's own no-reconstruction-yet fallback.
 */

/** Every visible `THREE.Mesh` in `scene` — ported verbatim from
 * `@card/wireframe-three`'s `collectMeshes`. */
export function collectMeshes(scene: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.visible) meshes.push(obj);
  });
  return meshes;
}

/**
 * Mounts `PlaneCard`'s front-face art into `slot`: a single-frame wireframe
 * render of every mesh in `scene`, colored with `color`, or — when `scene`
 * is `undefined`/has no meshes — the flat `fallbackSvg` tinted to the same
 * color. Ported verbatim from `@card/wireframe-three`'s `mountCardArt`
 * (camera angle, framing distance, ground-plane grid sizing all unchanged),
 * except the `.card-front-grid` CSS-backdrop toggle is scoped to
 * `.frontContent` (this app's class name for the library's
 * `.card-front-content`).
 */
export function mountCardArt(
  slot: HTMLElement,
  scene: THREE.Object3D | undefined,
  color: string,
  fallbackSvg: string,
): void {
  slot.innerHTML = "";
  const cssGrid = slot.closest("[data-front-content]")?.querySelector<HTMLElement>("[data-front-grid]");
  const meshes = scene ? collectMeshes(scene) : [];

  if (!meshes.length) {
    slot.dataset.frontArtFlat = "true";
    slot.style.color = color;
    slot.innerHTML = fallbackSvg;
    if (cssGrid) cssGrid.style.display = "";
    return;
  }

  delete slot.dataset.frontArtFlat;
  slot.style.color = "";
  if (cssGrid) cssGrid.style.display = "none";

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const width = slot.clientWidth || 280;
  const height = slot.clientHeight || 360;
  renderer.setSize(width, height, false);

  const wireScene = new THREE.Scene();
  const material = new THREE.LineBasicMaterial({ color });
  const disposables: { geometry: THREE.BufferGeometry }[] = [];
  const bounds = new THREE.Box3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const lines = new THREE.LineSegments(edges, material);
    lines.matrix.copy(mesh.matrixWorld);
    lines.matrixAutoUpdate = false;
    wireScene.add(lines);
    disposables.push({ geometry: edges });
    bounds.union(new THREE.Box3().setFromObject(mesh));
  }

  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const size =
    Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z) || 1;
  const grid = new THREE.GridHelper(size * 2.5, 20, color, color);
  grid.position.set(sphere.center.x, bounds.min.y - size * 0.025, sphere.center.z);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  wireScene.add(grid);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 1000);
  const direction = new THREE.Vector3(1.55, 1.05, -1.75).normalize();
  const distance = (sphere.radius || 1) * 2.4;
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  camera.lookAt(sphere.center);
  camera.near = distance / 100;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();

  renderer.render(wireScene, camera);

  for (const d of disposables) d.geometry.dispose();
  material.dispose();
  grid.geometry.dispose();
  (grid.material as THREE.Material).dispose();

  slot.appendChild(canvas);
  // Single-frame render (no animation loop): safe to dispose the GL context
  // immediately — the drawn pixels stay on the canvas.
  renderer.dispose();
}

/**
 * Parsed `.glb` scenes, keyed by model key — loaded at most once per type
 * for the lifetime of the page (mirrors `aircraftModels.ts`'s own
 * `modelScenegraphByGroupKey` cache, but via `three`'s own `GLTFLoader`
 * rather than `@loaders.gl/gltf`, since `mountCardArt` above needs a real
 * `THREE.Object3D` scene graph, not a loaders.gl-shaped one).
 */
const gltfSceneCache = new Map<string, Promise<THREE.Group | null>>();

/**
 * Resolves the aircraft's vendored `.glb` (by its own type designator or,
 * per `resolveModelKeyForTypeAndCategory`, its emitter category's
 * fallback), or `null` if it has no vendored model or the load fails —
 * `mountCardArt` treats `null` identically to "no reconstruction yet",
 * rendering the flat SVG fallback.
 */
export function loadAircraftGltfScene(
  typeDesignator: string | undefined,
  category: string | undefined,
): Promise<THREE.Group | null> {
  const modelKey = resolveModelKeyForTypeAndCategory(typeDesignator, category);
  if (!modelKey) return Promise.resolve(null);

  const cached = gltfSceneCache.get(modelKey);
  if (cached) return cached;

  const loader = new GLTFLoader();
  const promise = loader
    .loadAsync(modelUrl(modelKey))
    .then((gltf) => gltf.scene)
    .catch(() => null);
  gltfSceneCache.set(modelKey, promise);
  return promise;
}

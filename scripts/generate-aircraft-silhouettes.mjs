#!/usr/bin/env node
// Generates a flat top-down silhouette SVG for every vendored 3D aircraft
// model (public/aircraft-models/<TYPE>.glb) that has no authored SVG, and
// rewrites public/aircraft-shapes/manifest.json — the list of type keys the
// 2D icon atlas (components/map/aircraftIcons.ts) and PlaneCard's flat
// fallback load from.
//
// Why: the 2D shape and the 3D model for a type come from the same geometry,
// and no third-party (GPL / non-commercial) shape set is needed. Shapes that
// already carry `data-author` are original, hand-authored work and are NEVER
// overwritten; files this script writes are marked `data-generated="true"`
// and carry no author.
//
// How: every mesh in the .glb (rotor nodes included, at rest — the authored
// SVGs do the same; "Landing gear" is skipped) is projected onto the
// model's X/Z ground plane (model +X → SVG x, model +Z → SVG y; verified
// against the authored shapes, nose is toward -Z and ends up at the top),
// rasterized, outlined on the pixel grid, simplified, and written as one
// `currentColor` path in a square viewBox.
//
// Not part of `npm run build`/CI — re-run manually and commit the output.
//
// Usage: node scripts/generate-aircraft-silhouettes.mjs [TYPE ...]
//   no args: every model with no authored SVG

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MODELS_DIR = path.join(ROOT, "public", "aircraft-models");
const SHAPES_DIR = path.join(ROOT, "public", "aircraft-shapes");

const GRID = 512; // raster resolution of the silhouette's longest side
const PAD_CELLS = 16; // empty margin around the drawing, in raster cells
const SIMPLIFY_EPSILON = 0.9; // Douglas-Peucker tolerance, in raster cells

function parseGlb(file) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, "", resolve, reject));
}

/** World-space top-down triangles `[[x,z],[x,z],[x,z]]` for a parsed glTF. */
function topDownTriangles(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const triangles = [];
  gltf.scene.traverse((node) => {
    if (!node.isMesh || /landing[_ ]gear/i.test(node.name)) return;
    const position = node.geometry.attributes.position;
    const index = node.geometry.index;
    const m = node.matrixWorld.elements;
    const project = (i) => {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[2] * x + m[6] * y + m[10] * z + m[14]];
    };
    const count = index ? index.count : position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      triangles.push([0, 1, 2].map((k) => project(index ? index.getX(i + k) : i + k)));
    }
  });
  return triangles;
}

/** Rasterizes triangles into a GRID×GRID occupancy mask, scaled to fit with padding. */
function rasterize(triangles) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const tri of triangles) {
    for (const [x, y] of tri) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (GRID - 2 * PAD_CELLS) / span;
  const offX = PAD_CELLS + ((GRID - 2 * PAD_CELLS) - (maxX - minX) * scale) / 2;
  const offY = PAD_CELLS + ((GRID - 2 * PAD_CELLS) - (maxY - minY) * scale) / 2;
  const mask = new Uint8Array(GRID * GRID);
  for (const tri of triangles) {
    const p = tri.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY]);
    const yMin = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
    const yMax = Math.min(GRID - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let y = yMin; y <= yMax; y++) {
      const cy = y + 0.5;
      let xa = Infinity, xb = -Infinity;
      for (let i = 0; i < 3; i++) {
        const a = p[i], b = p[(i + 1) % 3];
        if (a[1] === b[1]) {
          if (Math.abs(a[1] - cy) <= 0.5) { xa = Math.min(xa, a[0], b[0]); xb = Math.max(xb, a[0], b[0]); }
          continue;
        }
        if ((a[1] <= cy) !== (b[1] <= cy)) {
          const x = a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
          xa = Math.min(xa, x); xb = Math.max(xb, x);
        }
      }
      if (xa > xb) continue;
      for (let x = Math.max(0, Math.floor(xa)); x <= Math.min(GRID - 1, Math.ceil(xb)); x++) mask[y * GRID + x] = 1;
    }
  }
  return mask;
}

/** Traces the boundary of every filled region (outer rings and holes) as closed point loops. */
function traceLoops(mask) {
  const filled = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID && mask[y * GRID + x] === 1;
  // Directed edges keep the filled cell on the left, so rings chain end-to-start.
  const edges = new Map();
  const add = (x0, y0, x1, y1) => {
    const key = `${x0},${y0}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([x1, y1]);
  };
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) add(x, y, x + 1, y);
      if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops = [];
  for (const [startKey, list] of edges) {
    while (list.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      const loop = [[sx, sy]];
      let [cx, cy] = list.pop();
      while (cx !== sx || cy !== sy) {
        loop.push([cx, cy]);
        const next = edges.get(`${cx},${cy}`);
        if (!next || !next.length) break;
        [cx, cy] = next.pop();
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

function simplifyRing(points, epsilon) {
  // Douglas-Peucker on a closed ring: split at the two mutually farthest-ish points.
  if (points.length <= 4) return points;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!len) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
  };
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    let worst = 0, at = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], a, b);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst <= epsilon) return [a, b];
    return [...dp(pts.slice(0, at + 1)).slice(0, -1), ...dp(pts.slice(at))];
  };
  let far = 0, farD = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > farD) { farD = d; far = i; }
  }
  const first = dp(points.slice(0, far + 1));
  const second = dp([...points.slice(far), points[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

function toPath(loops) {
  return loops
    .map((loop) => simplifyRing(loop, SIMPLIFY_EPSILON))
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`)
    .join("");
}

async function generate(key) {
  const gltf = await parseGlb(path.join(MODELS_DIR, `${key}.glb`));
  const triangles = topDownTriangles(gltf);
  if (!triangles.length) throw new Error(`${key}: no geometry`);
  const d = toPath(traceLoops(rasterize(triangles)));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" data-generated="true" viewBox="0 0 ${GRID} ${GRID}" ` +
    `width="512" height="512" fill="currentColor" fill-rule="evenodd"><path d="${d}"/></svg>\n`
  );
}

const isAuthored = (file) => existsSync(file) && /<svg[^>]*\sdata-author="/.test(readFileSync(file, "utf8").slice(0, 600));

async function main() {
  const modelKeys = readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".glb"))
    .map((f) => f.replace(/\.glb$/, ""));
  const requested = process.argv.slice(2);
  const targets = requested.length ? requested : modelKeys;

  let written = 0;
  for (const key of targets) {
    if (!modelKeys.includes(key)) { console.warn(`skip ${key}: no model`); continue; }
    const out = path.join(SHAPES_DIR, `${key}.svg`);
    if (isAuthored(out)) continue; // hand-authored — never overwrite
    writeFileSync(out, await generate(key));
    written++;
    console.log(`generated ${key}.svg`);
  }

  const manifest = readdirSync(SHAPES_DIR)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/, ""))
    .sort((a, b) => a.localeCompare(b));
  writeFileSync(path.join(SHAPES_DIR, "manifest.json"), JSON.stringify(manifest));
  console.log(`Wrote ${written} silhouette(s); manifest lists ${manifest.length} shape(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

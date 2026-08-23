import earcut, { flatten } from "earcut";
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";

/** Cool-white tint applied per band. Screen-blended and stacked across
 * `TERMINATOR_ELEVATION_BANDS_DEG.length` bands, this composes into a bright
 * wash at the daylight core and a smooth falloff toward night — see
 * `terminator.ts`'s `addTerminatorLayers` doc comment for why dark theme
 * needs this (brightening the day side) rather than darkening night. Most of
 * the visible day area only stacks a handful of the 8 bands (only points
 * very near the subsolar longitude reach all 8), so this needs to be
 * noticeably brighter than a naive "divide the target opacity by 8" guess
 * would suggest — tuned up after the first pass read as barely visible. */
const BAND_TINT: [number, number, number] = [0.32, 0.36, 0.42];

const VERTEX_SHADER = `#version 300 es
uniform mat4 u_matrix;
in vec2 a_pos;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec3 u_color;
out vec4 fragColor;
void main() {
  fragColor = vec4(u_color, 1.0);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Terminator shader compile error: ${info}`);
  }
  return shader;
}

/** One band's [start, count] draw range within the combined vertex buffer
 * (`gl.drawArrays(gl.TRIANGLES, start, count)`). */
interface BandRange {
  start: number;
  count: number;
}

/**
 * A `CustomLayerInterface` that renders the terminator's twilight bands with
 * a true "screen" blend (`result = src + dst - src*dst`, via
 * `gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE)`) instead of flat alpha
 * compositing. MapLibre's style-spec `fill-opacity` paint property only
 * supports standard alpha blending; there's no blend-mode paint property for
 * any layer type, so a genuine screen blend requires bypassing the
 * declarative layer API and drawing with our own shaders/GL state instead.
 *
 * Screen blend brightens whatever's underneath while preserving its
 * underlying color/detail, instead of washing it toward a flat translucent
 * tint the way alpha blending does — a better fit for "brighten the day
 * side" over map imagery than the alpha-blended `fill` layers used for the
 * (already-working) night-darkening case in the light theme.
 *
 * Polygons are triangulated with `earcut` (the same library MapLibre's own
 * fill-layer rendering uses internally for this exact problem) once per
 * `updateBands` call, not per frame — camera movement alone doesn't need
 * new triangles, only new terminator data does.
 */
export class TerminatorScreenBlendLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private uMatrixLocation: WebGLUniformLocation | null = null;
  private uColorLocation: WebGLUniformLocation | null = null;
  private aPosLocation = 0;
  private bandRanges: BandRange[] = [];
  private pendingBands: FeatureCollection<Polygon, { bandIndex: number }> | null =
    null;
  private visible = true;

  constructor(id: string) {
    this.id = id;
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.gl = gl;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create terminator GL program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Terminator GL program link error: ${info}`);
    }
    this.program = program;
    this.uMatrixLocation = gl.getUniformLocation(program, "u_matrix");
    this.uColorLocation = gl.getUniformLocation(program, "u_color");
    this.aPosLocation = gl.getAttribLocation(program, "a_pos");
    this.vertexBuffer = gl.createBuffer();

    if (this.pendingBands) {
      this.uploadBands(this.pendingBands);
      this.pendingBands = null;
    }
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext): void {
    if (this.program) gl.deleteProgram(this.program);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    this.program = null;
    this.vertexBuffer = null;
    this.gl = null;
    this.map = null;
  }

  /** Triangulates each band's polygon (in lng/lat — topologically equivalent
   * to triangulating in Mercator space, since Mercator is a continuous
   * per-coordinate reprojection that preserves point ordering/winding) and
   * uploads one combined vertex buffer, each vertex projected to Mercator
   * world space up front so `render` just needs to apply the camera matrix. */
  private uploadBands(bands: FeatureCollection<Polygon, { bandIndex: number }>): void {
    const gl = this.gl;
    if (!gl || !this.vertexBuffer) return;

    const positions: number[] = [];
    const ranges: BandRange[] = [];

    for (const feature of bands.features) {
      const start = positions.length / 2;
      const { vertices, holes, dimensions } = flatten(feature.geometry.coordinates);
      const triangleIndices = earcut(vertices, holes, dimensions);
      for (const index of triangleIndices) {
        const lng = vertices[index * dimensions];
        const lat = vertices[index * dimensions + 1];
        const mercator = MercatorCoordinate.fromLngLat({ lng, lat });
        positions.push(mercator.x, mercator.y);
      }
      ranges.push({ start, count: positions.length / 2 - start });
    }

    this.bandRanges = ranges;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
  }

  /** Recomputes and uploads new band geometry. Safe to call before `onAdd`
   * has run (e.g. right after construction) — the data is queued and
   * uploaded once the GL context becomes available. */
  updateBands(bands: FeatureCollection<Polygon, { bandIndex: number }>): void {
    if (!this.gl) {
      this.pendingBands = bands;
      return;
    }
    this.uploadBands(bands);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.map?.triggerRepaint();
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.visible || !this.program || !this.vertexBuffer) return;
    if (this.bandRanges.length === 0) return;

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    // True "screen" blend: result = src + dst - src*dst. Restored to
    // MapLibre's documented default before returning (see
    // `CustomLayerInterface.render`'s doc comment) so later layers aren't
    // affected by this layer's custom blend state.
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
    gl.uniformMatrix4fv(this.uMatrixLocation, false, options.modelViewProjectionMatrix);
    gl.uniform3fv(this.uColorLocation, BAND_TINT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.aPosLocation);
    gl.vertexAttribPointer(this.aPosLocation, 2, gl.FLOAT, false, 0, 0);

    for (const { start, count } of this.bandRanges) {
      gl.drawArrays(gl.TRIANGLES, start, count);
    }

    gl.disableVertexAttribArray(this.aPosLocation);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}

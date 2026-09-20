import { ScenegraphLayer, type ScenegraphLayerProps } from "@deck.gl/mesh-layers";
import { GroupNode, type ScenegraphNode } from "@luma.gl/engine";

// Node names as authored in the vendored .glb files (see
// scripts/generate-aircraft-models-manifest.mjs and aircraftModels.ts) — a
// model with no matching node (e.g. C172.glb has no "Landing gear" node) is
// simply left untouched by the corresponding override below.
//
// Most models name their rotor node(s) exactly "Rotors", but a split-rotor
// export (one node per engine, e.g. B752.glb) comes out of the authoring
// tool with generated per-node suffixes instead
// ("Rotor 1789683625120-ueflswm1dth", "...-mirror") — matching by prefix
// picks up both the plain "Rotors" convention and any split/mirrored
// per-engine node without needing the source .glb re-exported.
const ROTOR_NODE_PREFIX = "Rotor";
const LANDING_GEAR_NODE_ID = "Landing gear";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Finds the named glTF node's own `GroupNode` wrapper anywhere in the
 * scenegraph. Deliberately not `GroupNode.traverse()` — that only invokes
 * its visitor on *leaf* nodes (skipping straight through every intermediate
 * `GroupNode`, by design, to accumulate their `worldMatrix`), so it never
 * hands back the named "Rotors"/"Landing gear" node itself, only the
 * anonymous auto-`id`'d `ModelNode` several levels beneath it (glTF node ->
 * glTF mesh -> primitive `ModelNode`, each an extra `GroupNode` layer —
 * confirmed live: `traverse()`'s visitor only ever saw ids like
 * "ModelNode-1"). Mutating the named node's own local matrix instead still
 * correctly cascades to every descendant via that same `worldMatrix` chain
 * when the layer's own `draw()` runs its traversal right after this.
 */
function findNodeById(node: ScenegraphNode, id: string): ScenegraphNode | null {
  if (node.id === id) return node;
  if (node instanceof GroupNode) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Every node whose name starts with `prefix` anywhere in the scenegraph, not
 * just the first — a multi-engine type (e.g. two wing-mounted turbofans)
 * needs one independently-spinning node per engine, each with its own
 * pivot/axis (`rotorSpinInfo` below). Some vendored models name every rotor
 * node exactly "Rotors"; a split-rotor export instead gives each engine's
 * node its own generated suffix (see `ROTOR_NODE_PREFIX` above) — matching
 * by prefix picks up both conventions as independent rotor assemblies. A
 * model whose engines are instead baked into a single merged rotor mesh
 * only ever yields one match here — that's an asset-authoring limit (no way
 * to spin two physically-fused meshes apart from a single node transform),
 * not something this lookup can fix; the source model needs re-exporting
 * with one node per engine.
 */
function findAllNodesByPrefix(node: ScenegraphNode, prefix: string): ScenegraphNode[] {
  const found: ScenegraphNode[] = [];
  if (node.id.startsWith(prefix)) found.push(node);
  if (node instanceof GroupNode) {
    for (const child of node.children) {
      found.push(...findAllNodesByPrefix(child, prefix));
    }
  }
  return found;
}

interface RotorSpinInfo {
  /** Geometric center of the "Rotors" node's own mesh, in its local space —
   * the point `spinRotors` rotates about instead of the node's raw
   * `[0,0,0]` origin. */
  pivot: [number, number, number];
  /** Local unit axis to spin about. Fixed-wing: always the fuselage
   * (forward, local X) axis. Rotorcraft: the bounding box's *shortest*
   * extent — a helicopter's main rotor disc is thin through its vertical
   * mast and a tail rotor is thin through its lateral shaft, so the
   * shortest-extent axis spins each in place on its own axis (vertical /
   * sideways) without tumbling the blades end over end. */
  axis: [number, number, number];
}

// Vendored models' local fuselage-length (forward) axis — see the axis
// convention note in aircraftLayer.ts's `getOrientation`.
const FUSELAGE_AXIS: [number, number, number] = [1, 0, 0];

/**
 * The "Rotors" node's own spin pivot + axis, cached per node the first time
 * it's spun (`spinRotors` below) — before that node's `matrix` has ever
 * been touched, so `getBounds()` (which composes its children's bounds
 * through its *own current* `matrix`, per `GroupNode`) reports their raw
 * authored position/shape. Some vendored models' rotor/prop mesh isn't
 * centered on its own node origin (the mesh's own vertices sit off to one
 * side, e.g. forward at the nose, rather than being authored around
 * `[0,0,0]` the way a rotation pivot needs) — rotating about the node's raw
 * origin in that case sweeps the whole mesh through an arc around the
 * fuselage ("orbiting") instead of spinning it in place. Likewise, a fixed
 * "always roll-axis" assumption breaks for a model whose blades aren't
 * modeled shaft-forward — deriving the axis from the mesh's own bounding
 * box instead works for any vendored model's authoring convention.
 */
const rotorSpinInfoByNode = new WeakMap<ScenegraphNode, RotorSpinInfo>();

function rotorSpinInfo(rotors: ScenegraphNode, rotorcraft: boolean): RotorSpinInfo {
  const cached = rotorSpinInfoByNode.get(rotors);
  if (cached) return cached;

  const bounds = rotors.getBounds();
  let info: RotorSpinInfo;
  if (bounds) {
    const [min, max] = bounds;
    const pivot: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    let axis: [number, number, number] = FUSELAGE_AXIS;
    if (rotorcraft) {
      axis = [0, 0, 0];
      axis[extents.indexOf(Math.min(...extents))] = 1;
    }
    info = { pivot, axis };
  } else {
    info = { pivot: [0, 0, 0], axis: FUSELAGE_AXIS };
  }

  rotorSpinInfoByNode.set(rotors, info);
  return info;
}

/** Rotates `rotors` by `spinDeg` about its own geometric center and spin
 * axis (see `rotorSpinInfo`) rather than its raw node origin. */
function spinRotors(rotors: ScenegraphNode, spinDeg: number, rotorcraft: boolean): void {
  const { pivot, axis } = rotorSpinInfo(rotors, rotorcraft);
  const negatedPivot: [number, number, number] = [-pivot[0], -pivot[1], -pivot[2]];
  rotors.matrix.identity().translate(pivot).rotateAxis(spinDeg * DEG_TO_RAD, axis).translate(negatedPivot);
}

// Degrees/ms the "Rotors" node spins about its own local forward (roll)
// axis — matches the rate the old poll-cadence-driven angle
// (`(Date.now() / 7) % 360`, i.e. 1000/7 deg/s) used to move at, just now
// sampled continuously (see `draw()`) instead of jumping once per ~1s
// feeder poll, which read as choppy/orbiting-looking at that step size.
const ROTOR_DEG_PER_MS = 1 / 7;

// Minimum brightness of a shaded surface, as a fraction of the aircraft's
// tint color (see `getShaders` below).
const SHADOW_FLOOR = 0.25;

interface AnimatedAircraftExtraProps {
  /**
   * Scales the model's "Landing gear" node to zero (visually retracted)
   * when true, full scale when false. No-op for models with no such node.
   */
  gearHidden?: boolean;
  /**
   * True for helicopter models: rotors spin about their own shortest-extent
   * (vertical/sideways) axis. False/omitted for fixed-wing: propellers and
   * fans always spin about the fuselage axis.
   */
  rotorcraft?: boolean;
}

/**
 * `ScenegraphLayer` renders one shared, instanced mesh per layer (see its
 * `draw()` — a single `model.setInstanceCount`/`model.draw()` per
 * `ModelNode`, not per data point), so a named sub-node's transform can only
 * be driven uniformly for every instance in a layer, never per aircraft.
 * That's exactly what rotor spin needs (a single wall-clock-derived angle,
 * shared across every aircraft of a type) — but landing-gear visibility is
 * per-aircraft (depends on that aircraft's own altitude), so
 * aircraftLayer.ts must split gear-bearing types into a gear-shown and a
 * gear-hidden `AnimatedAircraftScenegraphLayer`, each with a fixed
 * `gearHidden` value for its whole data array, rather than expecting this
 * layer to vary it per instance.
 */
export class AnimatedAircraftScenegraphLayer<DataT> extends ScenegraphLayer<
  DataT,
  AnimatedAircraftExtraProps
> {
  static layerName = "AnimatedAircraftScenegraphLayer";

  // PBR shading leaves surfaces facing away from the (fixed) scene light —
  // e.g. the whole upper fuselage/wings when viewed from above — nearly
  // black. Floor the lit result at a fraction of the aircraft's own tint
  // (`vColor`, from `getColor`) so the model always reads in its assigned
  // color while highlights and shading detail above the floor are kept.
  override getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      inject: {
        ...shaders.inject,
        "fs:#main-end": `fragColor.rgb = max(fragColor.rgb, vColor.rgb * ${SHADOW_FLOOR.toFixed(2)});`,
      },
    };
  }

  override draw(opts: Parameters<ScenegraphLayer<DataT>["draw"]>[0]): void {
    this._applyNodeOverrides();
    super.draw(opts);
  }

  private _applyNodeOverrides(): void {
    const scenegraph = this.state.scenegraph;
    if (!scenegraph) return;

    const { gearHidden, rotorcraft = false } = this.props as ScenegraphLayerProps<DataT> & AnimatedAircraftExtraProps;

    const allRotors = findAllNodesByPrefix(scenegraph, ROTOR_NODE_PREFIX);
    if (allRotors.length > 0) {
      // Sampled fresh every `draw()` call off the wall clock, not once per
      // feeder poll — `setNeedsRedraw` keeps deck.gl calling `draw()` every
      // animation frame regardless of whether this poll's aircraft data
      // actually changed, so the spin reads as continuous motion instead of
      // snapping ~143° at a time on a ~1s cadence.
      const spinDeg = (Date.now() * ROTOR_DEG_PER_MS) % 360;
      for (const rotors of allRotors) spinRotors(rotors, spinDeg, rotorcraft);
      this.setNeedsRedraw();
    }

    const landingGear = findNodeById(scenegraph, LANDING_GEAR_NODE_ID);
    if (landingGear) {
      landingGear.update({ scale: gearHidden ? [0, 0, 0] : [1, 1, 1] });
    }
  }
}

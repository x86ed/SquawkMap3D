import { ScenegraphLayer, type ScenegraphLayerProps } from "@deck.gl/mesh-layers";
import { GroupNode, type ScenegraphNode } from "@luma.gl/engine";

// Node names as authored in the vendored .glb files (see
// scripts/generate-aircraft-models-manifest.mjs and aircraftModels.ts) — a
// model with no matching node (e.g. C172.glb has no "Landing gear" node) is
// simply left untouched by the corresponding override below.
const ROTOR_NODE_ID = "Rotors";
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
 * The "Rotors" node's own geometric center, in its local space, cached per
 * node the first time it's spun (`spinRotors` below) — before that node's
 * `matrix` has ever been touched, so `getBounds()` (which composes its
 * children's bounds through its *own current* `matrix`, per `GroupNode`)
 * reports their raw authored position. Some vendored models' rotor/prop
 * mesh isn't centered on its own node origin (the mesh's own vertices sit
 * off to one side, e.g. forward at the nose, rather than being authored
 * around `[0,0,0]` the way a rotation pivot needs) — rotating about the
 * node's raw origin in that case sweeps the whole mesh through an arc
 * around the fuselage ("orbiting") instead of spinning it in place. This
 * pivot is what lets `spinRotors` rotate about the mesh's actual center
 * instead.
 */
const rotorPivotByNode = new WeakMap<ScenegraphNode, [number, number, number]>();

function rotorPivot(rotors: ScenegraphNode): [number, number, number] {
  const cached = rotorPivotByNode.get(rotors);
  if (cached) return cached;
  const bounds = rotors.getBounds();
  const pivot: [number, number, number] = bounds
    ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2, (bounds[0][2] + bounds[1][2]) / 2]
    : [0, 0, 0];
  rotorPivotByNode.set(rotors, pivot);
  return pivot;
}

/** Rotates `rotors` by `spinDeg` about its own geometric center (see
 * `rotorPivot`) rather than its raw node origin. */
function spinRotors(rotors: ScenegraphNode, spinDeg: number): void {
  const pivot = rotorPivot(rotors);
  const negatedPivot: [number, number, number] = [-pivot[0], -pivot[1], -pivot[2]];
  rotors.matrix.identity().translate(pivot).rotateX(spinDeg * DEG_TO_RAD).translate(negatedPivot);
}

interface AnimatedAircraftExtraProps {
  /**
   * Degrees to rotate the model's "Rotors" node about its own local forward
   * (roll) axis — the shaft axis a tractor propeller or turbofan spins
   * about is aligned with the aircraft's own forward axis for every
   * currently-vendored modeled type, so a single fixed rotation axis
   * covers all of them without per-type axis metadata. `undefined` leaves
   * the node's current rotation alone (no "Rotors" node present).
   */
  rotorSpinDeg?: number;
  /**
   * Scales the model's "Landing gear" node to zero (visually retracted)
   * when true, full scale when false. No-op for models with no such node.
   */
  gearHidden?: boolean;
}

/**
 * `ScenegraphLayer` renders one shared, instanced mesh per layer (see its
 * `draw()` — a single `model.setInstanceCount`/`model.draw()` per
 * `ModelNode`, not per data point), so a named sub-node's transform can only
 * be driven uniformly for every instance in a layer, never per aircraft.
 * That's exactly what rotor spin needs (a single wall-clock-derived angle,
 * shared across every aircraft of a type, same cadence as
 * aircraftLayer.ts's icon-based rotor accent) — but landing-gear visibility
 * is per-aircraft (depends on that aircraft's own altitude), so
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

  override draw(opts: Parameters<ScenegraphLayer<DataT>["draw"]>[0]): void {
    this._applyNodeOverrides();
    super.draw(opts);
  }

  private _applyNodeOverrides(): void {
    const scenegraph = this.state.scenegraph;
    if (!scenegraph) return;

    const { rotorSpinDeg, gearHidden } = this.props as ScenegraphLayerProps<DataT> &
      AnimatedAircraftExtraProps;

    const rotors = findNodeById(scenegraph, ROTOR_NODE_ID);
    if (rotors && rotorSpinDeg !== undefined) {
      spinRotors(rotors, rotorSpinDeg);
    }

    const landingGear = findNodeById(scenegraph, LANDING_GEAR_NODE_ID);
    if (landingGear) {
      landingGear.update({ scale: gearHidden ? [0, 0, 0] : [1, 1, 1] });
    }
  }
}

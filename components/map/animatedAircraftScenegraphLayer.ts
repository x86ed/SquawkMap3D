import { ScenegraphLayer, type ScenegraphLayerProps } from "@deck.gl/mesh-layers";

// Node names as authored in the vendored .glb files (see
// scripts/generate-aircraft-models-manifest.mjs and aircraftModels.ts) — a
// model with no matching node (e.g. C172.glb has no "Landing gear" node) is
// simply left untouched by the corresponding override below.
const ROTOR_NODE_ID = "Rotors";
const LANDING_GEAR_NODE_ID = "Landing gear";

const DEG_TO_RAD = Math.PI / 180;

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

    scenegraph.traverse((node) => {
      if (node.id === ROTOR_NODE_ID && rotorSpinDeg !== undefined) {
        node.update({ rotation: [rotorSpinDeg * DEG_TO_RAD, 0, 0] });
      } else if (node.id === LANDING_GEAR_NODE_ID) {
        node.update({ scale: gearHidden ? [0, 0, 0] : [1, 1, 1] });
      }
    });
  }
}

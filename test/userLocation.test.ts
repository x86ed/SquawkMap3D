import test from "node:test";
import assert from "node:assert/strict";
import {
  setUserLocationMarkerVisibility,
  setRangeRingsVisibility,
  USER_LOCATION_ICON_LAYER_ID,
  USER_RINGS_LINE_LAYER_ID,
  USER_RINGS_LABEL_LAYER_ID,
} from "../components/map/userLocation";

/** Minimal MapLibreMap fake — just enough surface area for
 * `setUserLocationMarkerVisibility`/`setRangeRingsVisibility` to exercise:
 * `getLayer` (existence check) and `setLayoutProperty` (visibility write). */
function makeFakeMap(existingLayerIds: string[]) {
  const visibility = new Map<string, string>();
  for (const id of existingLayerIds) visibility.set(id, "visible");
  return {
    getLayer: (id: string) => (visibility.has(id) ? { id } : undefined),
    setLayoutProperty: (id: string, _prop: string, value: string) => {
      visibility.set(id, value);
    },
    _visibility: visibility,
  };
}

const ALL_LAYER_IDS = [
  USER_LOCATION_ICON_LAYER_ID,
  USER_RINGS_LINE_LAYER_ID,
  USER_RINGS_LABEL_LAYER_ID,
];

test("setUserLocationMarkerVisibility only affects the icon layer, not the rings", () => {
  const map = makeFakeMap(ALL_LAYER_IDS);
  setUserLocationMarkerVisibility(map as never, false);
  assert.equal(map._visibility.get(USER_LOCATION_ICON_LAYER_ID), "none");
  assert.equal(map._visibility.get(USER_RINGS_LINE_LAYER_ID), "visible");
  assert.equal(map._visibility.get(USER_RINGS_LABEL_LAYER_ID), "visible");
});

test("setRangeRingsVisibility only affects the ring layers, not the icon", () => {
  const map = makeFakeMap(ALL_LAYER_IDS);
  setRangeRingsVisibility(map as never, false);
  assert.equal(map._visibility.get(USER_LOCATION_ICON_LAYER_ID), "visible");
  assert.equal(map._visibility.get(USER_RINGS_LINE_LAYER_ID), "none");
  assert.equal(map._visibility.get(USER_RINGS_LABEL_LAYER_ID), "none");
});

test("both toggles can independently be visible at the same time", () => {
  const map = makeFakeMap(ALL_LAYER_IDS);
  setUserLocationMarkerVisibility(map as never, true);
  setRangeRingsVisibility(map as never, true);
  assert.equal(map._visibility.get(USER_LOCATION_ICON_LAYER_ID), "visible");
  assert.equal(map._visibility.get(USER_RINGS_LINE_LAYER_ID), "visible");
  assert.equal(map._visibility.get(USER_RINGS_LABEL_LAYER_ID), "visible");
});

test("toggling one repeatedly never touches the other's layers", () => {
  const map = makeFakeMap(ALL_LAYER_IDS);
  setRangeRingsVisibility(map as never, false);
  setRangeRingsVisibility(map as never, true);
  setRangeRingsVisibility(map as never, false);
  assert.equal(map._visibility.get(USER_LOCATION_ICON_LAYER_ID), "visible");
  assert.equal(map._visibility.get(USER_RINGS_LINE_LAYER_ID), "none");
});

test("no-ops safely when the layers don't exist yet (no location resolved)", () => {
  const map = makeFakeMap([]);
  assert.doesNotThrow(() => {
    setUserLocationMarkerVisibility(map as never, true);
    setRangeRingsVisibility(map as never, true);
  });
});

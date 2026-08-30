import test from "node:test";
import assert from "node:assert/strict";
import { docksTooClose, type DockRect } from "./dockCollision";

function rect(overrides: Partial<DockRect>): DockRect {
  return { top: 0, right: 0, bottom: 0, left: 0, height: 0, ...overrides };
}

test("docksTooClose is false for clearly separated boxes", () => {
  const left = rect({ top: 0, bottom: 40, left: 0, right: 100 });
  const right = rect({ top: 0, bottom: 40, left: 200, right: 300 });
  assert.equal(docksTooClose(left, right, 16), false);
});

test("docksTooClose is true for overlapping boxes", () => {
  const left = rect({ top: 0, bottom: 40, left: 0, right: 150 });
  const right = rect({ top: 0, bottom: 40, left: 100, right: 300 });
  assert.equal(docksTooClose(left, right, 16), true);
});

test("docksTooClose is true for boxes within gapPx but not overlapping", () => {
  const left = rect({ top: 0, bottom: 40, left: 0, right: 100 });
  const right = rect({ top: 0, bottom: 40, left: 110, right: 300 });
  assert.equal(docksTooClose(left, right, 16), true);
});

test("docksTooClose is false for boxes exactly gapPx apart (boundary case)", () => {
  const left = rect({ top: 0, bottom: 40, left: 0, right: 100 });
  const right = rect({ top: 0, bottom: 40, left: 116, right: 300 });
  assert.equal(docksTooClose(left, right, 16), false);
});

test("docksTooClose is false for boxes with no vertical overlap despite horizontal proximity", () => {
  const left = rect({ top: 0, bottom: 40, left: 0, right: 100 });
  const right = rect({ top: 41, bottom: 80, left: 50, right: 300 });
  assert.equal(docksTooClose(left, right, 16), false);
});

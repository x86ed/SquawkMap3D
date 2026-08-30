import test from "node:test";
import assert from "node:assert/strict";
import { selectTrackMarkers } from "../components/map/aircraftLayer";
import { AIRCRAFT_TRACK_MARKER_INTERVAL_MS } from "../components/map/constants";
import type { TrackPoint } from "../components/map/aircraft";

function point(timestamp: number): TrackPoint {
  return { lat: 0, lon: 0, altitude: 1000, timestamp };
}

test("selectTrackMarkers returns an empty array for an empty track", () => {
  assert.deepEqual(selectTrackMarkers([]), []);
});

test("selectTrackMarkers returns the single point for a one-point track", () => {
  const only = point(1_000);
  assert.deepEqual(selectTrackMarkers([only]), [only]);
});

test("selectTrackMarkers decimates points closer together than the interval", () => {
  // 20 points, one per second, over an interval that keeps ~one per 15s.
  const points = Array.from({ length: 20 }, (_, i) => point(i * 1_000));
  const markers = selectTrackMarkers(points);

  // Roughly one marker per interval, well under the raw point count.
  assert.ok(markers.length < points.length);
  assert.ok(markers.length <= Math.ceil((19_000) / AIRCRAFT_TRACK_MARKER_INTERVAL_MS) + 2);

  for (let i = 1; i < markers.length - 1; i++) {
    const gap = markers[i].timestamp - markers[i - 1].timestamp;
    assert.ok(gap >= AIRCRAFT_TRACK_MARKER_INTERVAL_MS);
  }
});

test("selectTrackMarkers always includes the last point even short of a full interval", () => {
  const points = [point(0), point(1_000), point(2_000)];
  const markers = selectTrackMarkers(points);
  assert.equal(markers[markers.length - 1], points[points.length - 1]);
  assert.equal(markers[markers.length - 1].timestamp, 2_000);
});

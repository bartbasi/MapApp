// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { COVERAGE_EDGE_M, CoverageArea } from './coverage-area';
import { SynthWorld, rect } from './test-tiles';

const world = new SynthWorld();
/** A county 2 km square, west of a line 10 m east of the origin, with a 200 m lake cut out of it. */
const area = new CoverageArea(world.coverageGeometry([rect(-2000, -1000, 10, 1000), rect(-1500, -100, -1300, 100)]));
const at = (e: number, n: number) => world.at(e, n);

describe('coverage area', () => {
  it('knows what is inside, outside and in a hole', () => {
    expect(area.contains(at(-500, 0).lng, at(-500, 0).lat)).toBe(true);
    expect(area.contains(at(30, 0).lng, at(30, 0).lat)).toBe(false);
    expect(area.contains(at(-1400, 0).lng, at(-1400, 0).lat)).toBe(false);
  });

  it('measures the distance to the nearest edge in meters, inside or out', () => {
    expect(Math.abs(area.edgeDistanceM(at(-20, 0).lng, at(-20, 0).lat) - 30)).toBeLessThan(0.05);
    expect(Math.abs(area.edgeDistanceM(at(40, 300).lng, at(40, 300).lat) - 30)).toBeLessThan(0.05);
    expect(Math.abs(area.edgeDistanceM(at(-500, 990).lng, at(-500, 990).lat) - 10)).toBeLessThan(0.05);
  });

  it('covers a point only well inside the edge', () => {
    expect(COVERAGE_EDGE_M).toBe(25);
    const covers = (e: number) => area.covers(at(e, 0).lng, at(e, 0).lat);
    expect(covers(-500)).toBe(true);
    expect(covers(10 - 26)).toBe(true);
    expect(covers(10 - 24)).toBe(false);
    expect(covers(5)).toBe(false);
    expect(covers(60)).toBe(false);
  });

  it('reads a MultiPolygon', () => {
    const two = new CoverageArea({ type: 'MultiPolygon', coordinates: [world.coverageGeometry([rect(-300, -300, -100, 300)]).coordinates, world.coverageGeometry([rect(100, -300, 300, 300)]).coordinates] });
    expect(two.covers(at(-200, 0).lng, at(-200, 0).lat)).toBe(true);
    expect(two.covers(at(200, 0).lng, at(200, 0).lat)).toBe(true);
    expect(two.contains(at(0, 0).lng, at(0, 0).lat)).toBe(false);
  });
});

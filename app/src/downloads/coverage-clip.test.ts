// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { CoverageArea } from '../parcels/coverage-area';
import type { CoverageGeometry } from '../platform/archive-meta';
import { parseCoverage } from '../platform/archive-meta';
import { clipCoverage, clipRing } from './coverage-clip';

type Ring = [number, number][];

const square = (w: number, s: number, e: number, n: number): Ring => [
  [w, s],
  [e, s],
  [e, n],
  [w, n],
  [w, s],
];

/** A U shape: a 0..10 square with a notch from x 3..7 cut down from the top to y 2. */
const U: Ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [7, 10],
  [7, 2],
  [3, 2],
  [3, 10],
  [0, 10],
  [0, 0],
];

function area(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i]![0] * ring[i + 1]![1] - ring[i + 1]![0] * ring[i]![1];
  return Math.abs(a / 2);
}

describe('clipping a coverage outline to a rectangle', () => {
  it('keeps an outline inside the rectangle as it is', () => {
    const g: CoverageGeometry = { type: 'Polygon', coordinates: [square(1, 1, 2, 2)] };
    expect(clipCoverage(g, [0, 0, 10, 10])).toEqual(g);
  });

  it('cuts an outline that crosses the rectangle to the shared part', () => {
    const out = clipCoverage({ type: 'Polygon', coordinates: [square(0, 0, 10, 10)] }, [5, 5, 20, 20]);
    expect(out?.type).toBe('Polygon');
    const ring = (out as { coordinates: Ring[] }).coordinates[0]!;
    expect(area(ring)).toBeCloseTo(25);
    for (const [x, y] of ring) {
      expect(x).toBeGreaterThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(5);
    }
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('gives null when the outline and the rectangle do not meet', () => {
    expect(clipCoverage({ type: 'Polygon', coordinates: [square(0, 0, 1, 1)] }, [2, 2, 3, 3])).toBeNull();
  });

  it('gives null when they only touch along an edge', () => {
    expect(clipCoverage({ type: 'Polygon', coordinates: [square(0, 0, 1, 1)] }, [1, 0, 2, 1])).toBeNull();
  });

  it('keeps a hole that is still inside, and drops one that is cut away', () => {
    const g: CoverageGeometry = { type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(1, 1, 2, 2), square(8, 8, 9, 9)] };
    const out = clipCoverage(g, [0, 0, 5, 5]) as { type: 'Polygon'; coordinates: Ring[] };
    expect(out.coordinates).toHaveLength(2);
    expect(area(out.coordinates[1]!)).toBeCloseTo(1);
  });

  it('drops the parts of a multipolygon outside, and gives a polygon when one part is left', () => {
    const g: CoverageGeometry = { type: 'MultiPolygon', coordinates: [[square(0, 0, 1, 1)], [square(5, 5, 6, 6)]] };
    const one = clipCoverage(g, [4, 4, 7, 7]);
    expect(one?.type).toBe('Polygon');
    const both = clipCoverage(g, [0, 0, 7, 7]);
    expect(both?.type).toBe('MultiPolygon');
    expect((both as { coordinates: Ring[][] }).coordinates).toHaveLength(2);
  });

  it('cuts a concave outline into a ring that still tests points right', () => {
    // The rectangle takes the top of both arms of the U, which are apart:
    // one ring with a doubled stretch along the rectangle's lower edge.
    const rect: Bounds = [0, 5, 10, 10];
    const out = clipCoverage({ type: 'Polygon', coordinates: [U] }, rect)!;
    expect(out).not.toBeNull();
    const cover = new CoverageArea(out);
    expect(cover.contains(1.5, 7)).toBe(true); // left arm
    expect(cover.contains(8.5, 7)).toBe(true); // right arm
    expect(cover.contains(5, 7)).toBe(false); // the notch between them
    expect(cover.contains(1.5, 3)).toBe(false); // in the U, but below the rectangle
    expect(cover.contains(11, 7)).toBe(false);
    const ring = (out as { coordinates: Ring[] }).coordinates[0]!;
    expect(area(ring)).toBeCloseTo(30); // two arms of 3 by 5
  });

  it('gives an outline the app reads back as coverage', () => {
    const out = clipCoverage({ type: 'Polygon', coordinates: [U] }, [-1, 1, 11, 6]);
    expect(parseCoverage(JSON.parse(JSON.stringify(out)))).toEqual(out);
  });

  it('works on a real-looking outline in degrees', () => {
    const county: Ring = [
      [-89.2179, 39.6526],
      [-88.745, 39.6526],
      [-88.745, 40.0554],
      [-89.0, 40.0554],
      [-89.0, 40.1],
      [-89.2179, 40.1],
      [-89.2179, 39.6526],
    ];
    const box: Bounds = [-89.1, 39.95, -88.9, 40.08];
    const out = clipCoverage({ type: 'Polygon', coordinates: [county] }, box)!;
    const cover = new CoverageArea(out);
    expect(cover.contains(-89.05, 40.07)).toBe(true);
    expect(cover.contains(-88.95, 40.07)).toBe(false); // in the box, outside the county
    expect(cover.contains(-88.8, 40.0)).toBe(false); // in the county, outside the box
  });

  it('clipRing drops a ring with no area left', () => {
    expect(clipRing(square(0, 0, 1, 1), [1, 1, 2, 2])).toBeNull();
  });
});

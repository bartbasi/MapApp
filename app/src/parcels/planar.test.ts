// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { LruCache } from './lru-cache';
import { clipRing, clipSegment, insideRings, nearestT, signedArea } from './planar';

const square = [0, 0, 10, 0, 10, 10, 0, 10];
const hole = [4, 4, 4, 6, 6, 6, 6, 4];

describe('insideRings', () => {
  it('uses the even-odd rule for holes and parts', () => {
    expect(insideRings([square], 1, 1)).toBe(true);
    expect(insideRings([square], 11, 1)).toBe(false);
    expect(insideRings([square, hole], 5, 5)).toBe(false);
    expect(insideRings([square, hole], 3, 5)).toBe(true);
    const part2 = [20, 0, 30, 0, 30, 10, 20, 10];
    expect(insideRings([square, part2], 25, 5)).toBe(true);
    expect(insideRings([square, part2], 15, 5)).toBe(false);
  });
});

describe('nearestT', () => {
  it('clamps to the segment ends', () => {
    expect(nearestT(0, 0, 10, 0, 5, 3)).toBe(0.5);
    expect(nearestT(0, 0, 10, 0, -5, 3)).toBe(0);
    expect(nearestT(0, 0, 10, 0, 15, 3)).toBe(1);
    expect(nearestT(1, 1, 1, 1, 15, 3)).toBe(0);
  });
});

describe('clipSegment', () => {
  const box = [0, 0, 10, 10] as const;
  it('keeps the inside part', () => {
    expect(clipSegment(-5, 5, 15, 5, box)).toEqual([0.25, 0.75]);
    expect(clipSegment(2, 2, 3, 3, box)).toEqual([0, 1]);
  });
  it('drops a segment wholly outside, including one along a buffer line', () => {
    expect(clipSegment(-5, -5, -1, 20, box)).toBeNull();
    expect(clipSegment(-0.7, -3, -0.7, 13, box)).toBeNull();
    expect(clipSegment(10.7, 2, 10.7, 8, box)).toBeNull();
  });
  it('keeps a segment lying on the box edge', () => {
    expect(clipSegment(0, 2, 0, 8, box)).toEqual([0, 1]);
    expect(clipSegment(10, -2, 10, 8, box)).toEqual([0.2, 1]);
  });
});

describe('clipRing and signedArea', () => {
  it('cuts a ring to a box and keeps the area right', () => {
    expect(signedArea(square)).toBe(100);
    const cut = clipRing(square, [5, -1, 20, 20]);
    expect(Math.abs(signedArea(cut))).toBe(50);
    expect(clipRing(square, [20, 20, 30, 30])).toEqual([]);
    // Outer ring minus hole, both cut by the same box, sum to the cut area.
    const box = [0, 0, 5, 10] as const;
    expect(Math.abs(signedArea(clipRing(square, box)) + signedArea(clipRing(hole, box)))).toBe(48);
  });
});

describe('LruCache', () => {
  it('drops the entry used longest ago', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1);
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.size).toBe(2);
  });
});

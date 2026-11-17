// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { zxyToTileId } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { TileIdSet, firstTileId, rectHas, rectTileCount, tileRect, wantedTileIds } from './tile-cover';

/** A small repeatable pseudo-random generator. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('tileRect', () => {
  it('finds the tiles an area overlaps', () => {
    expect(tileRect([-180, -85, 180, 85], 0)).toEqual({ z: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 });
    expect(tileRect([-180, -85, 180, 85], 2)).toEqual({ z: 2, minX: 0, minY: 0, maxX: 3, maxY: 3 });
    // Decatur, Illinois at zoom 10.
    expect(tileRect([-88.96, 39.84, -88.95, 39.85], 10)).toEqual({ z: 10, minX: 258, minY: 388, maxX: 258, maxY: 388 });
  });

  it('leaves out a tile the area only touches along an edge', () => {
    // The east half of the world at zoom 1, whose west edge is the prime meridian.
    expect(tileRect([0, 0, 180, 85], 1)).toEqual({ z: 1, minX: 1, minY: 0, maxX: 1, maxY: 0 });
  });

  it('gives a point the one tile it lies in', () => {
    const r = tileRect([10, 10, 10, 10], 5);
    expect(rectTileCount(r)).toBe(1);
  });

  it('clamps polar latitudes', () => {
    expect(tileRect([-180, -90, 180, 90], 3)).toEqual({ z: 3, minX: 0, minY: 0, maxX: 7, maxY: 7 });
  });
});

describe('Hilbert tile IDs', () => {
  it('number every quadtree cell as one unbroken run at deeper zooms', () => {
    const rand = lcg(7);
    for (let i = 0; i < 2000; i++) {
      const z = 1 + Math.floor(rand() * 20);
      const k = Math.floor(rand() * z);
      const x = Math.floor(rand() * 2 ** z);
      const y = Math.floor(rand() * 2 ** z);
      const d = z - k;
      const cell = zxyToTileId(k, Math.floor(x / 2 ** d), Math.floor(y / 2 ** d)) - firstTileId(k);
      const id = zxyToTileId(z, x, y) - firstTileId(z);
      expect(Math.floor(id / 4 ** d)).toBe(cell);
    }
  });
});

describe('wantedTileIds', () => {
  it('holds exactly the tiles of the area at every zoom, checked tile by tile', () => {
    const rand = lcg(11);
    for (let trial = 0; trial < 40; trial++) {
      const w = -180 + rand() * 360;
      const e = Math.min(180, w + rand() * 120);
      const s = -85 + rand() * 170;
      const n = Math.min(85, s + rand() * 60);
      const bounds: Bounds = [w, s, e, n];
      const minzoom = Math.floor(rand() * 3);
      const maxzoom = minzoom + Math.floor(rand() * 4);
      const set = wantedTileIds(bounds, minzoom, maxzoom);
      let expected = 0;
      for (let z = 0; z <= maxzoom + 1; z++) {
        const r = tileRect(bounds, z);
        for (let x = 0; x < 2 ** z; x++) {
          for (let y = 0; y < 2 ** z; y++) {
            const want = z >= minzoom && z <= maxzoom && rectHas(r, x, y);
            if (want) expected++;
            expect(set.has(zxyToTileId(z, x, y))).toBe(want);
          }
        }
      }
      expect(set.size).toBe(expected);
    }
  });

  it('stays a short list of intervals for a county at zoom 16', () => {
    const set = wantedTileIds([-89.2179, 39.6526, -88.745, 40.0554], 0, 16);
    let tiles = 0;
    for (let z = 0; z <= 16; z++) tiles += rectTileCount(tileRect([-89.2179, 39.6526, -88.745, 40.0554], z));
    expect(set.size).toBe(tiles);
    expect(set.intervals.length).toBeLessThan(tiles / 4);
  });
});

describe('TileIdSet', () => {
  const set = new TileIdSet([
    [10, 20],
    [30, 40],
    [18, 25],
  ]);

  it('merges overlapping intervals', () => {
    expect(set.intervals).toEqual([
      [10, 25],
      [30, 40],
    ]);
    expect(set.size).toBe(25);
  });

  it('answers membership and overlap', () => {
    expect(set.has(9)).toBe(false);
    expect(set.has(10)).toBe(true);
    expect(set.has(25)).toBe(false);
    expect(set.has(39)).toBe(true);
    expect(set.overlaps(25, 30)).toBe(false);
    expect(set.overlaps(25, 31)).toBe(true);
    expect(set.overlaps(0, Infinity)).toBe(true);
    expect(set.overlaps(40, Infinity)).toBe(false);
  });

  it('clips a run of IDs to the parts in the set', () => {
    expect(set.clip(0, 100)).toEqual([
      [10, 25],
      [30, 40],
    ]);
    expect(set.clip(20, 35)).toEqual([
      [20, 25],
      [30, 35],
    ]);
    expect(set.clip(25, 30)).toEqual([]);
  });
});

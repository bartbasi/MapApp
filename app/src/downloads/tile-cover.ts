// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Which tiles an area needs, as sets of PMTiles tile IDs.
//
// PMTiles numbers the tiles of each zoom along a Hilbert curve. On that curve
// every quadtree cell covers one unbroken run of tile IDs at any deeper zoom:
// the cell at zoom k with Hilbert index h (its tile ID minus the first ID of
// zoom k) holds IDs first(z) + h * 4^(z-k) up to, but not including,
// first(z) + (h + 1) * 4^(z-k). So the tiles inside a rectangle come out as
// a short sorted list of ID intervals by walking the quadtree, without
// listing every tile. `tile-cover.test.ts` checks that property.

import { zxyToTileId } from 'pmtiles';
import type { Bounds } from '../map/tile-math';

/** The tiles of one zoom inside an area, inclusive on both ends. */
export interface TileRect {
  z: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MAX_LAT = 85.0511287798066;

function lonToX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}

function latToY(lat: number, z: number): number {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2) * 2 ** z;
}

function span(lo: number, hi: number, n: number): [number, number] {
  const a = Math.min(n - 1, Math.max(0, Math.floor(lo)));
  // A tile that the area only touches along its edge is not needed.
  const b = Math.min(n - 1, Math.max(a, Math.ceil(hi) - 1));
  return [a, b];
}

/**
 * Every tile at zoom `z` that the area overlaps. A tile that only shares an
 * edge with the area is left out; an area of zero width or height still
 * gets the tile it lies in.
 */
export function tileRect(bounds: Bounds, z: number): TileRect {
  const n = 2 ** z;
  const [minX, maxX] = span(lonToX(bounds[0], z), lonToX(bounds[2], z), n);
  const [minY, maxY] = span(latToY(bounds[3], z), latToY(bounds[1], z), n);
  return { z, minX, minY, maxX, maxY };
}

export function rectHas(r: TileRect, x: number, y: number): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
}

export function rectTileCount(r: TileRect): number {
  return (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
}

/** The first tile ID of zoom z. */
export function firstTileId(z: number): number {
  return (4 ** z - 1) / 3;
}

/** Half-open interval [start, end) of tile IDs. */
export type IdInterval = [number, number];

function rectIntervals(r: TileRect, out: IdInterval[]): void {
  const z = r.z;
  const base = firstTileId(z);
  const visit = (k: number, cx: number, cy: number): void => {
    const d = z - k;
    const size = 2 ** d;
    const x0 = cx * size;
    const y0 = cy * size;
    const x1 = x0 + size - 1;
    const y1 = y0 + size - 1;
    if (x1 < r.minX || x0 > r.maxX || y1 < r.minY || y0 > r.maxY) return;
    if (x0 >= r.minX && x1 <= r.maxX && y0 >= r.minY && y1 <= r.maxY) {
      const start = base + (zxyToTileId(k, cx, cy) - firstTileId(k)) * 4 ** d;
      out.push([start, start + 4 ** d]);
      return;
    }
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      visit(k + 1, cx * 2 + dx, cy * 2 + dy);
    }
  };
  visit(0, 0, 0);
}

/** A sorted set of tile IDs, held as disjoint intervals. */
export class TileIdSet {
  readonly intervals: readonly IdInterval[];

  constructor(intervals: IdInterval[]) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: IdInterval[] = [];
    for (const [s, e] of intervals) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    this.intervals = merged;
  }

  /** How many tile IDs the set holds. */
  get size(): number {
    return this.intervals.reduce((n, [s, e]) => n + e - s, 0);
  }

  /** Index of the first interval that ends after `id`. */
  private firstEndingAfter(id: number): number {
    let lo = 0;
    let hi = this.intervals.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.intervals[mid]![1] <= id) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  has(id: number): boolean {
    const iv = this.intervals[this.firstEndingAfter(id)];
    return !!iv && iv[0] <= id;
  }

  /** True if any ID in [start, end) is in the set. */
  overlaps(start: number, end: number): boolean {
    const iv = this.intervals[this.firstEndingAfter(start)];
    return !!iv && iv[0] < end;
  }

  /** The parts of [start, end) that are in the set, in order. */
  clip(start: number, end: number): IdInterval[] {
    const out: IdInterval[] = [];
    for (let i = this.firstEndingAfter(start); i < this.intervals.length; i++) {
      const [s, e] = this.intervals[i]!;
      if (s >= end) break;
      out.push([Math.max(s, start), Math.min(e, end)]);
    }
    return out;
  }
}

/** Every tile ID from `minzoom` to `maxzoom` whose tile the area overlaps. */
export function wantedTileIds(bounds: Bounds, minzoom: number, maxzoom: number): TileIdSet {
  const out: IdInterval[] = [];
  for (let z = minzoom; z <= maxzoom; z++) rectIntervals(tileRect(bounds, z), out);
  return new TileIdSet(out);
}

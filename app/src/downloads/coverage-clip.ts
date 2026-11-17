// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Cuts an archive's coverage outline down to a rectangle, for the metadata of
// a downloaded area (D33). An area's archive must not claim to cover land
// outside the rectangle it was cut to: the readout would say "Not in a parcel"
// there, the fault D32 describes.
//
// Each ring is clipped on its own against the four edges of the rectangle
// (Sutherland and Hodgman). Where a ring leaves the rectangle and comes back,
// the result runs along the rectangle's edge and back. Those doubled edges
// cancel under the even-odd rule the app uses to test a point
// (parcels/coverage-area.ts), and they lie on the rectangle's edge, which is
// the edge of the data anyway.

import type { CoverageGeometry } from '../platform/archive-meta';
import type { Bounds } from '../map/tile-math';

type Point = [number, number];

/** Clips an open ring (no repeated last point) against one half-plane. */
function clipEdge(ring: Point[], inside: (p: Point) => boolean, cross: (a: Point, b: Point) => Point): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i]!;
    const prev = ring[(i + ring.length - 1) % ring.length]!;
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(cross(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(cross(prev, cur));
    }
  }
  return out;
}

const atX = (a: Point, b: Point, x: number): Point => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
const atY = (a: Point, b: Point, y: number): Point => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];

/** Twice the signed area of an open ring. */
function area2(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  return sum;
}

/** Removes points equal to the one before them, including across the closing edge. */
function dedupe(ring: Point[]): Point[] {
  const out = ring.filter((p, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length]!;
    return ring.length === 1 || p[0] !== prev[0] || p[1] !== prev[1];
  });
  return out;
}

/** One closed ring clipped to the rectangle: closed again, or null when nothing with area is left. */
export function clipRing(ring: readonly Point[], [w, s, e, n]: Bounds): Point[] | null {
  let open: Point[] = ring.map((p) => [p[0], p[1]]);
  const first = open[0];
  const last = open[open.length - 1];
  if (open.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) open.pop();
  open = clipEdge(open, (p) => p[0] >= w, (a, b) => atX(a, b, w));
  open = clipEdge(open, (p) => p[0] <= e, (a, b) => atX(a, b, e));
  open = clipEdge(open, (p) => p[1] >= s, (a, b) => atY(a, b, s));
  open = clipEdge(open, (p) => p[1] <= n, (a, b) => atY(a, b, n));
  open = dedupe(open);
  if (open.length < 3 || area2(open) === 0) return null;
  return [...open, [open[0]![0], open[0]![1]]];
}

/** One polygon clipped: its outer ring and whichever holes still have area, or null when the outer ring is gone. */
function clipPolygon(poly: readonly (readonly Point[])[], bounds: Bounds): Point[][] | null {
  const [outer, ...holes] = poly;
  if (!outer) return null;
  const clippedOuter = clipRing(outer, bounds);
  if (!clippedOuter) return null;
  const clippedHoles = holes.map((h) => clipRing(h, bounds)).filter((h): h is Point[] => h !== null);
  return [clippedOuter, ...clippedHoles];
}

/**
 * The part of a coverage outline inside a rectangle, or null when they do not
 * meet. A polygon stays a polygon; a multipolygon keeps the parts that remain,
 * as a polygon when only one does.
 */
export function clipCoverage(geometry: CoverageGeometry, bounds: Bounds): CoverageGeometry | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const kept = polygons.map((p) => clipPolygon(p, bounds)).filter((p): p is Point[][] => p !== null);
  if (kept.length === 0) return null;
  if (kept.length === 1) return { type: 'Polygon', coordinates: kept[0]! };
  return { type: 'MultiPolygon', coordinates: kept };
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Plane geometry on rings held as flat coordinate lists [x0, y0, x1, y1, ...].
// A ring is closed implicitly: the last point joins the first, and the first
// point is not repeated at the end.

/** A flat ring: x and y of each corner in turn. */
export type Ring = readonly number[];

/** West, south, east, north (or min x, min y, max x, max y). */
export type Box = readonly [number, number, number, number];

/**
 * True if the point lies inside the rings by the even-odd rule. With the
 * rings of one parcel (outer rings, holes, separate parts) this is the
 * parcel's area whatever the rings' winding. A point exactly on an edge may
 * go either way; callers that care measure the distance to the edge instead.
 */
export function insideRings(rings: readonly Ring[], px: number, py: number): boolean {
  let inside = false;
  for (const r of rings) {
    const n = r.length >> 1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[2 * i]!;
      const yi = r[2 * i + 1]!;
      const xj = r[2 * j]!;
      const yj = r[2 * j + 1]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The fraction t (0 to 1) along segment A to B of the point nearest P. */
export function nearestT(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * The part of segment A to B inside a box (edges included), as fractions
 * [t0, t1] along it, or null if none of it is inside (Liang-Barsky).
 * t0 equals t1 when the segment only touches the box at one point.
 */
export function clipSegment(ax: number, ay: number, bx: number, by: number, box: Box): [number, number] | null {
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - box[0], box[2] - ax, ay - box[1], box[3] - ay];
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 4; k++) {
    const pk = p[k]!;
    const qk = q[k]!;
    if (pk === 0) {
      if (qk < 0) return null;
      continue;
    }
    const r = qk / pk;
    if (pk < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

/** Signed area by the shoelace formula. Positive when the ring turns counterclockwise with y up. */
export function signedArea(r: Ring): number {
  const n = r.length >> 1;
  let s = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    s += r[2 * j]! * r[2 * i + 1]! - r[2 * i]! * r[2 * j + 1]!;
  }
  return s / 2;
}

/**
 * A ring cut to a box (Sutherland-Hodgman). Each ring is cut on its own,
 * which keeps the area right for outer rings and holes alike: the clipped
 * area of a parcel is the sum of its clipped rings' signed areas. A concave
 * ring may come out with zero-width spurs along the box edge; they add no
 * area.
 */
export function clipRing(r: Ring, box: Box): number[] {
  let pts: number[] = [...r];
  const edges: [axis: 0 | 1, value: number, keepAbove: boolean][] = [
    [0, box[0], true],
    [0, box[2], false],
    [1, box[1], true],
    [1, box[3], false],
  ];
  for (const [axis, value, keepAbove] of edges) {
    const n = pts.length >> 1;
    if (n === 0) break;
    const out: number[] = [];
    const isIn = (i: number) => (keepAbove ? pts[2 * i + axis]! >= value : pts[2 * i + axis]! <= value);
    for (let i = 0; i < n; i++) {
      const j = (i + n - 1) % n;
      const inI = isIn(i);
      const inJ = isIn(j);
      if (inI !== inJ) {
        const xj = pts[2 * j]!;
        const yj = pts[2 * j + 1]!;
        const xi = pts[2 * i]!;
        const yi = pts[2 * i + 1]!;
        const cj = axis === 0 ? xj : yj;
        const ci = axis === 0 ? xi : yi;
        const t = (value - cj) / (ci - cj);
        out.push(xj + (xi - xj) * t, yj + (yi - yj) * t);
        if (axis === 0) out[out.length - 2] = value;
        else out[out.length - 1] = value;
      }
      if (inI) out.push(pts[2 * i]!, pts[2 * i + 1]!);
    }
    pts = out;
  }
  return pts;
}

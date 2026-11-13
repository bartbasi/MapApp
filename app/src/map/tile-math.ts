// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Web Mercator tile arithmetic, z/x/y scheme.

/** West, south, east, north in degrees. */
export type Bounds = [number, number, number, number];

function tileLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** The area a tile covers. */
export function tileBounds(z: number, x: number, y: number): Bounds {
  return [tileLon(x, z), tileLat(y + 1, z), tileLon(x + 1, z), tileLat(y, z)];
}

/** True if two areas overlap. Touching edges count as not overlapping. */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** The smallest area holding all of the given areas, or null for none. */
export function unionBounds(list: readonly Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  const out: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const b of list) {
    out[0] = Math.min(out[0], b[0]);
    out[1] = Math.min(out[1], b[1]);
    out[2] = Math.max(out[2], b[2]);
    out[3] = Math.max(out[3], b[3]);
  }
  return out;
}

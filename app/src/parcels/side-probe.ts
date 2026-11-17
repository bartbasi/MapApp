// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The side test shared by the readout (parcel-scene.ts) and the parcel
// outline (parcel-outline.ts): which parcels lie a hand's breadth to each
// side of a piece of outline. A piece with the same parcels on both sides is
// not a property line (a tile clip edge or a seam).

/** How far to each side of a line the parcels are looked up, in meters. */
export const SIDE_PROBE_M = 0.02;

export interface SideProbes {
  /** SIDE_PROBE_M to the left of A to B (with x east and y north). */
  left: [number, number];
  /** SIDE_PROBE_M to the right. */
  right: [number, number];
}

/** The two probe points beside segment A to B at the point (px, py) on it, in local meters. Null for a segment of no length. */
export function sideProbes(ax: number, ay: number, bx: number, by: number, px: number, py: number): SideProbes | null {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const nx = (-dy / len) * SIDE_PROBE_M;
  const ny = (dx / len) * SIDE_PROBE_M;
  return { left: [px + nx, py + ny], right: [px - nx, py - ny] };
}

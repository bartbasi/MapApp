// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Keeping a tapped spot in view when a panel opens: a bottom sheet over the
// map, or a side panel that makes the map narrower.

/**
 * How far to move the map up so a point covered by a bottom sheet comes into
 * view: the pixels to pan by, or 0 when the point is already well inside the
 * visible part. The point then sits in the middle of the part above the sheet.
 * The same sum works sideways: pass the x position, the width and 0 covered.
 */
export function revealOffset(pointY: number, viewHeight: number, coveredBottom: number): number {
  const visible = Math.max(0, viewHeight - coveredBottom);
  if (visible === 0) return 0;
  const margin = Math.min(64, visible / 4);
  if (pointY >= margin && pointY <= visible - margin) return 0;
  return Math.round(pointY - visible / 2);
}

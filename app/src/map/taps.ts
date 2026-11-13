// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Telling a single tap on the map from a double tap, and how far from a
// fingertip a tapped site may be.

/** Two taps within this time and distance are a double tap, which zooms the map. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 40;

/** A site this close to the tapped point counts as tapped. About a fingertip. */
export const TAP_REACH_PX = 14;

export interface Tap {
  /** Milliseconds, from any steady clock. */
  time: number;
  x: number;
  y: number;
}

/** Whether a tap is the second tap of a double tap. */
export function isSecondTap(previous: Tap | null, tap: Tap): boolean {
  if (!previous) return false;
  if (tap.time - previous.time > DOUBLE_TAP_MS) return false;
  return Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_PX;
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Telling a single tap on the map from a double tap, and how far from a
// fingertip a tapped site may be.

/**
 * Two taps within this time and distance are a double tap, which zooms the
 * map. The numbers are the map engine's own (MapLibre's tap recognizer: 500 ms
 * and 30 px), so the app and the engine agree on what a double tap is. The
 * cost is that a site's panel opens half a second after the tap.
 */
export const DOUBLE_TAP_MS = 500;
export const DOUBLE_TAP_PX = 30;

/**
 * How far from the tapped point a site may be and still count as tapped, in
 * CSS pixels, tried nearest first. The last is about the half width of a
 * fingertip (22 px is 3.5 mm).
 */
export const TAP_REACH_STEPS_PX = [6, 12, 22] as const;

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

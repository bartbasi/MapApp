// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Which way the phone points. Standing still, the compass says; walking or
// driving, the GPS direction of travel is steadier than a compass held in a
// moving hand. With neither, no heading is shown: no wedge beats a wrong one.

import { normalizeDeg, turnDeg } from './geo';

/** Above this ground speed the direction of travel wins over the compass. */
export const COURSE_MIN_SPEED_MPS = 1;
/** A compass reading older than this is treated as missing. */
export const COMPASS_MAX_AGE_MS = 3000;

export type HeadingSource = 'compass' | 'course';

export interface Heading {
  deg: number;
  source: HeadingSource;
}

export interface HeadingInputs {
  /** The latest compass heading, or null if the phone has no compass or it has not reported. */
  compassDeg: number | null;
  compassAgeMs: number | null;
  /** The GPS direction of travel from the latest fix. */
  courseDeg: number | null;
  speedMps: number | null;
}

/** Picks the heading to show, or null for none. */
export function chooseHeading(i: HeadingInputs): Heading | null {
  const moving = i.speedMps !== null && i.speedMps >= COURSE_MIN_SPEED_MPS;
  if (moving && i.courseDeg !== null) return { deg: normalizeDeg(i.courseDeg), source: 'course' };
  const compassFresh = i.compassDeg !== null && i.compassAgeMs !== null && i.compassAgeMs <= COMPASS_MAX_AGE_MS;
  if (compassFresh) return { deg: normalizeDeg(i.compassDeg!), source: 'compass' };
  // A course reported while standing still is noise (Android reports 0), so it is not used.
  return null;
}

/** How far each new reading moves the shown heading: light for the jittery compass, near full for the GPS course. */
export const SMOOTHING: Record<HeadingSource, number> = { compass: 0.25, course: 0.8 };

/**
 * Moves the shown heading part of the way to a new reading, the short way
 * round (350 to 10 passes through north, not through south).
 */
export function smoothHeading(prev: Heading | null, next: Heading | null): Heading | null {
  if (!next) return null;
  if (!prev || prev.source !== next.source) return next;
  const k = SMOOTHING[next.source];
  return { deg: normalizeDeg(prev.deg + k * turnDeg(prev.deg, next.deg)), source: next.source };
}

/**
 * The compass heading of the top of the screen from a deviceorientationabsolute
 * reading. `alpha` turns counterclockwise from north; the screen angle is how
 * far the screen is turned from the phone's natural portrait.
 */
export function compassFromOrientation(alpha: number, screenAngle: number): number {
  return normalizeDeg(360 - alpha + screenAngle);
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Builds a walked route for the replay source: a reading every second along
// straight legs at walking pace. Used in development to see the marker move
// without going outdoors, and by the tests.

import { bearingDeg, destination, distanceM } from './geo';
import type { ReplayPoint } from './replay-source';

export interface RouteOptions {
  /** Walking speed in meters per second. Default 1.4. */
  speedMps?: number;
  /** Seconds between readings. Default 1. */
  stepS?: number;
  /** Accuracy for every reading, or a function of the reading's index. Default a gentle 4 to 7 m. */
  accuracyM?: number | ((i: number) => number);
  /** Seconds to stand still at the end, still reporting. Default 0. */
  pauseAtEndS?: number;
}

/** Readings along the legs between the given corners ([lng, lat] pairs). */
export function walkRoute(corners: readonly [number, number][], options: RouteOptions = {}): ReplayPoint[] {
  const speed = options.speedMps ?? 1.4;
  const step = options.stepS ?? 1;
  const acc = options.accuracyM ?? ((i: number) => 5.5 + 1.5 * Math.sin(i / 7));
  const accuracyAt = (i: number) => (typeof acc === 'number' ? acc : acc(i));
  const out: ReplayPoint[] = [];
  const first = corners[0];
  if (!first) return out;
  let i = 0;
  const push = (lng: number, lat: number) => {
    out.push({ lng, lat, atMs: i * step * 1000, accuracyM: Math.round(accuracyAt(i) * 10) / 10 });
    i++;
  };
  push(first[0], first[1]);
  for (let c = 1; c < corners.length; c++) {
    const [lng0, lat0] = corners[c - 1]!;
    const [lng1, lat1] = corners[c]!;
    const length = distanceM(lng0, lat0, lng1, lat1);
    const dir = bearingDeg(lng0, lat0, lng1, lat1);
    const n = Math.max(1, Math.round(length / (speed * step)));
    for (let k = 1; k <= n; k++) {
      const [lng, lat] = destination(lng0, lat0, (length * k) / n, dir);
      push(lng, lat);
    }
  }
  const last = out[out.length - 1]!;
  for (let s = 0; s < (options.pauseAtEndS ?? 0) / step; s++) {
    out.push({ lng: last.lng, lat: last.lat, atMs: i * step * 1000, accuracyM: Math.round(accuracyAt(i) * 10) / 10, speedMps: 0, headingDeg: null });
    i++;
  }
  return out;
}

/**
 * A short walk on the south side of Urbana, Illinois: north, east, then
 * south-east, about 400 m in five minutes, then a short stand still.
 */
export const URBANA_CORNERS: [number, number][] = [
  [-88.2005, 40.0995],
  [-88.2005, 40.1012],
  [-88.198, 40.1012],
  [-88.1962, 40.1001],
];

export function urbanaWalk(options: RouteOptions = {}): ReplayPoint[] {
  return walkRoute(URBANA_CORNERS, { pauseAtEndS: 5, ...options });
}

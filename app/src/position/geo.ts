// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Ground distances and directions on a sphere of the Earth's mean radius.
// Good to a fraction of a percent at the distances the position marker uses.

import type { Polygon } from 'geojson';

/** The Earth's mean radius in meters (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in meters between two points. */
export function distanceM(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial direction from the first point to the second, degrees clockwise from north, 0 to 360. */
export function bearingDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return normalizeDeg(deg(Math.atan2(y, x)));
}

/** The point a distance away in a direction (degrees clockwise from north). */
export function destination(lng: number, lat: number, distance: number, bearing: number): [number, number] {
  const d = distance / EARTH_RADIUS_M;
  const t = rad(bearing);
  const p1 = rad(lat);
  const l1 = rad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(l2), deg(p2)];
}

/**
 * A circle of a true ground radius around a point, as a closed polygon. A
 * circle drawn in screen pixels would be the wrong size at any latitude but
 * one; this one is measured on the ground, so it stays true at every zoom.
 */
export function groundCircle(lng: number, lat: number, radiusM: number, steps = 64): Polygon {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) ring.push(destination(lng, lat, radiusM, (360 * i) / steps));
  ring.push(ring[0]!);
  return { type: 'Polygon', coordinates: [ring] };
}

/** An angle folded into 0 (inclusive) to 360 (exclusive). */
export function normalizeDeg(d: number): number {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/** The signed smallest turn from one direction to another, -180 to 180. */
export function turnDeg(from: number, to: number): number {
  const d = normalizeDeg(to - from);
  return d > 180 ? d - 360 : d;
}

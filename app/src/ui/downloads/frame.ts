// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The area picker's frame. The frame stays still on the screen and the user
// moves the map under it, with one finger, so there are no corner handles to
// hit with a glove. These are the sums behind it: where the frame sits in the
// part of the map that shows, and which rectangle on the ground it holds.

import type { Bounds } from '../../map/tile-math';

/** A rectangle on the screen, in CSS pixels from the map's top left corner. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How much of the map's edges is covered by controls or a sheet. */
export interface Covered {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Space between the frame and whatever covers the map, so the frame's edge shows clearly. */
export const FRAME_MARGIN = 20;
/** The frame never gets smaller than this on either side. */
export const FRAME_MIN = 120;

/**
 * The frame: the part of the map that shows, less a margin. When the map is
 * too small for that (a short sheet over a short screen), the frame keeps its
 * smallest size and is centered in what shows.
 */
export function frameRect(width: number, height: number, covered: Covered, margin = FRAME_MARGIN): ScreenRect {
  const axis = (size: number, start: number, end: number): [number, number] => {
    const a = start + margin;
    const b = size - end - margin;
    if (b - a >= FRAME_MIN) return [a, b];
    const mid = Math.min(Math.max((start + size - end) / 2, FRAME_MIN / 2), size - FRAME_MIN / 2);
    return [mid - FRAME_MIN / 2, mid + FRAME_MIN / 2];
  };
  const [left, right] = axis(width, covered.left, covered.right);
  const [top, bottom] = axis(height, covered.top, covered.bottom);
  return { left, top, right, bottom };
}

/** The frame's corners, clockwise from the top left. */
export function frameCorners(r: ScreenRect): [number, number][] {
  return [
    [r.left, r.top],
    [r.right, r.top],
    [r.right, r.bottom],
    [r.left, r.bottom],
  ];
}

/**
 * The rectangle on the ground that holds the frame: the smallest west, south,
 * east, north box around the four corners as the map places them. With the
 * map turned, that box is a little larger than the frame; the picker turns the
 * map north up so the two match.
 */
export function boundsOfPoints(points: readonly { lng: number; lat: number }[]): Bounds | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) return null;
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  // Kept to the part of the world a map can show, as the service checks.
  return [Math.max(w, -180), Math.max(s, -85), Math.min(e, 180), Math.min(n, 85)];
}

/** Bounds rounded to about a meter, so a map that has not really moved does not ask for a new size. */
export function roundBounds(b: Bounds): Bounds {
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  return [r(b[0]), r(b[1]), r(b[2]), r(b[3])];
}

export function sameBounds(a: Bounds | null, b: Bounds | null): boolean {
  if (!a || !b) return a === b;
  return a.every((v, i) => v === b[i]);
}

const EARTH_KM_PER_DEG_LAT = 110.574;
const EARTH_KM_PER_DEG_LNG_EQUATOR = 111.32;

/** Width (west to east, at the middle latitude) and height of a rectangle on the ground, in km. */
export function boundsSizeKm(b: Bounds): { widthKm: number; heightKm: number } {
  const midLat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  return {
    widthKm: Math.abs(b[2] - b[0]) * EARTH_KM_PER_DEG_LNG_EQUATOR * Math.cos(midLat),
    heightKm: Math.abs(b[3] - b[1]) * EARTH_KM_PER_DEG_LAT,
  };
}

export function boundsCenter(b: Bounds): { lng: number; lat: number } {
  return { lng: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 };
}

export function contains(b: Bounds, p: { lng: number; lat: number }): boolean {
  return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3];
}

/**
 * A name for a new area: "Macon County area 2", after the county its middle
 * is in, numbered past the areas that already have that kind of name.
 */
export function suggestName(center: { lng: number; lat: number }, counties: readonly { countyName: string; bounds: Bounds }[], existing: readonly string[]): string {
  const county = counties.find((c) => contains(c.bounds, center));
  const stem = county ? `${county.countyName.replace(/, Illinois$/, '')} area` : 'Area';
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) {
    const name = `${stem} ${i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

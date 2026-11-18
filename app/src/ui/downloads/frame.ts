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

/** True when two rectangles share some ground. */
export function overlaps(a: Bounds, b: Bounds): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/**
 * A name for a new area, numbered past the areas that already have that kind
 * of name: "Macon County area 2" for an area in one county, "Champaign and
 * Macon area 1" for one that reaches into both, "Area 3" for one in neither.
 */
export function suggestName(area: Bounds, counties: readonly { countyName: string; bounds: Bounds }[], existing: readonly string[]): string {
  const touched = counties.filter((c) => overlaps(c.bounds, area)).map((c) => c.countyName.replace(/, Illinois$/, ''));
  const short = touched.map((n) => n.replace(/ County$/, '')).sort();
  const stem =
    touched.length === 1 ? `${touched[0]} area` : touched.length > 1 ? `${short.slice(0, -1).join(', ')} and ${short[short.length - 1]} area` : 'Area';
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) {
    const name = `${stem} ${i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

// ---------------------------------------------------------------- keeping clear of the position marker

/** Meters on the ground per CSS pixel at a latitude and map zoom (MapLibre's 512 pixel world at zoom 0). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** The hole is never smaller than this radius, which clears the dot and its white edge. */
export const MARKER_HOLE_MIN = 16;
/** Space between the marker (or its accuracy circle) and the frame's dimming and lines. */
export const MARKER_HOLE_MARGIN = 8;
/** A very poor fix would open a hole bigger than the frame; past this the circle's edge may run under the dimming. */
export const MARKER_HOLE_MAX = 180;

/**
 * The circle the frame leaves clear around the phone's position, so the
 * dimming and the frame's lines never cover the dot or its accuracy circle
 * (D26). Null when there is no position.
 */
export function markerHole(at: { x: number; y: number } | null, accuracyPx: number): { x: number; y: number; r: number } | null {
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
  const acc = Number.isFinite(accuracyPx) && accuracyPx > 0 ? accuracyPx : 0;
  return { x: at.x, y: at.y, r: Math.min(Math.max(acc, MARKER_HOLE_MIN), MARKER_HOLE_MAX) + MARKER_HOLE_MARGIN };
}

/** True when a circle and a screen rectangle overlap, for keeping the frame's words off the marker. */
export function circleMeetsRect(c: { x: number; y: number; r: number }, r: ScreenRect): boolean {
  const nx = Math.min(Math.max(c.x, r.left), r.right);
  const ny = Math.min(Math.max(c.y, r.top), r.bottom);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r ** 2;
}

// ---------------------------------------------------------------- Bigger area and Smaller area

/** The closest and farthest the picker's buttons go: about 300 m and about 160 km across the folded frame. */
export const FRAME_ZOOM_MIN = 8;
export const FRAME_ZOOM_MAX = 17;

/**
 * The zoom one tap of Bigger area (-1) or Smaller area (+1) goes to: exactly
 * one step from where the last tap was going, so each tap doubles or halves
 * the width of the ground in the frame, however fast the taps come and
 * whatever the zoom was.
 */
export function steppedZoom(current: number, pending: number | null, direction: 1 | -1): number {
  const base = pending ?? current;
  return Math.min(FRAME_ZOOM_MAX, Math.max(FRAME_ZOOM_MIN, base + direction));
}

/**
 * How a card at the top of the map shows, so it never covers the position
 * marker (D26): whole; as a small pill when the whole card would cover the
 * marker; not at all when even the pill would. Rects are in the map's own
 * pixels; a rect not measured yet counts as clear.
 */
export function cardMode(hole: { x: number; y: number; r: number } | null, full: ScreenRect | null, pill: ScreenRect | null): 'full' | 'pill' | 'hidden' {
  if (!hole || !full || !circleMeetsRect(hole, full)) return 'full';
  if (!pill || !circleMeetsRect(hole, pill)) return 'pill';
  return 'hidden';
}

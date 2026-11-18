// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { Bounds } from '../../map/tile-math';
import { cardMode, FRAME_MARGIN, FRAME_MIN, FRAME_ZOOM_MAX, FRAME_ZOOM_MIN, steppedZoom, MARKER_HOLE_MARGIN, MARKER_HOLE_MAX, MARKER_HOLE_MIN, boundsOfPoints, circleMeetsRect, markerHole, metersPerPixel, boundsSizeKm, frameCorners, frameRect, roundBounds, sameBounds, suggestName } from './frame';

describe('frameRect', () => {
  it('fills what shows of the map, less a margin', () => {
    // Folded: 344 wide, the top controls take 84 px and a sheet 300 px.
    const r = frameRect(344, 882, { top: 84, bottom: 300, left: 0, right: 0 });
    expect(r).toEqual({ left: FRAME_MARGIN, top: 84 + FRAME_MARGIN, right: 344 - FRAME_MARGIN, bottom: 882 - 300 - FRAME_MARGIN });
  });

  it('keeps its smallest size, centered in what shows, when there is too little room', () => {
    const r = frameRect(344, 400, { top: 84, bottom: 280, left: 0, right: 0 });
    expect(r.bottom - r.top).toBe(FRAME_MIN);
    expect((r.top + r.bottom) / 2).toBeCloseTo((84 + 400 - 280) / 2);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });

  it('stays on the map when the covered parts leave nothing', () => {
    const r = frameRect(200, 200, { top: 150, bottom: 150, left: 0, right: 0 });
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(200);
    expect(r.bottom - r.top).toBe(FRAME_MIN);
  });

  it('lists the corners clockwise from the top left', () => {
    expect(frameCorners({ left: 1, top: 2, right: 3, bottom: 4 })).toEqual([
      [1, 2],
      [3, 2],
      [3, 4],
      [1, 4],
    ]);
  });
});

describe('boundsOfPoints', () => {
  it('is the box around the corners, also when the map is turned', () => {
    // A frame on a map turned 30 degrees: the corners are no longer square to north.
    const pts = [
      { lng: -89.1, lat: 39.95 },
      { lng: -89.0, lat: 39.97 },
      { lng: -88.98, lat: 39.9 },
      { lng: -89.08, lat: 39.88 },
    ];
    expect(boundsOfPoints(pts)).toEqual([-89.1, 39.88, -88.98, 39.97]);
  });

  it('keeps to the part of the world a map shows', () => {
    expect(boundsOfPoints([{ lng: -200, lat: -89 }, { lng: 190, lat: 89 }])).toEqual([-180, -85, 180, 85]);
  });

  it('gives null for no points or a bad one', () => {
    expect(boundsOfPoints([])).toBeNull();
    expect(boundsOfPoints([{ lng: Number.NaN, lat: 1 }])).toBeNull();
  });
});

describe('rounding and sizes', () => {
  it('rounds to about a meter, so a still map asks once', () => {
    const a = roundBounds([-89.0600001, 39.9300004, -88.98, 39.95]);
    const b = roundBounds([-89.0600004, 39.9300001, -88.98, 39.95]);
    expect(sameBounds(a, b)).toBe(true);
    expect(sameBounds(a, null)).toBe(false);
    expect(sameBounds(null, null)).toBe(true);
  });

  it('measures a 10 km box in Macon County', () => {
    // 10 km is 0.0904 degrees of latitude, and 0.1173 degrees of longitude at 39.9 N.
    const b: Bounds = [-89.1, 39.85, -88.9827, 39.9404];
    const { widthKm, heightKm } = boundsSizeKm(b);
    expect(widthKm).toBeCloseTo(10, 0);
    expect(heightKm).toBeCloseTo(10, 0);
  });
});

describe('suggestName', () => {
  const counties = [
    { countyName: 'Macon County', bounds: [-89.2179, 39.6526, -88.745, 40.0554] as Bounds },
    { countyName: 'Champaign County, Illinois', bounds: [-88.4637, 39.879, -87.9287, 40.4007] as Bounds },
  ];

  const box = (lng: number, lat: number): Bounds => [lng - 0.02, lat - 0.02, lng + 0.02, lat + 0.02];

  it('names an area after its county and numbers it past the names taken', () => {
    expect(suggestName(box(-89.0, 39.9), counties, [])).toBe('Macon County area 1');
    expect(suggestName(box(-89.0, 39.9), counties, ['Macon County area 1', 'macon county area 2'])).toBe('Macon County area 3');
    expect(suggestName(box(-88.2, 40.1), counties, [])).toBe('Champaign County area 1');
  });

  it('names an area reaching into both counties after both (tester F9)', () => {
    expect(suggestName([-89.5, 39.5, -87.5, 40.6], counties, [])).toBe('Champaign and Macon area 1');
  });

  it('falls back to "Area" outside the counties', () => {
    expect(suggestName(box(-90, 41), counties, ['Area 1'])).toBe('Area 2');
  });
});

describe('the clear circle around the position marker', () => {
  it('clears the accuracy circle with a margin, and at least the dot', () => {
    expect(markerHole({ x: 100, y: 200 }, 40)).toEqual({ x: 100, y: 200, r: 40 + MARKER_HOLE_MARGIN });
    expect(markerHole({ x: 100, y: 200 }, 2)).toEqual({ x: 100, y: 200, r: MARKER_HOLE_MIN + MARKER_HOLE_MARGIN });
    expect(markerHole({ x: 100, y: 200 }, Number.NaN)!.r).toBe(MARKER_HOLE_MIN + MARKER_HOLE_MARGIN);
    expect(markerHole({ x: 100, y: 200 }, 5000)!.r).toBe(MARKER_HOLE_MAX + MARKER_HOLE_MARGIN);
    expect(markerHole(null, 10)).toBeNull();
  });

  it('turns meters into pixels as the map does', () => {
    // At the equator, zoom 0 shows 40,075 km across 512 px.
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.5, 0);
    // At 40 N and zoom 16 one pixel is about 0.9 m, so a 10 m accuracy circle is about 11 px.
    expect(10 / metersPerPixel(40, 16)).toBeCloseTo(10.9, 0);
  });

  it('knows when the circle reaches the frame words', () => {
    const tag = { left: 20, top: 100, right: 300, bottom: 148 };
    expect(circleMeetsRect({ x: 150, y: 160, r: 20 }, tag)).toBe(true);
    expect(circleMeetsRect({ x: 150, y: 200, r: 20 }, tag)).toBe(false);
  });
});

describe('steppedZoom', () => {
  it('moves exactly one step from where the last tap was going (tester F9)', () => {
    expect(steppedZoom(12.6, null, -1)).toBeCloseTo(11.6);
    // A second quick tap, while the map is still moving at 12.1: from the target, not from 12.1.
    expect(steppedZoom(12.1, 11.6, -1)).toBeCloseTo(10.6);
    expect(steppedZoom(12.6, null, 1)).toBeCloseTo(13.6);
  });

  it('stops at its nearest and farthest', () => {
    expect(steppedZoom(FRAME_ZOOM_MIN + 0.3, null, -1)).toBe(FRAME_ZOOM_MIN);
    expect(steppedZoom(FRAME_ZOOM_MAX, null, 1)).toBe(FRAME_ZOOM_MAX);
  });
});

describe('cardMode', () => {
  const full = { left: 12, top: 80, right: 392, bottom: 285 };
  const pill = { left: 12, top: 80, right: 220, bottom: 128 };
  it('shows the whole card unless it would cover the marker', () => {
    expect(cardMode(null, full, pill)).toBe('full');
    expect(cardMode({ x: 500, y: 400, r: 24 }, full, pill)).toBe('full');
    expect(cardMode({ x: 380, y: 200, r: 24 }, full, null)).toBe('pill');
    expect(cardMode({ x: 380, y: 200, r: 24 }, full, pill)).toBe('pill');
    expect(cardMode({ x: 100, y: 100, r: 24 }, full, pill)).toBe('hidden');
  });
});

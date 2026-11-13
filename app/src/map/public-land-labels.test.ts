// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import type { Polygon, Position } from 'geojson';
import { describe, expect, it } from 'vitest';
import { insidePoly, interiorPoint, publicLandLabelPoints, type LabelSource } from './public-land-labels';
import { revealOffset } from './reveal';

const square = (x: number, y: number, size: number): Position[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

function site(name: string, manager: string, rings: Position[][], category = 'state'): LabelSource {
  const geometry: Polygon = { type: 'Polygon', coordinates: rings };
  return { properties: { name, manager, category }, geometry };
}

describe('publicLandLabelPoints', () => {
  it('gives one point per site, however many tiles cut it into pieces', () => {
    // The same site in three tiles: three clipped pieces.
    const pieces = [
      site('Lake of the Woods', 'CCFPD', [square(0, 0, 0.01)]),
      site('Lake of the Woods', 'CCFPD', [square(0.01, 0, 0.03)]),
      site('Lake of the Woods', 'CCFPD', [square(0.04, 0, 0.005)]),
      site('Other', 'X', [square(1, 1, 0.01)]),
    ];
    const out = publicLandLabelPoints(pieces);
    expect(out.features.map((f) => f.properties?.['name'])).toEqual(['Lake of the Woods', 'Other']);
  });

  it('puts the point inside the largest piece', () => {
    const big = square(0.01, 0, 0.03);
    const out = publicLandLabelPoints([site('A', 'M', [square(0, 0, 0.01)]), site('A', 'M', [big])]);
    const p = out.features[0]!.geometry.coordinates;
    expect(insidePoly(p, [big])).toBe(true);
  });

  it('keeps sites with the same name but different managers apart', () => {
    const out = publicLandLabelPoints([site('City Park', 'Village A', [square(0, 0, 1)]), site('City Park', 'Village B', [square(5, 5, 1)])]);
    expect(out.features).toHaveLength(2);
  });

  it('skips shapes with no name and carries the category for the label color', () => {
    const out = publicLandLabelPoints([site('', 'M', [square(0, 0, 1)]), site('Named', 'M', [square(0, 0, 1)], 'ngo')]);
    expect(out.features).toHaveLength(1);
    expect(out.features[0]!.properties).toEqual({ name: 'Named', manager: 'M', category: 'ngo', access: 'unknown', acres: 0 });
  });

  it('carries access, so a closed site can say so under its name', () => {
    const closed: LabelSource = { properties: { name: 'Shut', manager: 'M', category: 'state', access: 'closed' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 1)] } };
    expect(publicLandLabelPoints([closed]).features[0]!.properties?.['access']).toBe('closed');
  });

  it('keeps the name on screen when only part of a large site is in view', () => {
    // A site 10 wide and 2 tall. The view shows only its right end.
    const wide: LabelSource = site('Long Site', 'M', [
      [
        [0, 0],
        [10, 0],
        [10, 2],
        [0, 2],
        [0, 0],
      ],
    ]);
    const [x, y] = publicLandLabelPoints([wide], [8, -5, 20, 5]).features[0]!.geometry.coordinates;
    expect(x).toBeGreaterThan(8);
    expect(x).toBeLessThan(10);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(2);
  });

  it('prefers the piece that is on screen over a larger piece that is not', () => {
    const big = square(0, 0, 4);
    const small = square(10, 0, 1);
    const out = publicLandLabelPoints([site('A', 'M', [big]), site('A', 'M', [small])], [9, -1, 12, 2]);
    expect(out.features).toHaveLength(1);
    expect(out.features[0]!.geometry.coordinates[0]).toBeGreaterThan(9);
  });

  it('falls back to the largest piece when the site is off screen', () => {
    const out = publicLandLabelPoints([site('A', 'M', [square(0, 0, 1)])], [50, 50, 60, 60]);
    expect(out.features).toHaveLength(1);
    const [x, y] = out.features[0]!.geometry.coordinates;
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it('handles multipolygons', () => {
    const out = publicLandLabelPoints([
      { properties: { name: 'M', manager: '' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 0.1)], [square(3, 3, 1)]] } },
    ]);
    expect(insidePoly(out.features[0]!.geometry.coordinates, [square(3, 3, 1)])).toBe(true);
  });
});

describe('interiorPoint', () => {
  it('lands inside a C-shaped polygon whose center is outside it', () => {
    const c: Position[] = [
      [0, 0],
      [3, 0],
      [3, 1],
      [1, 1],
      [1, 2],
      [3, 2],
      [3, 3],
      [0, 3],
      [0, 0],
    ];
    expect(insidePoly([1.5, 1.5], [c])).toBe(false);
    expect(insidePoly(interiorPoint([c]), [c])).toBe(true);
  });

  it('avoids a hole', () => {
    const poly = [square(0, 0, 4), square(1, 1, 2)];
    expect(insidePoly(interiorPoint(poly), poly)).toBe(true);
  });
});

describe('revealOffset', () => {
  it('does nothing when the tapped point is already above the sheet', () => {
    expect(revealOffset(200, 800, 400)).toBe(0);
  });

  it('moves a point under the sheet to the middle of the visible part', () => {
    // 800 tall, sheet covers 500: visible 300, middle 150. Point at 600 moves up by 450.
    expect(revealOffset(600, 800, 500)).toBe(450);
  });

  it('moves a point just above the sheet edge into clear view', () => {
    expect(revealOffset(395, 800, 400)).toBe(195);
  });

  it('does nothing with no sheet room at all', () => {
    expect(revealOffset(500, 800, 800)).toBe(0);
  });
});

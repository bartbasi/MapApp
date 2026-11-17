// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import type { Position } from 'geojson';
import { describe, expect, it } from 'vitest';
import { StoredParcelSource } from './stored-parcel-source';
import { M_PER_DEG_LAT, M_PER_DEG_LNG, SynthWorld, rect, type MeterParcel } from './test-tiles';

const world = new SynthWorld();
const E = world.edges();

function toMeters(p: Position): [number, number] {
  return [(p[0]! - world.origin.lng) * M_PER_DEG_LNG, (p[1]! - world.origin.lat) * M_PER_DEG_LAT];
}

function lineLength(lines: Position[][]): number {
  let s = 0;
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [ax, ay] = toMeters(l[i - 1]!);
      const [bx, by] = toMeters(l[i]!);
      s += Math.hypot(bx - ax, by - ay);
    }
  }
  return s;
}

function fillArea(polys: Position[][][]): number {
  let s = 0;
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      let a = 0;
      for (let k = 1; k < ring.length; k++) {
        const [x0, y0] = toMeters(ring[k - 1]!);
        const [x1, y1] = toMeters(ring[k]!);
        a += x0 * y1 - x1 * y0;
      }
      s += i === 0 ? Math.abs(a / 2) : -Math.abs(a / 2);
    });
  }
  return s;
}

const p = (pid: string, ...rings: [number, number][][]): MeterParcel => ({ properties: { pid, owner: 'OWNER', county: 'il-test' }, rings });

describe('parcel outline', () => {
  for (const buffer of [80, 0]) {
    it(`assembles a parcel across a tile edge without the clip edges, buffer ${buffer}`, async () => {
      const src = new StoredParcelSource([world.archive([p('P', rect(E.east - 60, -40, E.east + 60, 40))], { buffer })]);
      const o = (await src.outline('P', 'il-test', world.at(E.east - 10, 0)))!;
      expect(o.record.pid).toBe('P');
      expect(o.complete).toBe(true);
      expect(o.tilesRead).toBeGreaterThanOrEqual(2);
      // Perimeter 2 x 120 + 2 x 80, area 120 x 80.
      expect(Math.abs(lineLength(o.lines.coordinates) - 400)).toBeLessThan(1);
      expect(Math.abs(fillArea(o.fill.coordinates) - 9600) / 9600).toBeLessThan(0.005);
      // Nothing runs along the tile edge.
      for (const l of o.lines.coordinates) {
        for (const pt of l) {
          const [x, y] = toMeters(pt);
          if (Math.abs(x - E.east) < 0.2) expect(Math.abs(Math.abs(y) - 40)).toBeLessThan(0.2);
        }
      }
    });
  }

  it('removes the seam between features with the same ID and keeps a hole', async () => {
    const src = new StoredParcelSource([
      world.archive([p('S', rect(-50, -50, 0, 50), rect(-30, -10, -10, 10).reverse()), p('S', rect(0, -50, 50, 50)), p('T', rect(50, -50, 150, 50))]),
    ]);
    const o = (await src.outline('S', 'il-test', world.at(10, 0)))!;
    expect(Math.abs(lineLength(o.lines.coordinates) - (400 + 80))).toBeLessThan(1);
    expect(Math.abs(fillArea(o.fill.coordinates) - (10000 - 400))).toBeLessThan(20);
    expect(o.tilesRead).toBe(1);
  });

  it('returns null when the parcel is not at the point, and stops at the tile limit', async () => {
    const src = new StoredParcelSource([world.archive([p('BIG', rect(-1000, -1000, 1000, 1000))])]);
    expect(await src.outline('NOPE', 'il-test', world.at(0, 0))).toBeNull();
    const o = (await src.outline('BIG', 'il-test', world.at(0, 0), { maxTiles: 4 }))!;
    expect(o.complete).toBe(false);
    expect(o.tilesRead).toBe(4);
  });
});

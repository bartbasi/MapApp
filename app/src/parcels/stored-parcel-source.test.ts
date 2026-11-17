// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it, vi } from 'vitest';
import type { PositionQuery } from './parcel-source';
import type { OpenArchive } from '../map/archives';
import { StoredParcelSource, parcelArchivesFrom } from './stored-parcel-source';
import { M_PER_DEG_LAT, M_PER_DEG_LNG, SynthWorld, fakeArchive, rect, type MeterParcel } from './test-tiles';
import { tileKey } from './tile-coords';

const world = new SynthWorld();
const E = world.edges();

/** Meters between two points, by the published degree lengths. */
function metersBetween(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  return Math.hypot((a.lng - b.lng) * M_PER_DEG_LNG, (a.lat - b.lat) * M_PER_DEG_LAT);
}

function parcel(pid: string, ...rings: [number, number][][]): MeterParcel {
  return { properties: { pid, owner: `OWNER ${pid}`, acres: 1, county: 'il-test' }, rings };
}

const pids = (list: readonly { pid: string }[] | null | undefined) => (list ? list.map((p) => p.pid) : null);

/** A 3 by 3 grid of 100 m squares centred on the origin. G-r-c, row 0 south, column 0 west. */
const grid: MeterParcel[] = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) grid.push(parcel(`G-${r}-${c}`, rect(-150 + 100 * c, -150 + 100 * r, -50 + 100 * c, -50 + 100 * r)));
}

async function query(parcels: MeterParcel[], east: number, north: number, opts: { buffer?: number } = {}): Promise<PositionQuery> {
  const src = new StoredParcelSource([world.archive(parcels, opts)]);
  return src.positionQuery(world.at(east, north));
}

describe('the test world', () => {
  it('has a zoom 16 tile about 468 m wide around the origin', () => {
    expect(E.east - E.west).toBeGreaterThan(460);
    expect(E.east - E.west).toBeLessThan(476);
    expect(E.north).toBeGreaterThan(200);
  });
});

describe('square parcel grid', () => {
  it('finds the parcel and the nearest line to the east', async () => {
    const q = await query(grid, 20, -10);
    expect(q.coverage).toBe('ok');
    expect(pids(q.inside)).toEqual(['G-1-1']);
    const l = q.nearestLine!;
    expect(l.distanceM).toBeCloseTo(30, 0);
    expect(Math.abs(l.distanceM - 30)).toBeLessThan(0.2);
    expect(Math.abs(l.bearingDeg - 90)).toBeLessThan(0.5);
    expect(metersBetween(l.point, world.at(50, -10))).toBeLessThan(0.2);
    expect(pids(l.thisSide)).toEqual(['G-1-1']);
    expect(pids(l.otherSide)).toEqual(['G-1-2']);
  });

  it('finds a line to the north and one to the south west', async () => {
    const n = await query(grid, -40, 45);
    expect(Math.abs(n.nearestLine!.distanceM - 5)).toBeLessThan(0.2);
    expect(Math.abs(n.nearestLine!.bearingDeg - 0) % 360).toBeLessThan(0.5);
    expect(pids(n.nearestLine!.otherSide)).toEqual(['G-2-1']);

    const sw = await query(grid, -36, -42);
    expect(Math.abs(sw.nearestLine!.distanceM - 8)).toBeLessThan(0.2);
    expect(Math.abs(sw.nearestLine!.bearingDeg - 180)).toBeLessThan(0.5);
    expect(pids(sw.nearestLine!.otherSide)).toEqual(['G-0-1']);
  });

  it('measures to a corner when the corner is nearest', async () => {
    // Outside the grid, beyond its north east corner (150, 150).
    const q = await query(grid, 180, 190);
    expect(q.inside).toBeNull();
    expect(Math.abs(q.nearestLine!.distanceM - 50)).toBeLessThan(0.2);
    expect(Math.abs(q.nearestLine!.bearingDeg - (180 + (Math.atan2(30, 40) * 180) / Math.PI))).toBeLessThan(0.5);
    expect(pids(q.nearestLine!.otherSide)).toEqual(['G-2-2']);
  });

  it('reports a shared boundary once, with the parcels on both sides', async () => {
    const q = await query(grid, 49, 0);
    expect(Math.abs(q.nearestLine!.distanceM - 1)).toBeLessThan(0.2);
    expect(pids(q.nearestLine!.thisSide)).toEqual(['G-1-1']);
    expect(pids(q.nearestLine!.otherSide)).toEqual(['G-1-2']);
  });

  it('reports no line when none lies within the search radius', async () => {
    const big = [parcel('BIG', rect(-1000, -1000, 1000, 1000))];
    const src = new StoredParcelSource([world.archive(big)]);
    const q = await src.positionQuery(world.at(0, 0), { radiusM: 150 });
    expect(pids(q.inside)).toEqual(['BIG']);
    expect(q.nearestLine).toBeNull();
    expect(q.searchRadiusM).toBe(150);
  });
});

describe('holes and parts', () => {
  const donut = parcel('D', rect(-100, -100, 100, 100), rect(-20, -20, 20, 20).reverse());

  it('treats the hole as outside the parcel', async () => {
    const q = await query([donut], 0, 5);
    expect(q.inside).toBeNull();
    expect(Math.abs(q.nearestLine!.distanceM - 15)).toBeLessThan(0.2);
    expect(pids(q.nearestLine!.thisSide)).toEqual([]);
    expect(pids(q.nearestLine!.otherSide)).toEqual(['D']);
  });

  it('measures to the hole edge from inside the parcel', async () => {
    const q = await query([donut], 30, 0);
    expect(pids(q.inside)).toEqual(['D']);
    expect(Math.abs(q.nearestLine!.distanceM - 10)).toBeLessThan(0.2);
    expect(Math.abs(q.nearestLine!.bearingDeg - 270)).toBeLessThan(0.5);
  });

  it('finds the second part of a multipart parcel', async () => {
    const m = parcel('M', rect(-100, -30, -60, 30), rect(60, -30, 100, 30));
    const inPart = await query([m], 80, 0);
    expect(pids(inPart.inside)).toEqual(['M']);
    expect(Math.abs(inPart.nearestLine!.distanceM - 20)).toBeLessThan(0.2);
    const between = await query([m], 0, 0);
    expect(between.inside).toBeNull();
    expect(Math.abs(between.nearestLine!.distanceM - 60)).toBeLessThan(0.2);
  });

  it('ignores the seam between two features with the same parcel ID', async () => {
    const split = [parcel('S', rect(-50, -50, 0, 50)), parcel('S', rect(0, -50, 50, 50))];
    const q = await query(split, -5, 0);
    expect(pids(q.inside)).toEqual(['S']);
    expect(Math.abs(q.nearestLine!.distanceM - 45)).toBeLessThan(0.2);
  });
});

describe('a parcel cut by a tile edge', () => {
  // P spans the centre tile's east edge: 60 m each side of it, 80 m tall.
  // The real nearest line from 10 m either side of the edge is 40 m away
  // (north and south edges). A clip edge would be found at about 1 m or 19 m.
  const spanning = [parcel('P', rect(E.east - 60, -40, E.east + 60, 40))];

  for (const buffer of [80, 0]) {
    it(`ignores clip edges with a ${buffer} unit buffer, from either tile`, async () => {
      for (const east of [E.east - 10, E.east + 10, E.east - 0.5]) {
        const q = await query(spanning, east, 0, { buffer });
        expect(pids(q.inside)).toEqual(['P']);
        expect(Math.abs(q.nearestLine!.distanceM - 40)).toBeLessThan(0.2);
        expect(pids(q.nearestLine!.otherSide)).toEqual([]);
      }
    });

    it(`keeps a real line lying exactly on the tile edge, buffer ${buffer}`, async () => {
      const pair = [parcel('P', rect(E.east - 60, -40, E.east, 40)), parcel('Q', rect(E.east, -40, E.east + 60, 40))];
      const q = await query(pair, E.east - 10, 0, { buffer });
      expect(pids(q.inside)).toEqual(['P']);
      expect(Math.abs(q.nearestLine!.distanceM - 10)).toBeLessThan(0.2);
      expect(pids(q.nearestLine!.thisSide)).toEqual(['P']);
      expect(pids(q.nearestLine!.otherSide)).toEqual(['Q']);
    });
  }

  it('is not misled by a buffer copy that sits a few centimeters off the real line', async () => {
    // A slanted edge crossing the tile edge: where the tiler cuts it at the
    // buffer line it rounds the new corner, so the neighbour's buffer copy of
    // the edge runs a few centimeters off this tile's copy. Found on the real
    // Macon County data. The side test must not look at buffer copies.
    const failures: string[] = [];
    for (let k = 1; k <= 12; k++) {
      const s = k * 0.37;
      const ring: [number, number][] = [
        [E.east - 60, -40],
        [E.east + 60, -40 + s],
        [E.east + 60, 40],
        [E.east - 60, 40],
      ];
      for (const [px, py] of [
        [E.east - 5, -35],
        [E.east + 5, -35],
      ] as const) {
        const q = await query([parcel('P', ring)], px, py);
        // Distance from (px, py) to the slanted line, by plane geometry.
        const ax = E.east - 60;
        const ay = -40;
        const dx = 120;
        const dy = s;
        const expected = Math.abs(dx * (py - ay) - dy * (px - ax)) / Math.hypot(dx, dy);
        const got = q.nearestLine?.distanceM ?? NaN;
        if (!(Math.abs(got - expected) < 0.2)) failures.push(`k ${k} at ${px > E.east ? 'east' : 'west'}: ${got.toFixed(2)} m, expected ${expected.toFixed(2)} m`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('would see the clip edge if the neighbouring tile were not used', async () => {
    // Shows the test can fail: with only the centre tile, the edge of the
    // centre tile's square is where P's data stops, so a line is reported there.
    const full = world.archive(spanning);
    const store = new Map<string, Uint8Array>();
    const only = world.encode(world.center, spanning, { buffer: 0 });
    store.set(tileKey(world.center), only!);
    const src = new StoredParcelSource([fakeArchive('il-test', store, full.bounds)]);
    const q = await src.positionQuery(world.at(E.east - 10, 0));
    expect(q.nearestLine!.distanceM).toBeLessThan(11);
  });
});

describe('gaps and overlaps', () => {
  const road = [parcel('W', rect(-150, -100, -10, 100)), parcel('EA', rect(10, -100, 150, 100))];

  it('says when the point is in no parcel and still gives the nearest line', async () => {
    const q = await query(road, 3, 0);
    expect(q.inside).toBeNull();
    expect(Math.abs(q.nearestLine!.distanceM - 7)).toBeLessThan(0.2);
    expect(pids(q.nearestLine!.thisSide)).toEqual([]);
    expect(pids(q.nearestLine!.otherSide)).toEqual(['EA']);
  });

  it('returns both overlapping parcels, smallest first', async () => {
    const overlap = [parcel('BIG', rect(-100, -100, 100, 100)), parcel('SMALL', rect(-10, -10, 30, 30))];
    const q = await query(overlap, 0, 0);
    expect(pids(q.inside)).toEqual(['SMALL', 'BIG']);
    expect(Math.abs(q.nearestLine!.distanceM - 10)).toBeLessThan(0.2);
    expect(pids(q.nearestLine!.thisSide)).toEqual(['SMALL', 'BIG']);
    expect(pids(q.nearestLine!.otherSide)).toEqual(['BIG']);
  });
});

describe('coverage', () => {
  it('reports no archive outside the installed data', async () => {
    const q = await query(grid, 5000, 5000);
    expect(q.coverage).toBe('no-archive');
    expect(q.inside).toBeNull();
    expect(q.nearestLine).toBeNull();
  });

  it('reports no tile where the archive holds nothing', async () => {
    const full = world.archive(grid);
    const store = new Map([[tileKey(world.center), world.encode(world.center, grid)!]]);
    const src = new StoredParcelSource([fakeArchive('il-test', store, full.bounds)]);
    const q = await src.positionQuery(world.at(E.east + 200, 0));
    expect(q.coverage).toBe('no-tile');
  });

  it('reports a read error instead of a partial answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = world.archive(grid);
    a.getTile = async () => Promise.reject(new Error('disk'));
    const q = await new StoredParcelSource([a]).positionQuery(world.at(0, 0));
    expect(q.coverage).toBe('read-error');
    expect(q.inside).toBeNull();
  });

  it('reads both counties where they share a tile', async () => {
    const a = world.archive([parcel('A1', rect(-100, -50, 0, 50))], { county: 'il-a' });
    const b = world.archive([{ ...parcel('B1', rect(0, -50, 100, 50)), properties: { pid: 'B1', owner: 'OWNER B', county: 'il-b' } }], { county: 'il-b' });
    const src = new StoredParcelSource([a, b]);
    const q = await src.positionQuery(world.at(-10, 0));
    expect(pids(q.inside)).toEqual(['A1']);
    expect(Math.abs(q.nearestLine!.distanceM - 10)).toBeLessThan(0.2);
    const across = q.nearestLine!.otherSide[0]!;
    expect(across).toMatchObject({ pid: 'B1', county: 'il-b', countyName: 'Test County il-b', acres: null });
  });

  it('reads gzipped tiles', async () => {
    const plain = world.encode(world.center, grid)!;
    const gz = new Uint8Array(await new Response(new Blob([plain as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(gz[0]).toBe(0x1f);
    const store = new Map([[tileKey(world.center), gz]]);
    const src = new StoredParcelSource([fakeArchive('il-test', store, world.boundsOf([world.center]))]);
    const q = await src.positionQuery(world.at(20, -10));
    expect(pids(q.inside)).toEqual(['G-1-1']);
    expect(Math.abs(q.nearestLine!.distanceM - 30)).toBeLessThan(0.2);
  });
});

describe('tile reading', () => {
  it('reads one tile near the tile centre and four near a corner', async () => {
    const a = world.archive(grid);
    const src = new StoredParcelSource([a]);
    await src.positionQuery(world.at(0, 0));
    expect(a.reads).toBe(1);
    const b = world.archive(grid);
    await new StoredParcelSource([b]).positionQuery(world.at(E.east - 50, E.north - 50));
    expect(b.reads).toBe(4);
  });

  it('keeps decoded tiles, so a fix every second does not reread them', async () => {
    const a = world.archive(grid);
    const src = new StoredParcelSource([a]);
    for (let i = 0; i < 10; i++) await src.positionQuery(world.at(i, 0));
    expect(a.reads).toBe(1);
  });

  it('answers a tap with the parcel at the point', async () => {
    const src = new StoredParcelSource([world.archive(grid)]);
    const hit = await src.parcelsAt(world.at(120, 120));
    expect(hit.coverage).toBe('ok');
    expect(pids(hit.parcels)).toEqual(['G-2-2']);
    expect(hit.parcels[0]).toMatchObject({ owner: 'OWNER G-2-2', acres: 1, county: 'il-test', countyName: 'Test County il-test', dataDate: '2026-10-28' });
    const gap = await src.parcelsAt(world.at(200, 0));
    expect(gap.parcels).toEqual([]);
  });
});

describe('parcelArchivesFrom', () => {
  it('picks the parcel archives of a data session and takes the county name and data date from their metadata', async () => {
    const entry = (layer: string) =>
      ({
        county: 'il-test',
        layer,
        meta: { countyName: 'Test County', sources: [{ dataDate: '' }, { dataDate: '2026-10-28' }] },
      }) as unknown as OpenArchive['entry'];
    const open = (layer: string): OpenArchive => ({
      id: `il-test/${layer}`,
      layer,
      county: 'il-test',
      minzoom: 13,
      maxzoom: 16,
      bounds: [-89, 39, -88, 40],
      entry: entry(layer),
      getTile: async () => new Uint8Array([7]).buffer as ArrayBuffer,
      getMetadata: async () => ({}),
    });
    const list = parcelArchivesFrom([open('basemap'), open('parcels')]);
    expect(list.map((a) => a.id)).toEqual(['il-test/parcels']);
    expect(list[0]).toMatchObject({ county: 'il-test', countyName: 'Test County', dataDate: '2026-10-28', minzoom: 13, maxzoom: 16 });
    expect(new Uint8Array((await list[0]!.getTile(16, 1, 1))!)).toEqual(new Uint8Array([7]));
  });
});

describe('field allowlist', () => {
  it('keeps exactly the four parcel fields plus county name and data date', async () => {
    const leaky: MeterParcel = {
      properties: { pid: 'A1', owner: 'OWNER A', acres: 40.5, county: 'il-test', mail_addr: '1 TEST LANE', phone: '555-0100', site_addr: 'TEST SITE', tax: 12 },
      rings: [rect(-50, -50, 50, 50)],
    };
    const src = new StoredParcelSource([world.archive([leaky])]);
    const q = await src.positionQuery(world.at(0, 0));
    expect(Object.keys(q.inside![0]!).sort()).toEqual(['acres', 'county', 'countyName', 'dataDate', 'owner', 'pid']);
    const tap = await src.parcelsAt(world.at(0, 0));
    expect(Object.keys(tap.parcels[0]!).sort()).toEqual(['acres', 'county', 'countyName', 'dataDate', 'owner', 'pid']);
    const all = JSON.stringify([q, tap]);
    expect(all).not.toContain('1 TEST LANE');
    expect(all).not.toContain('555-0100');
    expect(all).not.toContain('TEST SITE');
  });
});

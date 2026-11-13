// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it, vi } from 'vitest';
import { createTileLoader, newTileStats, parseTileUrl, tileUrlTemplate } from './tile-protocol';
import { TileResolver, type TileArchive } from './tile-resolver';
import { tileBounds, type Bounds } from './tile-math';

// Two neighbouring counties' worth of bounds, roughly Champaign and Macon.
const EAST: Bounds = [-88.47, 39.87, -87.92, 40.41];
const WEST: Bounds = [-89.22, 39.65, -88.74, 40.06];

// Zoom 12 tiles inside each area. Computed from the bounds, not hard-coded.
function tileAt(lon: number, lat: number, z: number): [number, number] {
  const x = Math.floor(((lon + 180) / 360) * 2 ** z);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
  return [x, y];
}
const [ex, ey] = tileAt(-88.2, 40.1, 12);
const [wx, wy] = tileAt(-88.95, 39.85, 12);

function bytes(tag: string): ArrayBuffer {
  return new TextEncoder().encode(tag).buffer as ArrayBuffer;
}

function fakeArchive(
  id: string,
  bounds: Bounds,
  has: (z: number, x: number, y: number) => boolean,
  opts: Partial<Pick<TileArchive, 'layer' | 'minzoom' | 'maxzoom'>> = {},
) {
  const getTile = vi.fn(async (z: number, x: number, y: number) => (has(z, x, y) ? bytes(id) : undefined));
  const archive: TileArchive = { id, layer: opts.layer ?? 'basemap', minzoom: opts.minzoom ?? 0, maxzoom: opts.maxzoom ?? 15, bounds, getTile };
  return { archive, getTile };
}

const text = (b: ArrayBuffer | Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : undefined);

describe('TileResolver', () => {
  it('answers from the first archive that has the tile', async () => {
    const a = fakeArchive('a', EAST, () => true);
    const b = fakeArchive('b', EAST, () => true);
    const r = new TileResolver();
    r.setArchives([a.archive, b.archive]);
    expect(text(await r.getTile('basemap', 12, ex, ey))).toBe('a');
    expect(b.getTile).not.toHaveBeenCalled();
  });

  it('falls through to the next archive when the first does not hold the tile', async () => {
    const a = fakeArchive('a', EAST, () => false);
    const b = fakeArchive('b', EAST, () => true);
    const r = new TileResolver();
    r.setArchives([a.archive, b.archive]);
    expect(text(await r.getTile('basemap', 12, ex, ey))).toBe('b');
    expect(a.getTile).toHaveBeenCalledOnce();
  });

  it('skips archives whose bounds cannot hold the tile', async () => {
    const east = fakeArchive('east', EAST, () => true);
    const west = fakeArchive('west', WEST, () => true);
    const r = new TileResolver();
    r.setArchives([east.archive, west.archive]);
    expect(text(await r.getTile('basemap', 12, wx, wy))).toBe('west');
    expect(east.getTile).not.toHaveBeenCalled();
  });

  it('skips archives whose zoom range cannot hold the tile', async () => {
    const low = fakeArchive('low', EAST, () => true, { maxzoom: 10 });
    const high = fakeArchive('high', EAST, () => true, { minzoom: 11 });
    const r = new TileResolver();
    r.setArchives([low.archive, high.archive]);
    expect(text(await r.getTile('basemap', 12, ex, ey))).toBe('high');
    expect(low.getTile).not.toHaveBeenCalled();
    expect(r.candidates('basemap', 9, ex >> 3, ey >> 3).map((a) => a.id)).toEqual(['low']);
  });

  it('keeps layers apart', async () => {
    const base = fakeArchive('base', EAST, () => true);
    const land = fakeArchive('land', EAST, () => true, { layer: 'publicland' });
    const r = new TileResolver();
    r.setArchives([base.archive, land.archive]);
    expect(text(await r.getTile('publicland', 12, ex, ey))).toBe('land');
    expect(await r.getTile('aerial', 12, ex, ey)).toBeUndefined();
  });

  it('returns undefined when no archive has the tile', async () => {
    const a = fakeArchive('a', EAST, () => false);
    const r = new TileResolver();
    r.setArchives([a.archive]);
    expect(await r.getTile('basemap', 12, ex, ey)).toBeUndefined();
  });

  it('tries the next archive when one fails, and throws only if none answers', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: TileArchive = { ...fakeArchive('broken', EAST, () => true).archive, getTile: async () => Promise.reject(new Error('disk')) };
    const good = fakeArchive('good', EAST, () => true);
    const r = new TileResolver();
    r.setArchives([broken, good.archive]);
    expect(text(await r.getTile('basemap', 12, ex, ey))).toBe('good');
    r.setArchives([broken]);
    await expect(r.getTile('basemap', 12, ex, ey)).rejects.toThrow('disk');
  });

  it('stops at once when the request is cancelled', async () => {
    const a = fakeArchive('a', EAST, () => true);
    const r = new TileResolver();
    r.setArchives([a.archive]);
    const c = new AbortController();
    c.abort();
    await expect(r.getTile('basemap', 12, ex, ey, c.signal)).rejects.toThrow();
    expect(a.getTile).not.toHaveBeenCalled();
  });

  it('treats tiles that only touch an archive edge as outside it', () => {
    const tb = tileBounds(12, ex, ey);
    const touching = fakeArchive('touch', [tb[2], tb[1], tb[2] + 1, tb[3]], () => true);
    const r = new TileResolver();
    r.setArchives([touching.archive]);
    expect(r.candidates('basemap', 12, ex, ey)).toEqual([]);
  });
});

describe('tile protocol', () => {
  it('round-trips a layer tile address', () => {
    const url = tileUrlTemplate('publicland').replace('{z}', '12').replace('{x}', '1043').replace('{y}', '1550');
    expect(parseTileUrl(url)).toEqual({ layer: 'publicland', z: 12, x: 1043, y: 1550 });
    expect(parseTileUrl('mapapp://../12/1/1')).toBeNull();
    expect(parseTileUrl('pmtiles://basemap/1/1/1')).toBeNull();
  });

  it('answers a missing tile with zero bytes and counts failures', async () => {
    const a = fakeArchive('a', EAST, (z) => z === 12);
    const r = new TileResolver();
    r.setArchives([a.archive]);
    const stats = newTileStats();
    const load = createTileLoader(r, stats);
    const hit = await load({ url: `mapapp://basemap/12/${ex}/${ey}` }, new AbortController());
    expect(text(hit.data)).toBe('a');
    const miss = await load({ url: `mapapp://basemap/13/${ex * 2}/${ey * 2}` }, new AbortController());
    expect(miss.data.byteLength).toBe(0);
    await expect(load({ url: 'mapapp://bad' }, new AbortController())).rejects.toThrow();
    expect(stats).toMatchObject({ requested: 3, failed: 1 });
  });
});

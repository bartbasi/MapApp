// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The map with downloaded areas installed beside what came with the app and
// the overview map (D33): lookup order, unique names and sources when several
// areas hold the same county and layer, and loading the session again.

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { memorySource, writeTestArchive } from '../downloads/test-archive';
import { makeAreaId } from '../downloads/area-record';
import type { ArchiveEntry, ArchiveMeta } from '../platform/archive-meta';
import { archiveLabel } from '../platform/archive-meta';
import type { Platform } from '../platform/platform';
import { orderArchives } from './archive-order';
import { loadDataSession, reloadDataSession } from './data-session';
import { summarizeInstalled } from './installed';
import { buildStyle, rasterDrawOrder, rasterSourceId } from './style/build-style';
import { parcelSourceId } from './style/parcels';
import { createTileLoader, parseTileUrl, tileUrlTemplate } from './tile-protocol';
import type { Bounds } from './tile-math';

const MACON: Bounds = [-89.2179, 39.6526, -88.745, 40.0554];
const OVERVIEW: Bounds = [-89.7, 39.1, -87.4, 40.9];
const BOX: Bounds = [-89.0, 39.8, -88.9, 39.87];

const OLD_AREA = makeAreaId(Date.UTC(2026, 10, 1));
const NEW_AREA = makeAreaId(Date.UTC(2026, 10, 17));

function entry(county: string, layer: string, o: { area?: string; bounds?: Bounds; minzoom?: number; maxzoom?: number } = {}): ArchiveEntry {
  const meta: ArchiveMeta = {
    schema: 1,
    layer,
    county,
    countyName: county,
    kind: layer === 'aerial' ? 'raster' : 'vector',
    title: layer,
    minzoom: o.minzoom ?? 0,
    maxzoom: o.maxzoom ?? 15,
    bounds: o.bounds ?? MACON,
    bytes: 1,
    buildDate: '2026-11-17',
    sources: [{ name: 'S', license: 'L', credit: 'C.', url: '', dataDate: '2025' }],
    notes: '',
  };
  return { county, layer, meta, ...(o.area !== undefined ? { area: o.area } : {}) };
}

const overview = entry('overview', 'basemap', { bounds: OVERVIEW, maxzoom: 11 });
const bundled = entry('il-macon', 'basemap');
const oldArea = entry('il-macon', 'basemap', { area: OLD_AREA, bounds: BOX });
const newArea = entry('il-macon', 'basemap', { area: NEW_AREA, bounds: BOX, maxzoom: 14 });

describe('the order archives answer in', () => {
  it('is downloaded areas newest first, then what came with the app, then the overview map', () => {
    const champaign = entry('il-champaign', 'basemap');
    const ordered = orderArchives([overview, bundled, oldArea, champaign, newArea]);
    expect(ordered.map(archiveLabel)).toEqual([
      `il-macon/basemap@${NEW_AREA}`,
      `il-macon/basemap@${OLD_AREA}`,
      'il-macon/basemap',
      'il-champaign/basemap',
      'overview/basemap',
    ]);
  });

  it('keeps the per-layer summary sensible with everything mixed', () => {
    const installed = summarizeInstalled(orderArchives([overview, bundled, newArea, entry('il-macon', 'aerial', { minzoom: 7, maxzoom: 16 })]));
    const base = installed.get('basemap')!;
    expect(base.bounds).toEqual(OVERVIEW);
    expect([base.minzoom, base.maxzoom]).toEqual([0, 15]);
    expect(base.archives.map(archiveLabel)).toEqual([`il-macon/basemap@${NEW_AREA}`, 'il-macon/basemap', 'overview/basemap']);
    expect(installed.get('aerial')!.bounds).toEqual(MACON);
  });
});

/** A fake platform whose archives each answer every tile with their own name. */
async function platformWith(entries: ArchiveEntry[]): Promise<Platform & { entries: ArchiveEntry[] }> {
  const files = new Map<string, Uint8Array>();
  for (const e of entries) {
    const tiles = [];
    for (let z = e.meta.minzoom; z <= Math.min(e.meta.maxzoom, 12); z++) {
      // Every tile of zoom z over the archive's bounds, labelled with the archive.
      const n = 2 ** z;
      const x0 = Math.floor(((e.meta.bounds[0] + 180) / 360) * n);
      const x1 = Math.floor(((e.meta.bounds[2] + 180) / 360) * n);
      const lat = (d: number) => Math.floor(((1 - Math.asinh(Math.tan((d * Math.PI) / 180)) / Math.PI) / 2) * n);
      for (let x = x0; x <= x1; x++) for (let y = lat(e.meta.bounds[3]); y <= lat(e.meta.bounds[1]); y++) tiles.push({ z, x, y, data: new TextEncoder().encode(archiveLabel(e)) });
    }
    files.set(archiveLabel(e), await writeTestArchive(tiles, { minzoom: e.meta.minzoom, maxzoom: e.meta.maxzoom, bounds: e.meta.bounds }));
  }
  const p = {
    kind: 'browser' as const,
    entries,
    settings: { canOpen: false, open: async () => false },
    archives: {
      list: async () => [...p.entries],
      open: (e: ArchiveEntry) => memorySource(files.get(archiveLabel(e))!, archiveLabel(e)),
    },
  };
  return p;
}

const text = (b: ArrayBuffer | undefined) => (b ? new TextDecoder().decode(b) : undefined);

/** The tile at a point: zoom, column, row. */
function tileAt(lng: number, lat: number, z: number): [number, number, number] {
  const n = 2 ** z;
  const y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  return [z, Math.floor(((lng + 180) / 360) * n), y];
}

describe('the data session', () => {
  it('answers a tile from the newest area, then the bundled archive, then the overview map', async () => {
    const platform = await platformWith([overview, bundled, oldArea, newArea]);
    const s = await loadDataSession(platform);
    expect(s.entries.map(archiveLabel)[0]).toBe(`il-macon/basemap@${NEW_AREA}`);
    // Zoom 12 tile in the box: both areas have it; the newest answers.
    expect(text(await s.resolver.getTile('basemap', ...tileAt(-88.95, 39.835, 12)))).toBe(`il-macon/basemap@${NEW_AREA}`);
    // Zoom 12 tile in Macon County away from the box: the bundled archive.
    expect(text(await s.resolver.getTile('basemap', ...tileAt(-89.15, 39.7, 12)))).toBe('il-macon/basemap');
    // Zoom 8 tile outside the county: only the overview map has it.
    expect(text(await s.resolver.getTile('basemap', ...tileAt(-87.6, 40.5, 8)))).toBe('overview/basemap');
    // Zoom 12 outside the county: past the overview map's zoom, so nothing.
    expect(await s.resolver.getTile('basemap', ...tileAt(-87.6, 40.5, 12))).toBeUndefined();
  });

  it('gives each open archive a unique name, even with two areas of the same county and layer', async () => {
    const s = await loadDataSession(await platformWith([bundled, oldArea, newArea]));
    const ids = s.archives.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
    expect(s.archives.map((a) => a.area)).toEqual([NEW_AREA, OLD_AREA, undefined]);
  });

  it('loads again with the same resolver and the new archives', async () => {
    const platform = await platformWith([bundled, newArea]);
    const first = await loadDataSession(platform);
    platform.entries = [bundled];
    const second = await reloadDataSession(platform, first);
    expect(second.resolver).toBe(first.resolver);
    expect(second.entries.map(archiveLabel)).toEqual(['il-macon/basemap']);
    expect(second.resolver.candidates('basemap', ...tileAt(-88.95, 39.835, 12)).map((a) => a.id)).toEqual(['il-macon/basemap']);
  });
});

describe('one archive by its address', () => {
  it('the tile address names an area archive and reads back', () => {
    const t = tileUrlTemplate('aerial', 'il-macon', NEW_AREA);
    expect(t).toBe(`mapapp://aerial@il-macon.${NEW_AREA}/{z}/{x}/{y}`);
    expect(parseTileUrl(t.replace('{z}/{x}/{y}', '12/1010/1555'))).toEqual({ layer: 'aerial', county: 'il-macon', area: NEW_AREA, z: 12, x: 1010, y: 1555 });
    expect(parseTileUrl('mapapp://aerial@il-macon/1/2/3')).toEqual({ layer: 'aerial', county: 'il-macon', z: 1, x: 2, y: 3 });
    expect(parseTileUrl('mapapp://aerial@il-macon./1/2/3')).toBeNull();
  });

  it('reads the named archive only: the area one, or with no area the one that came with the app', async () => {
    const s = await loadDataSession(await platformWith([bundled, newArea]));
    const load = createTileLoader(s.resolver);
    const [z, x, y] = tileAt(-88.95, 39.835, 12);
    const read = async (url: string) => new TextDecoder().decode((await load({ url }, new AbortController())).data);
    expect(await read(`mapapp://basemap@il-macon.${NEW_AREA}/${z}/${x}/${y}`)).toBe(`il-macon/basemap@${NEW_AREA}`);
    expect(await read(`mapapp://basemap@il-macon/${z}/${x}/${y}`)).toBe('il-macon/basemap');
    expect(await read(`mapapp://basemap/${z}/${x}/${y}`)).toBe(`il-macon/basemap@${NEW_AREA}`);
    expect(await read(`mapapp://basemap@il-macon.${OLD_AREA}/${z}/${x}/${y}`)).toBe('');
  });
});

describe('the style with downloaded areas', () => {
  const aerialBundled = entry('il-macon', 'aerial', { minzoom: 7, maxzoom: 16 });
  const aerialOld = entry('il-macon', 'aerial', { area: OLD_AREA, bounds: BOX, minzoom: 7, maxzoom: 14 });
  const aerialNew = entry('il-macon', 'aerial', { area: NEW_AREA, bounds: BOX, minzoom: 7, maxzoom: 16 });
  const installed = summarizeInstalled(orderArchives([overview, bundled, newArea, aerialBundled, aerialOld, aerialNew]));
  const style = buildStyle({ base: 'hybrid', overlays: { publicland: true }, installed, glyphs: 'http://x/{fontstack}/{range}.pbf' });

  it('gives each imagery archive its own source and layer, and passes the style checker', () => {
    const rasterIds = Object.keys(style.sources).filter((k) => k.startsWith('aerial:'));
    expect(rasterIds.sort()).toEqual([`aerial:il-macon`, `aerial:il-macon@${NEW_AREA}`, `aerial:il-macon@${OLD_AREA}`].sort());
    expect(style.sources[`aerial:il-macon@${OLD_AREA}`]).toMatchObject({ tiles: [`mapapp://aerial@il-macon.${OLD_AREA}/{z}/{x}/{y}`], maxzoom: 14, bounds: BOX });
    const ids = style.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('draws the less detailed imagery under the sharper', () => {
    const drawn = style.layers.filter((l) => l.type === 'raster').map((l) => (l as { source: string }).source);
    expect(drawn[0]).toBe(`aerial:il-macon@${OLD_AREA}`);
    expect(rasterDrawOrder([aerialOld, aerialBundled]).map(rasterSourceId)).toEqual([`aerial:il-macon@${OLD_AREA}`, 'aerial:il-macon']);
  });

  it('names parcel sources uniquely too', () => {
    expect(parcelSourceId(entry('il-macon', 'parcels'))).toBe('parcels:il-macon');
    expect(parcelSourceId(entry('il-macon', 'parcels', { area: NEW_AREA }))).toBe(`parcels:il-macon@${NEW_AREA}`);
  });
});

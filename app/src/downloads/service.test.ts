// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The download manager against platform parts that live in memory: a hosted
// release of small made-up archives, the in-memory downloader the browser
// stand-in uses, and a network the test switches on and off.

import { describe, expect, it, vi } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { CoverageArea } from '../parcels/coverage-area';
import { MemoryDownloadJobs } from '../platform/memory-download-jobs';
import type { AreaJob, AreaRequest, AreaStatus, AreaView, Catalog, CatalogArchive } from './contract';
import { CatalogUnavailableError, NotEnoughSpaceError, NothingToDownloadError, OfflineError } from './errors';
import { checkExtract } from './extract-check';
import { planExtract } from './extract-planner';
import { SPACE_MARGIN_BYTES, createDownloadService, type DownloadManager } from './service';
import { memorySource, writeTestArchive, type TestTile } from './test-archive';
import { MemoryRemote, TestNetwork, bytesFile, catalogText, memoryStorage, sha256Hex, testMeta } from './test-platform';
import { tileRect } from './tile-cover';

const CATALOG_URL = 'https://catalog.test/catalog.json';
const BASE = 'https://host.test/rel/';
const MACON: Bounds = [-89.2179, 39.6526, -88.745, 40.0554];
const CHAMPAIGN: Bounds = [-88.4637, 39.879, -87.9287, 40.4007];
/** A box of about 8 km inside Macon County. */
const BOX: Bounds = [-89.0, 39.8, -88.9, 39.87];

interface LayerSpec {
  layer: string;
  minzoom: number;
  maxzoom: number;
  /** Where the archive has tiles; the metadata's bounds are the county's. */
  tilesIn?: Bounds;
  coverage?: CatalogArchive['meta']['coverage'];
}

const LAYERS: LayerSpec[] = [
  { layer: 'basemap', minzoom: 0, maxzoom: 12 },
  { layer: 'aerial', minzoom: 7, maxzoom: 13 },
  // Tiles in the north-east corner only.
  { layer: 'publicland', minzoom: 10, maxzoom: 12, tilesIn: [-88.85, 39.95, -88.745, 40.0554] },
];

/** Tile contents of about 200 bytes, each different, with a repeat now and then (the sea, say). */
function tilesFor(layer: string, bounds: Bounds, minzoom: number, maxzoom: number): TestTile[] {
  const out: TestTile[] = [];
  for (let z = minzoom; z <= maxzoom; z++) {
    const r = tileRect(bounds, z);
    for (let x = r.minX; x <= r.maxX; x++) {
      for (let y = r.minY; y <= r.maxY; y++) {
        const label = (x + y) % 7 === 0 ? `${layer} same` : `${layer} ${z}/${x}/${y}`;
        const data = new Uint8Array(200);
        data.set(new TextEncoder().encode(label));
        for (let i = label.length; i < data.length; i++) data[i] = (i * 31 + x * 7 + y * 13 + z) & 255;
        out.push({ z, x, y, data });
      }
    }
  }
  return out;
}

interface Hosted {
  catalog: Catalog;
  bytes: Map<string, Uint8Array>;
}

async function makeRelease(counties: { id: string; bounds: Bounds }[] = [{ id: 'il-macon', bounds: MACON }], layers: LayerSpec[] = LAYERS, edit?: (a: CatalogArchive) => void): Promise<Hosted> {
  const bytes = new Map<string, Uint8Array>();
  const archives: CatalogArchive[] = [];
  for (const c of counties) {
    for (const l of layers) {
      const tiles = tilesFor(`${c.id} ${l.layer}`, l.tilesIn ?? c.bounds, l.minzoom, l.maxzoom);
      const data = await writeTestArchive(tiles, { minzoom: l.minzoom, maxzoom: l.maxzoom, bounds: c.bounds, metadata: { name: l.layer } });
      const file = `${c.id}.${l.layer}.pmtiles`;
      bytes.set(BASE + file, data);
      const meta = testMeta(c.id, l.layer, { bounds: c.bounds, minzoom: l.minzoom, maxzoom: l.maxzoom, bytes: data.length, coverage: l.coverage, dataDate: l.layer === 'aerial' ? '2025-06-30' : '2025-01-01' });
      const a: CatalogArchive = { county: c.id, layer: l.layer, file, bytes: data.length, sha256: await sha256Hex(data), meta };
      edit?.(a);
      archives.push(a);
    }
  }
  return { catalog: { schema: 1, release: 'data-2026-11-17', published: '2026-11-17', base: BASE, archives }, bytes };
}

interface Setup {
  hosted: Hosted;
  remote: MemoryRemote;
  network: TestNetwork;
  jobs: MemoryDownloadJobs;
  storage: ReturnType<typeof memoryStorage>;
  service: DownloadManager;
  clock: { t: number };
  free: { bytes: number | undefined };
}

async function setup(hosted?: Hosted, o: { storage?: ReturnType<typeof memoryStorage>; online?: boolean } = {}): Promise<Setup> {
  const h = hosted ?? (await makeRelease());
  const remote = new MemoryRemote();
  for (const [url, data] of h.bytes) remote.files.set(url, bytesFile(data, `"${url.length}-${data.length}"`));
  remote.texts.set(CATALOG_URL, catalogText(h.catalog));
  const network = new TestNetwork();
  if (o.online === false) {
    network.state = { online: false, metered: false };
    remote.online = false;
  }
  const free = { bytes: undefined as number | undefined };
  const jobs = new MemoryDownloadJobs({ remote, network, chunkBytes: 4096, progressMs: 0, retryMs: 5, freeBytes: async () => free.bytes });
  const storage = o.storage ?? memoryStorage();
  const clock = { t: Date.UTC(2026, 10, 17, 12) };
  let n = 0;
  const service = createDownloadService({ remote, jobs, network }, { catalogUrl: CATALOG_URL, storage, now: () => clock.t, random: () => (n++ % 36) / 36 });
  await service.ready;
  return { hosted: h, remote, network, jobs, storage, service, clock, free };
}

function view(service: DownloadManager, id: string): AreaView | undefined {
  return service.areas().find((a) => a.record.id === id);
}

/** Resolves when the area reaches one of the statuses. */
function until(service: DownloadManager, id: string, ...statuses: AreaStatus[]): Promise<AreaView> {
  return new Promise((resolve) => {
    const check = () => {
      const v = view(service, id);
      if (v && statuses.includes(v.status)) {
        off();
        resolve(v);
        return true;
      }
      return false;
    };
    const off = service.onAreas(() => void check());
    check();
  });
}

const rect = (layers: string[], aerialMaxzoom = 13, bounds: Bounds = BOX): AreaRequest => ({ where: { bounds }, layers, aerialMaxzoom });
const county = (layers: string[], aerialMaxzoom = 13, id = 'il-macon'): AreaRequest => ({ where: { county: id }, layers, aerialMaxzoom });

describe('offers', () => {
  it('lists each county once with its layers and whole sizes', async () => {
    const s = await setup(await makeRelease([{ id: 'il-macon', bounds: MACON }, { id: 'il-champaign', bounds: CHAMPAIGN }]));
    const offers = await s.service.offers();
    expect(offers.map((o) => o.county)).toEqual(['il-macon', 'il-champaign']);
    const macon = offers[0]!;
    expect(macon.countyName).toBe('il-macon County');
    expect(macon.bounds).toEqual(MACON);
    expect(macon.layers.map((l) => l.layer)).toEqual(['basemap', 'aerial', 'publicland']);
    expect(macon.layers[1]).toMatchObject({ title: 'aerial title', maxzoom: 13, bytes: s.hosted.bytes.get(`${BASE}il-macon.aerial.pmtiles`)!.length });
  });

  it('keeps the last good catalog and uses it with no connection', async () => {
    const storage = memoryStorage();
    const first = await setup(undefined, { storage });
    await first.service.offers();
    expect(storage.saves).toBe(1);
    const later = await setup(first.hosted, { storage, online: false });
    expect((await later.service.offers()).map((o) => o.county)).toEqual(['il-macon']);
    expect(later.remote.textReads).toBe(0);
  });

  it('uses the kept catalog when the fetch fails while online', async () => {
    const storage = memoryStorage();
    const first = await setup(undefined, { storage });
    await first.service.offers();
    const later = await setup(first.hosted, { storage });
    later.remote.texts.clear();
    expect(await later.service.offers()).toHaveLength(1);
  });

  it('rejects with CatalogUnavailableError with no connection and no kept catalog', async () => {
    const s = await setup(undefined, { online: false });
    await expect(s.service.offers()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('rejects with CatalogUnavailableError when the catalog does not check out, and does not keep it', async () => {
    const s = await setup();
    s.remote.texts.set(CATALOG_URL, JSON.stringify({ ...s.hosted.catalog, base: 'https://host.test/no-slash' }));
    await expect(s.service.offers()).rejects.toMatchObject({ code: 'catalog-unavailable' });
    expect(s.storage.text).toBeNull();
  });

  it('fetches the catalog again once it is old', async () => {
    const s = await setup();
    await s.service.offers();
    await s.service.offers();
    expect(s.remote.textReads).toBe(1);
    s.clock.t += 11 * 60 * 1000;
    await s.service.offers();
    expect(s.remote.textReads).toBe(2);
  });
});

describe('estimate', () => {
  it('for a rectangle: one plan per overlapping archive, read from directories only', async () => {
    const s = await setup(await makeRelease([{ id: 'il-macon', bounds: MACON }, { id: 'il-champaign', bounds: CHAMPAIGN }]));
    const est = await s.service.estimate(rect(['basemap', 'aerial']));
    // Champaign does not overlap the box: never read.
    expect(s.remote.reads.every((r) => r.url.includes('il-macon'))).toBe(true);
    expect(est.layers.map((l) => `${l.county}/${l.layer}`)).toEqual(['il-macon/basemap', 'il-macon/aerial']);
    expect(est.bytes).toBe(est.layers.reduce((n, l) => n + l.bytes, 0));
    expect(est.layers.every((l) => l.tiles > 0 && l.title.length > 0)).toBe(true);
    expect(est.missing).toEqual([]);
    // Far less than the whole files.
    const whole = s.hosted.catalog.archives.filter((a) => a.county === 'il-macon' && a.layer !== 'publicland').reduce((n, a) => n + a.bytes, 0);
    expect(est.bytes).toBeLessThan(whole / 2);
  });

  it('the imagery detail applies to imagery only', async () => {
    const s = await setup();
    const full = await s.service.estimate(rect(['basemap', 'aerial'], 13));
    const low = await s.service.estimate(rect(['basemap', 'aerial'], 10));
    expect(low.layers[0]).toEqual(full.layers[0]);
    expect(low.layers[1]!.bytes).toBeLessThan(full.layers[1]!.bytes);
    expect(low.layers[1]!.tiles).toBeLessThan(full.layers[1]!.tiles);
  });

  it('leaves out an archive with no tile in the rectangle and names its layer as missing', async () => {
    const s = await setup();
    const est = await s.service.estimate(rect(['basemap', 'publicland']));
    expect(est.layers.map((l) => l.layer)).toEqual(['basemap']);
    expect(est.missing).toEqual(['publicland']);
  });

  it('names a layer that is not hosted at all as missing', async () => {
    const s = await setup();
    const est = await s.service.estimate(rect(['basemap', 'contours']));
    expect(est.missing).toEqual(['contours']);
  });

  it('leaves imagery out when the detail asked for is below its lowest zoom', async () => {
    const s = await setup();
    const est = await s.service.estimate(rect(['aerial'], 5));
    expect(est).toEqual({ bytes: 0, layers: [], missing: ['aerial'] });
  });

  it('for a whole county: the catalog sizes, with no read', async () => {
    const s = await setup();
    const est = await s.service.estimate(county(['basemap', 'publicland']));
    expect(s.remote.reads).toHaveLength(0);
    const sizes = s.hosted.catalog.archives.filter((a) => a.layer !== 'aerial').map((a) => a.bytes);
    expect(est.layers.map((l) => l.bytes)).toEqual(sizes);
    expect(est.layers.map((l) => l.tiles)).toEqual([0, 0]);
  });

  it('for a whole county at less imagery detail: imagery is cut to that detail', async () => {
    const s = await setup();
    const est = await s.service.estimate(county(['aerial'], 10));
    expect(s.remote.reads.length).toBeGreaterThan(0);
    const whole = s.hosted.catalog.archives.find((a) => a.layer === 'aerial')!.bytes;
    expect(est.layers[0]!.bytes).toBeLessThan(whole);
  });

  it('rejects with AbortError when aborted, before or during the reads', async () => {
    const s = await setup();
    const before = new AbortController();
    before.abort();
    await expect(s.service.estimate(rect(['basemap']), before.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const during = new AbortController();
    s.remote.beforeRead = () => during.abort();
    await expect(s.service.estimate(rect(['basemap', 'aerial']), during.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a rectangle with OfflineError with no connection, but sizes a whole county from the kept catalog', async () => {
    const s = await setup();
    await s.service.offers();
    s.network.set(false);
    s.remote.online = false;
    await expect(s.service.estimate(rect(['basemap']))).rejects.toBeInstanceOf(OfflineError);
    expect((await s.service.estimate(county(['basemap']))).layers).toHaveLength(1);
  });

  it('turns a failed read into OfflineError when the connection turns out to be gone', async () => {
    const s = await setup();
    await s.service.offers();
    s.remote.beforeRead = () => {
      s.network.state = { online: false, metered: false };
      throw new TypeError('network unreachable');
    };
    await expect(s.service.estimate(rect(['basemap']))).rejects.toBeInstanceOf(OfflineError);
  });

  it('refuses a request that is not well formed', async () => {
    const s = await setup();
    await expect(s.service.estimate(rect(['basemap'], 13, [1, 1, 0, 2]))).rejects.toBeInstanceOf(RangeError);
    await expect(s.service.estimate({ where: { bounds: BOX }, layers: ['basemap'], aerialMaxzoom: 1.5 })).rejects.toBeInstanceOf(RangeError);
  });
});

describe('start and the download', () => {
  it('downloads exactly the bytes the estimate gave, and each archive matches the hosted one tile for tile', async () => {
    const s = await setup();
    const request = rect(['basemap', 'aerial'], 12);
    const est = await s.service.estimate(request);
    const id = await s.service.start(request, 'Creek bottom');
    const done = await until(s.service, id, 'complete', 'failed');
    expect(done.status).toBe('complete');
    expect(done.bytesDone).toBe(est.bytes);
    expect(done.bytesTotal).toBe(est.bytes);
    expect(done.record).toMatchObject({ id, name: 'Creek bottom', bounds: BOX, layers: ['basemap', 'aerial'], aerialMaxzoom: 12, release: 'data-2026-11-17', dataDate: '2025-06-30', bytes: est.bytes });
    expect(done.record.county).toBeUndefined();

    const entries = s.jobs.completedArchives();
    expect(entries.map((e) => `${e.county}/${e.layer}@${e.area}`)).toEqual([`il-macon/basemap@${id}`, `il-macon/aerial@${id}`]);
    for (const [i, entry] of entries.entries()) {
      const hosted = memorySource(s.hosted.bytes.get(`${BASE}il-macon.${entry.layer}.pmtiles`)!);
      const ask = { bounds: BOX, ...(entry.layer === 'aerial' ? { maxzoom: 12 } : {}) };
      const plan = await planExtract(hosted, ask);
      const written = s.jobs.fileBytes(id, i)!;
      expect(written.length).toBe(est.layers[i]!.bytes);
      await checkExtract(hosted, memorySource(written), plan, ask);
      // The new archive's metadata: the plan's bounds, zoom and size.
      expect(entry.meta).toMatchObject({ bounds: plan.bounds, maxzoom: plan.maxzoom, minzoom: plan.minzoom, bytes: plan.bytes, county: 'il-macon', layer: entry.layer });
    }
  });

  it('a whole county downloads the hosted files byte for byte, with their checksums', async () => {
    const s = await setup();
    const startSpy = vi.spyOn(s.jobs, 'start');
    const est = await s.service.estimate(county(['basemap', 'publicland']));
    const id = await s.service.start(county(['basemap', 'publicland']), '');
    const done = await until(s.service, id, 'complete', 'failed');
    expect(done.status).toBe('complete');
    expect(done.bytesDone).toBe(est.bytes);
    expect(done.record).toMatchObject({ name: 'il-macon County', county: 'il-macon', bounds: MACON });
    const job = startSpy.mock.calls[0]![0] as AreaJob;
    for (const [i, f] of job.files.entries()) {
      const hosted = s.hosted.bytes.get(f.url)!;
      expect(s.jobs.fileBytes(id, i)).toEqual(hosted);
      expect(f.sha256).toBe(s.hosted.catalog.archives.find((a) => BASE + a.file === f.url)!.sha256);
      expect(f.head).toHaveLength(0);
      expect(f.ranges).toEqual([{ offset: 0, length: hosted.length }]);
      expect(JSON.parse(f.meta)).toEqual(s.hosted.catalog.archives.find((a) => BASE + a.file === f.url)!.meta);
    }
  });

  it('gives an extract no checksum and the ETag the plan was made from', async () => {
    const s = await setup();
    const startSpy = vi.spyOn(s.jobs, 'start');
    await s.service.start(rect(['basemap']), 'x');
    const job = startSpy.mock.calls[0]![0] as AreaJob;
    expect(job.id).toMatch(/^a[0-9a-z]{9}-[0-9a-z]{8}$/);
    expect(JSON.parse(job.record)).toMatchObject({ id: job.id, name: 'x' });
    expect(job.files).toHaveLength(1);
    const f = job.files[0]!;
    expect(f.sha256).toBeUndefined();
    expect(f.etag).toBe(`"${f.url.length}-${s.hosted.bytes.get(f.url)!.length}"`);
    expect(f.url).toBe(`${BASE}il-macon.basemap.pmtiles`);
    expect(f.bytes).toBe(f.head.length + f.ranges.reduce((n, r) => n + r.length, 0));
  });

  it('does not plan again when started with the request just estimated', async () => {
    const s = await setup();
    const request = rect(['basemap', 'aerial']);
    await s.service.estimate(request);
    let held: () => void = () => {};
    const gate = new Promise<void>((r) => (held = r));
    s.remote.beforeRead = () => gate;
    // Any read is held at the gate, so start() resolves only if it plans nothing.
    const id = await s.service.start(request, 'x');
    held();
    s.remote.beforeRead = null;
    expect((await until(s.service, id, 'complete')).status).toBe('complete');
  });

  it('plans again when the request differs', async () => {
    const s = await setup();
    await s.service.estimate(rect(['basemap']));
    const reads = s.remote.reads.length;
    await s.service.estimate(rect(['basemap'], 13, [-89.01, 39.8, -88.9, 39.87]));
    expect(s.remote.reads.length).toBeGreaterThan(reads);
  });

  it('refuses to start without room for the download and the margin', async () => {
    const s = await setup();
    const request = rect(['basemap']);
    const est = await s.service.estimate(request);
    s.free.bytes = est.bytes + SPACE_MARGIN_BYTES - 1;
    const e = await s.service.start(request, 'x').catch((err: unknown) => err);
    expect(e).toBeInstanceOf(NotEnoughSpaceError);
    expect(e).toMatchObject({ code: 'no-space', neededBytes: est.bytes + SPACE_MARGIN_BYTES, freeBytes: est.bytes + SPACE_MARGIN_BYTES - 1 });
    expect(s.service.areas()).toHaveLength(0);
    s.free.bytes = est.bytes + SPACE_MARGIN_BYTES;
    await expect(s.service.start(request, 'x')).resolves.toMatch(/^a/);
  });

  it('refuses to start when there is nothing to download', async () => {
    const s = await setup();
    await expect(s.service.start(rect(['publicland']), 'x')).rejects.toBeInstanceOf(NothingToDownloadError);
    await expect(s.service.start(county(['basemap'], 13, 'il-nowhere'), 'x')).rejects.toMatchObject({ code: 'nothing' });
  });

  it('refuses to start with no connection', async () => {
    const s = await setup();
    s.network.set(false);
    await expect(s.service.start(county(['basemap']), 'x')).rejects.toBeInstanceOf(OfflineError);
  });
});

describe('the area list', () => {
  it('lists areas newest first, follows progress, and says when the map must load again', async () => {
    const s = await setup();
    const changes: number[] = [];
    s.service.onArchivesChanged(() => changes.push(s.service.areas().length));
    const seen: AreaStatus[] = [];
    s.service.onAreas((list) => list[0] && seen.push(list[0].status));
    const first = await s.service.start(county(['publicland']), 'First');
    await until(s.service, first, 'complete');
    s.clock.t += 60_000;
    const second = await s.service.start(rect(['basemap']), 'Second');
    await until(s.service, second, 'complete');
    expect(s.service.areas().map((a) => a.record.name)).toEqual(['Second', 'First']);
    expect(seen).toContain('downloading');
    expect(changes).toEqual([1, 2]);

    await s.service.remove(first);
    expect(s.service.areas().map((a) => a.record.name)).toEqual(['Second']);
    expect(changes).toEqual([1, 2, 1]);
    expect(s.jobs.completedArchives().every((e) => e.area === second)).toBe(true);
  });

  it('lists areas the downloader already had when the service starts, with no change event', async () => {
    const s = await setup();
    const id = await s.service.start(county(['publicland']), 'Kept');
    await until(s.service, id, 'complete');
    const again = createDownloadService({ remote: s.remote, jobs: s.jobs, network: s.network }, { catalogUrl: CATALOG_URL, storage: s.storage });
    const changed = vi.fn();
    again.onArchivesChanged(changed);
    await again.ready;
    expect(again.areas().map((a) => a.record.name)).toEqual(['Kept']);
    expect(changed).not.toHaveBeenCalled();
  });

  it('tolerates a record that does not parse', async () => {
    const s = await setup();
    const hosted = s.hosted.bytes.get(`${BASE}il-macon.publicland.pmtiles`)!;
    const meta = JSON.stringify(s.hosted.catalog.archives.find((a) => a.layer === 'publicland')!.meta);
    await s.jobs.start({ id: 'a000000001-broken00', record: 'not json', files: [{ county: 'il-macon', layer: 'publicland', url: `${BASE}il-macon.publicland.pmtiles`, head: new Uint8Array(0), ranges: [{ offset: 0, length: hosted.length }], bytes: hosted.length, meta }] });
    const v = await until(s.service, 'a000000001-broken00', 'complete');
    expect(v.record).toMatchObject({ id: 'a000000001-broken00', name: '', layers: [] });
    await s.service.remove('a000000001-broken00');
    expect(s.service.areas()).toHaveLength(0);
  });

  it('passes the network state through', async () => {
    const s = await setup();
    const states: boolean[] = [];
    s.service.onNetwork((n) => states.push(n.online));
    s.network.set(false);
    expect(s.service.network()).toEqual({ online: false, metered: false });
    s.network.set(true, true);
    expect(s.service.network()).toEqual({ online: true, metered: true });
    expect(states).toEqual([false, true]);
  });
});

describe('pause, resume, remove and failures', () => {
  /** Holds every read at a gate until it is opened. */
  function hold(s: Setup): { open(): void; reached: Promise<void> } {
    let open: () => void = () => {};
    let reached: () => void = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const reachedP = new Promise<void>((r) => (reached = r));
    s.remote.beforeRead = () => {
      reached();
      return gate;
    };
    return {
      open: () => {
        s.remote.beforeRead = null;
        open();
      },
      reached: reachedP,
    };
  }

  it('pauses and goes on from where it was', async () => {
    const s = await setup();
    const request = county(['basemap']);
    const id = await s.service.start(request, 'x');
    await until(s.service, id, 'complete');
    const fullReads = s.remote.reads.length;
    await s.service.remove(id);

    s.remote.reads.length = 0;
    // Let a few pieces through, then hold.
    let count = 0;
    let open: () => void = () => {};
    const gate = new Promise<void>((r) => (open = r));
    s.remote.beforeRead = () => (++count > 3 ? gate : undefined);
    const again = await s.service.start(request, 'x');
    await until(s.service, again, 'downloading');
    await vi.waitFor(() => expect(count).toBeGreaterThan(3));
    await s.service.pause(again);
    expect(view(s.service, again)!.status).toBe('paused');
    const doneBefore = view(s.service, again)!.bytesDone;
    expect(doneBefore).toBeGreaterThan(0);
    s.remote.beforeRead = null;
    open();
    await s.service.resume(again);
    const v = await until(s.service, again, 'complete');
    expect(v.bytesDone).toBe(v.bytesTotal);
    // Nothing was fetched twice.
    expect(s.remote.reads.length).toBe(fullReads);
    expect(s.jobs.fileBytes(again, 0)).toEqual(s.hosted.bytes.get(`${BASE}il-macon.basemap.pmtiles`));
  });

  it('removes an area in the middle of its download, with no change to the map', async () => {
    const s = await setup();
    const changed = vi.fn();
    s.service.onArchivesChanged(changed);
    const g = hold(s);
    const id = await s.service.start(county(['basemap']), 'x');
    await g.reached;
    await s.service.remove(id);
    g.open();
    expect(s.service.areas()).toHaveLength(0);
    expect(await s.jobs.list()).toHaveLength(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it('runs one area at a time, the next one queued', async () => {
    const s = await setup();
    const g = hold(s);
    const a = await s.service.start(county(['basemap']), 'a');
    s.clock.t += 1000;
    const b = await s.service.start(county(['publicland']), 'b');
    await g.reached;
    expect(view(s.service, b)!.status).toBe('queued');
    g.open();
    await until(s.service, a, 'complete');
    await until(s.service, b, 'complete');
  });

  it('waits with no connection and goes on by itself when it is back', async () => {
    const s = await setup();
    let count = 0;
    s.remote.beforeRead = () => {
      if (++count === 3) {
        s.remote.online = false;
        s.network.set(false);
      }
    };
    const id = await s.service.start(county(['basemap']), 'x');
    await until(s.service, id, 'waiting');
    s.remote.online = true;
    s.network.set(true);
    const v = await until(s.service, id, 'complete');
    expect(s.jobs.fileBytes(id, 0)).toEqual(s.hosted.bytes.get(`${BASE}il-macon.basemap.pmtiles`));
    expect(v.error).toBeUndefined();
  });

  it("fails with 'changed' when the hosted file's ETag changes", async () => {
    const s = await setup();
    const request = rect(['basemap']);
    await s.service.estimate(request);
    const url = `${BASE}il-macon.basemap.pmtiles`;
    s.remote.files.set(url, bytesFile(s.hosted.bytes.get(url)!, '"another"'));
    const id = await s.service.start(request, 'x');
    expect(await until(s.service, id, 'failed', 'complete')).toMatchObject({ status: 'failed', error: 'changed' });
    expect(s.jobs.completedArchives()).toHaveLength(0);
  });

  it("fails with 'server' when the file is gone", async () => {
    const s = await setup();
    s.remote.files.delete(`${BASE}il-macon.basemap.pmtiles`);
    const id = await s.service.start(county(['basemap']), 'x');
    expect(await until(s.service, id, 'failed', 'complete')).toMatchObject({ status: 'failed', error: 'server' });
  });

  it("fails with 'corrupt' when a whole file does not match its checksum", async () => {
    const hosted = await makeRelease(undefined, undefined, (a) => {
      if (a.layer === 'publicland') a.sha256 = '0'.repeat(64);
    });
    const s = await setup(hosted);
    const id = await s.service.start(county(['publicland']), 'x');
    expect(await until(s.service, id, 'failed', 'complete')).toMatchObject({ status: 'failed', error: 'corrupt' });
    expect(s.jobs.completedArchives()).toHaveLength(0);
  });
});

describe('coverage outlines', () => {
  // An outline over the west half of the county.
  const WEST: CatalogArchive['meta']['coverage'] = {
    type: 'Polygon',
    coordinates: [
      [
        [-89.2179, 39.6526],
        [-88.95, 39.6526],
        [-88.95, 40.0554],
        [-89.2179, 40.0554],
        [-89.2179, 39.6526],
      ],
    ],
  };
  const layers: LayerSpec[] = [{ layer: 'basemap', minzoom: 0, maxzoom: 11, coverage: WEST }];

  it("an area's copy carries the outline cut to the rectangle", async () => {
    const s = await setup(await makeRelease(undefined, layers));
    const id = await s.service.start(rect(['basemap']), 'x');
    await until(s.service, id, 'complete');
    const meta = s.jobs.completedArchives()[0]!.meta;
    expect(meta.coverage).toBeDefined();
    const cover = new CoverageArea(meta.coverage!);
    expect(cover.contains(-88.97, 39.83)).toBe(true); // in the box and the outline
    expect(cover.contains(-88.92, 39.83)).toBe(false); // in the box, east of the outline
    expect(cover.contains(-89.1, 39.83)).toBe(false); // in the outline, west of the box
    const [w, s0, e, n] = cover.bbox;
    expect([w, s0, e, n]).toEqual([BOX[0], BOX[1], -88.95, BOX[3]]);
  });

  it('a rectangle outside the outline leaves the layer out, with no read', async () => {
    const s = await setup(await makeRelease(undefined, layers));
    const est = await s.service.estimate(rect(['basemap'], 13, [-88.9, 39.8, -88.8, 39.87]));
    expect(est).toEqual({ bytes: 0, layers: [], missing: ['basemap'] });
    expect(s.remote.reads).toHaveLength(0);
  });

  it('a whole county keeps the outline as it is', async () => {
    const s = await setup(await makeRelease(undefined, layers));
    const id = await s.service.start(county(['basemap']), 'x');
    await until(s.service, id, 'complete');
    expect(s.jobs.completedArchives()[0]!.meta.coverage).toEqual(WEST);
  });
});

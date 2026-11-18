// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The download manager against the release staged on this machine by
// `pipeline/publish.py stage` (never committed). Skipped when it is not there.
// The release holds no parcel data (publish.py refuses it), and this test
// checks that before it reads anything.

import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { MemoryDownloadJobs } from '../platform/memory-download-jobs';
import { parseCatalogText } from './catalog';
import type { AreaStatus, AreaView } from './contract';
import { checkExtract } from './extract-check';
import { planExtract } from './extract-planner';
import { ReadCache } from './remote-source';
import { createDownloadService, type DownloadManager } from './service';
import { memorySource } from './test-archive';
import { diskSource, fs, joinPath, localPath } from './test-node';
import { MemoryRemote, TestNetwork, memoryStorage } from './test-platform';

const STAGED = localPath('../../../data/publish/data-2026-11-17-test');
const CATALOG = STAGED && joinPathSafe(STAGED, 'catalog.json');
const present = !!CATALOG && !!fs?.existsSync(CATALOG);

function joinPathSafe(a: string, b: string): string | undefined {
  try {
    return joinPath(a, b);
  } catch {
    return undefined;
  }
}

/** A square of `km` kilometres around a point. */
function box(lng: number, lat: number, km: number): Bounds {
  const dLat = km / 2 / 111.32;
  const dLng = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function until(service: DownloadManager, id: string, ...statuses: AreaStatus[]): Promise<AreaView> {
  return new Promise((resolve) => {
    const check = () => {
      const v = service.areas().find((a) => a.record.id === id);
      if (v && statuses.includes(v.status)) {
        off();
        resolve(v);
      }
    };
    const off = service.onAreas(check);
    check();
  });
}

describe.skipIf(!present)('the manager against the staged release', () => {
  const text = present ? fs!.readFileSync(CATALOG!, 'utf8') : '{}';

  // The test server serves the catalog beside the files: the same http origin,
  // the one case where a catalog outside development may name an http base.
  const catalogUrlFor = (base: string) => new URL('/catalog.json', base).href;

  function setup(readCache?: ReadCache) {
    const raw = JSON.parse(text) as { base: string };
    const CATALOG_URL = catalogUrlFor(raw.base);
    const catalog = parseCatalogText(text, { allowHttp: false, catalogUrl: CATALOG_URL });
    expect(catalog.archives.some((a) => a.layer === 'parcels' || a.file.includes('parcel'))).toBe(false);
    const remote = new MemoryRemote();
    remote.texts.set(CATALOG_URL, text);
    const opened: { close(): void }[] = [];
    for (const a of catalog.archives) {
      const disk = diskSource(joinPath(STAGED!, a.file));
      opened.push(disk);
      remote.files.set(catalog.base + a.file, {
        size: disk.size,
        etag: '"staged"',
        read: async (o, n) => new Uint8Array((await disk.getBytes(o, n)).data),
      });
    }
    const network = new TestNetwork();
    const jobs = new MemoryDownloadJobs({ remote, network, progressMs: 0 });
    const service = createDownloadService({ remote, jobs, network }, { catalogUrl: CATALOG_URL, storage: memoryStorage(), allowHttp: false, ...(readCache ? { readCache } : {}) });
    return { catalog, remote, jobs, service, close: () => opened.forEach((d) => d.close()) };
  }

  it('a 2 km box of Macon County: the download is the estimate to the byte, and every tile matches', async () => {
    const s = setup();
    try {
      const macon = s.catalog.archives.find((a) => a.county === 'il-macon' && a.layer === 'basemap')!.meta.bounds;
      const area = box((macon[0] + macon[2]) / 2, (macon[1] + macon[3]) / 2, 2);
      const request = { where: { bounds: area }, layers: ['basemap', 'aerial', 'publicland'], aerialMaxzoom: 14 };
      const est = await s.service.estimate(request);
      const planningReads = s.remote.reads.length;
      const id = await s.service.start(request, 'Test box');
      const done = await until(s.service, id, 'complete', 'failed');
      expect(done.status).toBe('complete');
      expect(done.bytesDone).toBe(est.bytes);

      const entries = s.jobs.completedArchives();
      expect(entries.map((e) => e.layer).sort()).toEqual(est.layers.map((l) => l.layer).sort());
      for (const entry of entries) {
        const hosted = s.catalog.archives.find((a) => a.county === entry.county && a.layer === entry.layer)!;
        const source = diskSource(joinPath(STAGED!, hosted.file));
        try {
          const ask = { bounds: area, ...(entry.layer === 'aerial' ? { maxzoom: 14 } : {}) };
          const plan = await planExtract(source, ask);
          const i = est.layers.findIndex((l) => l.layer === entry.layer);
          const written = s.jobs.fileBytes(id, i)!;
          expect(written.length).toBe(est.layers[i]!.bytes);
          await checkExtract(source, memorySource(written), plan, ask);
          expect(entry.meta.maxzoom).toBe(plan.maxzoom);
        } finally {
          source.close();
        }
      }
      console.log(
        `staged release, 2 km box: ${est.layers.map((l) => `${l.layer} ${l.bytes} bytes, ${l.tiles} tiles`).join('; ')}; ` +
          `${planningReads} planning reads, ${s.remote.reads.length - planningReads} download reads`,
      );
    } finally {
      s.close();
    }
  }, 120000);

  it('a whole county of public land: the hosted file whole, its checksum checked', async () => {
    const s = setup();
    try {
      const request = { where: { county: 'il-macon' }, layers: ['publicland'], aerialMaxzoom: 16 };
      const est = await s.service.estimate(request);
      expect(s.remote.reads).toHaveLength(0);
      const id = await s.service.start(request, '');
      const done = await until(s.service, id, 'complete', 'failed');
      expect(done.status).toBe('complete');
      expect(done.bytesDone).toBe(est.bytes);
      expect(done.record.name).toBe(s.catalog.archives.find((a) => a.county === 'il-macon')!.meta.countyName);
    } finally {
      s.close();
    }
  }, 120000);

  it('moving the frame around the county reads each directory once (S3)', async () => {
    const counts: Record<string, number[]> = {};
    for (const [label, cache] of [['kept', undefined], ['not kept', new ReadCache(0)]] as const) {
      const s = setup(cache);
      try {
        const macon = s.catalog.archives.find((a) => a.county === 'il-macon' && a.layer === 'aerial')!.meta.bounds;
        const cx = (macon[0] + macon[2]) / 2;
        const cy = (macon[1] + macon[3]) / 2;
        // A 3 km frame panned east in steps of 1 km, then back to where it began.
        const step = 1 / (111.32 * Math.cos((cy * Math.PI) / 180));
        const frames = [0, 1, 2, 3, 0].map((k) => box(cx + k * step, cy, 3));
        const per: number[] = [];
        for (const f of frames) {
          const before = s.remote.reads.length;
          await s.service.estimate({ where: { bounds: f }, layers: ['basemap', 'aerial'], aerialMaxzoom: 16 });
          per.push(s.remote.reads.length - before);
        }
        counts[label] = per;
      } finally {
        s.close();
      }
    }
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    console.log(`staged release, 5 estimates of a panned 3 km frame: ${sum(counts['not kept']!)} reads with nothing kept (${counts['not kept']!.join(', ')}), ${sum(counts['kept']!)} with reads kept (${counts['kept']!.join(', ')})`);
    expect(sum(counts['kept']!)).toBeLessThan(sum(counts['not kept']!));
    expect(counts['kept']![4]).toBe(0);
  }, 120000);
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The download manager against the files really published on GitHub, as
// catalog/catalog.json names them. It makes real requests, so it runs only
// when asked:
//
//   MAPAPP_CHECK_HOSTED=1 npx vitest run src/downloads/hosted-release.test.ts
//
// It needs the same release staged on this machine (data/publish/<release>/),
// to compare what arrives with what was sent. It answers what the laptop's
// stand-in server could only copy (D33): does the real host answer byte ranges
// through its redirect, with a steady ETag, many times in a row.

import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { fetchRemoteFiles } from '../platform/browser-downloads';
import { MemoryDownloadJobs } from '../platform/memory-download-jobs';
import { parseCatalogText } from './catalog';
import type { AreaStatus, AreaView } from './contract';
import { checkExtract } from './extract-check';
import { planExtract } from './extract-planner';
import { createDownloadService, type DownloadManager } from './service';
import { memorySource } from './test-archive';
import { diskSource, fs, joinPath, localPath } from './test-node';
import { TestNetwork, memoryStorage } from './test-platform';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const CATALOG_FILE = localPath('../../../catalog/catalog.json');
const asked = env['MAPAPP_CHECK_HOSTED'] === '1';
const present = asked && !!CATALOG_FILE && !!fs?.existsSync(CATALOG_FILE);

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

describe.skipIf(!present)('the manager against the published release', () => {
  const text = present ? fs!.readFileSync(CATALOG_FILE!, 'utf8') : '{"release":""}';
  const release = (JSON.parse(text) as { release: string }).release;
  const STAGED = localPath(`../../../data/publish/${release}`);
  const CATALOG_URL = 'https://raw.githubusercontent.com/example/example/main/catalog/catalog.json';

  function setup() {
    const catalog = parseCatalogText(text, { allowHttp: false, catalogUrl: CATALOG_URL });
    expect(catalog.base.startsWith('https://github.com/')).toBe(true);
    expect(catalog.archives.some((a) => a.layer === 'parcels' || a.file.includes('parcel'))).toBe(false);
    const direct = fetchRemoteFiles((url) => url);
    const reads: string[] = [];
    // The catalog is read from this machine's copy; everything else is the real host.
    const remote = {
      text: async (url: string, signal?: AbortSignal) => (url === CATALOG_URL ? text : direct.text(url, signal)),
      read: async (url: string, offset: number, length: number, signal?: AbortSignal) => {
        reads.push(`${url.split('/').pop()} ${offset}+${length}`);
        return direct.read(url, offset, length, signal);
      },
    };
    const network = new TestNetwork();
    const jobs = new MemoryDownloadJobs({ remote, network, progressMs: 0 });
    const service = createDownloadService({ remote, jobs, network }, { catalogUrl: CATALOG_URL, storage: memoryStorage(), allowHttp: false });
    return { catalog, reads, jobs, service };
  }

  it('the host redirects to a signed address that answers a byte range, with a steady ETag', async () => {
    const { catalog } = setup();
    const a = catalog.archives.find((x) => x.layer === 'publicland')!;
    const url = catalog.base + a.file;
    const seen: { host: string; status: number; range: string | null; etag: string | null; encoding: string | null }[] = [];
    for (let i = 0; i < 2; i++) {
      const first = await fetch(url, { redirect: 'manual', headers: { Range: 'bytes=0-126' } });
      expect([301, 302, 303, 307, 308]).toContain(first.status);
      const signed = first.headers.get('location')!;
      const res = await fetch(signed, { headers: { Range: 'bytes=0-126', 'Accept-Encoding': 'identity' } });
      const body = new Uint8Array(await res.arrayBuffer());
      expect(res.status).toBe(206);
      expect(body.length).toBe(127);
      expect(new TextDecoder().decode(body.subarray(0, 7))).toBe('PMTiles');
      seen.push({
        host: new URL(signed).host,
        status: res.status,
        range: res.headers.get('content-range'),
        etag: res.headers.get('etag'),
        encoding: res.headers.get('content-encoding'),
      });
    }
    console.log('published release, two signed addresses:', JSON.stringify(seen));
    expect(seen[0]!.range).toBe(`bytes 0-126/${a.bytes}`);
    expect(seen[0]!.etag).toBeTruthy();
    expect(seen[1]!.etag).toBe(seen[0]!.etag);
  }, 60000);

  it('a 3 km box with imagery at full detail arrives as estimated, and every tile matches the staged files', async () => {
    const s = setup();
    const area = box(-89.06, 39.915, 3);
    const request = { where: { bounds: area }, layers: ['basemap', 'aerial', 'publicland'], aerialMaxzoom: 16 };
    const t0 = Date.now();
    const est = await s.service.estimate(request);
    const planningReads = s.reads.length;
    const t1 = Date.now();
    const id = await s.service.start(request, 'Hosted box');
    const done = await until(s.service, id, 'complete', 'failed');
    const t2 = Date.now();
    expect(done.status).toBe('complete');
    expect(done.bytesDone).toBe(est.bytes);
    for (const entry of s.jobs.completedArchives()) {
      const hosted = s.catalog.archives.find((a) => a.county === entry.county && a.layer === entry.layer)!;
      const source = diskSource(joinPath(STAGED!, hosted.file));
      try {
        const ask = { bounds: area, ...(entry.layer === 'aerial' ? { maxzoom: 16 } : {}) };
        const plan = await planExtract(source, ask);
        const i = est.layers.findIndex((l) => l.layer === entry.layer);
        const written = s.jobs.fileBytes(id, i)!;
        expect(written.length).toBe(est.layers[i]!.bytes);
        await checkExtract(source, memorySource(written), plan, ask);
      } finally {
        source.close();
      }
    }
    console.log(
      `published release, 3 km box: ${est.bytes} bytes (${est.layers.map((l) => `${l.layer} ${l.bytes}`).join(', ')}); ` +
        `${planningReads} planning reads in ${t1 - t0} ms, ${s.reads.length - planningReads} download reads in ${t2 - t1} ms`,
    );
  }, 300000);

  it('a whole county of map and public land arrives whole, checksums checked', async () => {
    const s = setup();
    const request = { where: { county: 'il-macon' }, layers: ['basemap', 'publicland'], aerialMaxzoom: 16 };
    const est = await s.service.estimate(request);
    const t0 = Date.now();
    const id = await s.service.start(request, '');
    const done = await until(s.service, id, 'complete', 'failed');
    expect(done.status).toBe('complete');
    expect(done.bytesDone).toBe(est.bytes);
    console.log(`published release, Macon County map and public land: ${est.bytes} bytes in ${Date.now() - t0} ms, ${s.reads.length} reads`);
  }, 300000);
});

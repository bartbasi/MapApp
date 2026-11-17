// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG_URL, buildCatalogUrl, loadStoredCatalog, parseCatalog, parseCatalogText } from './catalog';
import { fs, localPath } from './test-node';
import { memoryStorage, testMeta } from './test-platform';

const SHA = 'a'.repeat(64);

function good(): Record<string, unknown> {
  return {
    schema: 1,
    release: 'data-2026-11-17',
    published: '2026-11-17',
    base: 'https://github.com/example/maps/releases/download/data-2026-11-17/',
    archives: [
      { county: 'il-macon', layer: 'basemap', file: 'il-macon.basemap.pmtiles', bytes: 1000, sha256: SHA, meta: testMeta('il-macon', 'basemap', { bounds: [-89.2, 39.6, -88.7, 40.1], minzoom: 0, maxzoom: 15, bytes: 1000 }) },
      { county: 'il-macon', layer: 'aerial', file: 'il-macon.aerial.pmtiles', bytes: 2000, sha256: SHA, meta: testMeta('il-macon', 'aerial', { bounds: [-89.2, 39.6, -88.7, 40.1], minzoom: 7, maxzoom: 16, bytes: 2000 }) },
    ],
  };
}

/** The good catalog with one change made by `edit`. */
function bad(edit: (c: Record<string, unknown>, a: Record<string, unknown>) => void): unknown {
  const c = good();
  edit(c, (c['archives'] as Record<string, unknown>[])[0]!);
  return c;
}

describe('catalog checking', () => {
  it('accepts a catalog as publish.py writes it', () => {
    const c = parseCatalog(good());
    expect(c.release).toBe('data-2026-11-17');
    expect(c.archives.map((a) => `${a.county}/${a.layer}`)).toEqual(['il-macon/basemap', 'il-macon/aerial']);
    expect(c.archives[1]!.meta.minzoom).toBe(7);
  });

  it('accepts an http base, for the test server', () => {
    expect(parseCatalog(bad((c) => (c['base'] = 'http://10.0.2.2:8765/'))).base).toBe('http://10.0.2.2:8765/');
  });

  const refusals: [string, (c: Record<string, unknown>, a: Record<string, unknown>) => void][] = [
    ['a schema other than 1', (c) => (c['schema'] = 2)],
    ['no release', (c) => delete c['release']],
    ['a release tag with a slash', (c) => (c['release'] = 'a/b')],
    ['a base with no slash at the end', (c) => (c['base'] = 'https://example.org/x')],
    ['a base that is not http', (c) => (c['base'] = 'ftp://example.org/x/')],
    ['a base that is not an address', (c) => (c['base'] = 'files/')],
    ['a base with a query', (c) => (c['base'] = 'https://example.org/?a=/')],
    ['archives that are not a list', (c) => (c['archives'] = {})],
    ['a county ID with capitals', (_c, a) => (a['county'] = 'IL-Macon')],
    ['a layer name with a dot', (_c, a) => (a['layer'] = 'base.map')],
    ['a file name with a slash', (_c, a) => (a['file'] = 'x/il-macon.basemap.pmtiles')],
    ['a file name with a backslash', (_c, a) => (a['file'] = 'x\\y.pmtiles')],
    ['a file name of ..', (_c, a) => (a['file'] = '..')],
    ['a file name with ..', (_c, a) => (a['file'] = 'a..pmtiles')],
    ['a file name with a query', (_c, a) => (a['file'] = 'a.pmtiles?x=1')],
    ['a size of zero', (_c, a) => (a['bytes'] = 0)],
    ['a size that is not whole', (_c, a) => (a['bytes'] = 10.5)],
    ['a checksum that is not hex', (_c, a) => (a['sha256'] = 'z'.repeat(64))],
    ['metadata that does not parse', (_c, a) => (a['meta'] = { kind: 'vector' })],
    ['metadata naming another county', (_c, a) => (a['meta'] = { ...(a['meta'] as object), county: 'il-champaign' })],
    ['metadata giving another size', (_c, a) => (a['meta'] = { ...(a['meta'] as object), bytes: 999 })],
    ['bounds that are not an area', (_c, a) => (a['meta'] = { ...(a['meta'] as object), bounds: [1, 1, 1, 1] })],
    ['a zoom range upside down', (_c, a) => (a['meta'] = { ...(a['meta'] as object), minzoom: 16, maxzoom: 7 })],
    [
      'the same county and layer twice',
      (c) => {
        const list = c['archives'] as Record<string, unknown>[];
        list.push({ ...list[0]!, file: 'other.pmtiles' });
      },
    ],
    [
      'two archives with one file name',
      (c) => {
        const list = c['archives'] as Record<string, unknown>[];
        list[1]!['file'] = list[0]!['file'];
      },
    ],
  ];
  for (const [what, edit] of refusals) {
    it(`refuses ${what}`, () => {
      expect(() => parseCatalog(bad(edit))).toThrow(/^catalog: /);
    });
  }

  it('refuses text that is not JSON', () => {
    expect(() => parseCatalogText('<html>')).toThrow('catalog: not JSON');
  });
});

describe('the stored catalog', () => {
  it('is used when it still checks out', () => {
    expect(loadStoredCatalog(memoryStorage(JSON.stringify(good())))?.release).toBe('data-2026-11-17');
  });

  it('is ignored when missing or damaged', () => {
    expect(loadStoredCatalog(memoryStorage(null))).toBeNull();
    expect(loadStoredCatalog(memoryStorage('{"schema":1'))).toBeNull();
    expect(loadStoredCatalog(memoryStorage(JSON.stringify(bad((c) => (c['schema'] = 9)))))).toBeNull();
  });
});

describe('the catalog address', () => {
  it('is the repository catalog unless the build sets another', () => {
    expect(DEFAULT_CATALOG_URL).toBe('https://raw.githubusercontent.com/bartbasi/MapApp/main/catalog/catalog.json');
    const set = import.meta.env.VITE_MAPAPP_CATALOG_URL as string | undefined;
    expect(buildCatalogUrl()).toBe(set?.trim() || DEFAULT_CATALOG_URL);
  });
});

// The catalog the pipeline really wrote, when it has been staged on this machine.
const staged = localPath('../../../data/publish/data-2026-11-17-test/catalog.json');
const haveStaged = !!staged && !!fs?.existsSync(staged);

describe.skipIf(!haveStaged)('the staged catalog from publish.py', () => {
  it('passes the app\'s checks and lists no parcel data', () => {
    const c = parseCatalogText(fs!.readFileSync(staged!, 'utf8'));
    expect(c.archives.length).toBeGreaterThan(0);
    expect(c.archives.some((a) => a.layer === 'parcels' || a.file.includes('parcel'))).toBe(false);
  });
});

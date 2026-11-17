// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The catalog of hosted archives (catalog.json, written by pipeline/publish.py):
// strict checking, and the copy kept on the phone so the offers can be shown
// with no connection once the catalog has been fetched one time.

import { ARCHIVE_ID_PATTERN, parseArchiveMeta } from '../platform/archive-meta';
import type { Catalog, CatalogArchive } from './contract';

/** Where the app fetches the catalog unless the build says otherwise (D33). */
export const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/bartbasi/MapApp/main/catalog/catalog.json';

/** The catalog address this build uses: VITE_MAPAPP_CATALOG_URL when it was set at build time. */
export function buildCatalogUrl(): string {
  const set = import.meta.env?.VITE_MAPAPP_CATALOG_URL as string | undefined;
  return set && set.trim() ? set.trim() : DEFAULT_CATALOG_URL;
}

/** A release tag: letters, digits, dots, underscores and hyphens. */
const RELEASE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
/** A file name under the base address: no slashes, no "..", nothing that changes the address. */
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`catalog: ${message}`);
}

function isHttpBase(base: string): boolean {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && base.endsWith('/') && url.search === '' && url.hash === '' && url.username === '' && url.password === '';
}

function parseArchive(raw: unknown, i: number): CatalogArchive {
  if (typeof raw !== 'object' || raw === null) fail(`archive ${i} is not an object`);
  const o = raw as Record<string, unknown>;
  const { county, layer, file, bytes, sha256 } = o;
  if (typeof county !== 'string' || !ARCHIVE_ID_PATTERN.test(county)) fail(`archive ${i} has no valid county ID`);
  if (typeof layer !== 'string' || !ARCHIVE_ID_PATTERN.test(layer)) fail(`archive ${i} has no valid layer name`);
  const where = `${county}/${layer}`;
  if (typeof file !== 'string' || !FILE_PATTERN.test(file) || file.includes('..')) fail(`${where}: the file name is not a plain file name`);
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) fail(`${where}: the size is not a positive whole number`);
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) fail(`${where}: the checksum is not a SHA-256 in hex`);
  let meta;
  try {
    meta = parseArchiveMeta(o['meta']);
  } catch (e) {
    fail(`${where}: ${(e as Error).message}`);
  }
  if (meta.county !== county || meta.layer !== layer) fail(`${where}: the metadata names ${meta.county}/${meta.layer}`);
  if (meta.bytes !== bytes) fail(`${where}: the metadata says ${meta.bytes} bytes, the catalog ${bytes}`);
  const [w, s, e, n] = meta.bounds;
  if (!(w < e && s < n && w >= -180 && e <= 180 && s >= -90 && n <= 90)) fail(`${where}: the bounds are not an area`);
  if (!(Number.isInteger(meta.minzoom) && Number.isInteger(meta.maxzoom) && meta.minzoom >= 0 && meta.minzoom <= meta.maxzoom && meta.maxzoom <= 30)) {
    fail(`${where}: the zoom range is not valid`);
  }
  return { county, layer, file, bytes, sha256, meta };
}

/**
 * Checks a parsed catalog.json and returns it typed. Throws on anything that
 * does not match, so a damaged or tampered catalog is never half used.
 */
export function parseCatalog(raw: unknown): Catalog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('not an object');
  const o = raw as Record<string, unknown>;
  if (o['schema'] !== 1) fail(`schema ${String(o['schema'])} is not one this app reads`);
  const { release, published, base, archives } = o;
  if (typeof release !== 'string' || !RELEASE_PATTERN.test(release)) fail('the release tag is missing or not valid');
  if (typeof published !== 'string') fail('the publish date is missing');
  if (typeof base !== 'string' || !isHttpBase(base)) fail('the base address must be http or https and end with a slash');
  if (!Array.isArray(archives)) fail('the archives must be a list');
  const out = archives.map(parseArchive);
  const seen = new Set<string>();
  for (const a of out) {
    const key = `${a.county}/${a.layer}`;
    if (seen.has(key)) fail(`${key} is listed twice`);
    seen.add(key);
  }
  const files = new Set(out.map((a) => a.file));
  if (files.size !== out.length) fail('two archives share a file name');
  return { schema: 1, release, published, base, archives: out };
}

/** Parses catalog text. Throws with a plain message when it is not JSON or not a valid catalog. */
export function parseCatalogText(text: string): Catalog {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('not JSON');
  }
  return parseCatalog(raw);
}

/** Where the last good catalog is kept between runs. */
export interface CatalogStorage {
  load(): string | null;
  save(text: string): void;
}

const STORAGE_KEY = 'mapapp.downloads.catalog';

/** The browser's local storage, when there is one. Failures are ignored: the copy is a convenience. */
export const localCatalogStorage: CatalogStorage = {
  load() {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  save(text) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, text);
    } catch {
      // Storage full or not allowed: the catalog is fetched again next time.
    }
  },
};

/** The stored catalog, or null when there is none or it no longer checks out. */
export function loadStoredCatalog(storage: CatalogStorage): Catalog | null {
  const text = storage.load();
  if (!text) return null;
  try {
    return parseCatalogText(text);
  } catch {
    return null;
  }
}

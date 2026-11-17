// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test helpers: platform parts for the download manager that live in memory.
// A hosted file is either bytes in memory or a reader over a file on disk.

import { RemoteStatusError } from '../platform/memory-download-jobs';
import type { ArchiveMeta } from '../platform/archive-meta';
import type { Bounds } from '../map/tile-math';
import type { CatalogStorage } from './catalog';
import type { Catalog, Network, NetworkState, RemoteFiles, RemoteRead } from './contract';
import type { ByteRange } from './download-plan';

export interface HostedFile {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  etag?: string;
}

export function bytesFile(bytes: Uint8Array, etag?: string): HostedFile {
  return { size: bytes.length, read: async (o, n) => bytes.slice(o, o + n), ...(etag !== undefined ? { etag } : {}) };
}

/**
 * RemoteFiles over files held by address. It answers as a release host does:
 * exactly the bytes asked for, with the file's ETag and full size. It can be
 * taken offline, and can fail chosen reads.
 */
export class MemoryRemote implements RemoteFiles {
  readonly files = new Map<string, HostedFile>();
  readonly texts = new Map<string, string>();
  /** Every range read, by address. */
  readonly reads: { url: string; range: ByteRange }[] = [];
  textReads = 0;
  online = true;
  /** Called before each range read; may throw to fail it, or wait to slow it. */
  beforeRead: ((url: string, offset: number, length: number) => void | Promise<void>) | null = null;

  async text(url: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    if (!this.online) throw new TypeError('network unreachable');
    this.textReads++;
    const t = this.texts.get(url);
    if (t === undefined) throw new RemoteStatusError(404, `${url} answered 404`);
    return t;
  }

  async read(url: string, offset: number, length: number, signal?: AbortSignal): Promise<RemoteRead> {
    signal?.throwIfAborted();
    if (!this.online) throw new TypeError('network unreachable');
    await this.beforeRead?.(url, offset, length);
    signal?.throwIfAborted();
    const f = this.files.get(url);
    if (!f) throw new RemoteStatusError(404, `${url} answered 404`);
    if (length <= 0 || offset < 0 || offset + length > f.size) throw new RemoteStatusError(416, `${url}: range not satisfiable`);
    this.reads.push({ url, range: { offset, length } });
    const data = await f.read(offset, length);
    const out: RemoteRead = { data: data.slice().buffer as ArrayBuffer, totalBytes: f.size };
    if (f.etag !== undefined) out.etag = f.etag;
    return out;
  }

  rangeReads(): number {
    return this.reads.length;
  }
}

/** A network whose state the test sets. */
export class TestNetwork implements Network {
  state: NetworkState = { online: true, metered: false };
  private readonly listeners = new Set<(s: NetworkState) => void>();

  async get(): Promise<NetworkState> {
    return { ...this.state };
  }

  onChange(listener: (s: NetworkState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(online: boolean, metered = false): void {
    this.state = { online, metered };
    for (const l of [...this.listeners]) l({ ...this.state });
  }
}

export function memoryStorage(initial: string | null = null): CatalogStorage & { text: string | null; saves: number } {
  const s = {
    text: initial,
    saves: 0,
    load: () => s.text,
    save: (t: string) => {
      s.text = t;
      s.saves++;
    },
  };
  return s;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function testMeta(county: string, layer: string, o: { bounds: Bounds; minzoom: number; maxzoom: number; bytes: number; kind?: 'vector' | 'raster'; dataDate?: string; coverage?: ArchiveMeta['coverage'] }): ArchiveMeta {
  const meta: ArchiveMeta = {
    schema: 1,
    layer,
    county,
    countyName: `${county} County`,
    kind: o.kind ?? (layer === 'aerial' ? 'raster' : 'vector'),
    title: `${layer} title`,
    minzoom: o.minzoom,
    maxzoom: o.maxzoom,
    bounds: o.bounds,
    bytes: o.bytes,
    buildDate: '2026-11-17',
    sources: [{ name: 'Test source', license: 'Test license', credit: 'Test credit.', url: 'https://example.org', dataDate: o.dataDate ?? '2025-01-01' }],
    notes: '',
  };
  if (o.coverage) meta.coverage = o.coverage;
  return meta;
}

/** A catalog as publish.py writes it, as text. */
export function catalogText(c: Catalog): string {
  return JSON.stringify(c, null, 1);
}

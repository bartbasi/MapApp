// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A pmtiles byte source over the platform's reads of a hosted file, for the
// planner. It knows the file's size from the catalog, so a read past the end
// is cut short instead of being asked of the server, and it refuses a file
// whose ETag changes between reads.
//
// Reads can go through a ReadCache kept for the life of the download service.
// The planner reads only a file's header, root directory, metadata and leaf
// directories, and a release's files never change (D33), so the same read
// gives the same bytes for as long as the release is current. Moving the
// frame around then reads only the leaf directories not read before. Each
// read saved is also one trip through the release host's redirect (D15).

import type { RangeResponse, Source } from 'pmtiles';
import type { RemoteFiles, RemoteRead } from './contract';

/** The hosted file changed while it was being read. The plan must be made again. */
export class RemoteFileChangedError extends Error {
  override name = 'RemoteFileChangedError';
}

/** Rejects with the signal's reason when it aborts, without stopping the shared promise. */
export function raceAbort<T>(p: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return p;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

/** Directory reads kept by hosted file address and catalog release. */
export class ReadCache {
  /** Key to read, oldest use first (a Map keeps insertion order). */
  private readonly entries = new Map<string, { read: Promise<RemoteRead>; bytes: number }>();
  private bytes = 0;
  /** Reads that went to the platform, for tests and diagnostics. */
  misses = 0;
  hits = 0;

  /** At most this many bytes are kept; the least recently used reads go first. */
  constructor(readonly maxBytes = 16 * 1024 * 1024) {}

  /**
   * The read, from the cache or from the platform. The platform read is
   * shared by every caller and runs with no signal, so one caller's abort does
   * not fail another's; each caller waits with its own signal. A failed read
   * is not kept.
   */
  read(remote: RemoteFiles, release: string, url: string, offset: number, length: number, signal?: AbortSignal): Promise<RemoteRead> {
    const key = `${release}\n${url}\n${offset}\n${length}`;
    const found = this.entries.get(key);
    if (found) {
      this.hits++;
      this.entries.delete(key);
      this.entries.set(key, found);
      return raceAbort(found.read, signal);
    }
    this.misses++;
    const entry = { read: remote.read(url, offset, length), bytes: 0 };
    this.entries.set(key, entry);
    entry.read.then(
      (r) => {
        if (this.entries.get(key) !== entry) return;
        entry.bytes = r.data.byteLength;
        this.bytes += entry.bytes;
        this.evict();
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      },
    );
    return raceAbort(entry.read, signal);
  }

  /** Forgets every read, as when the catalog moves to a new release. */
  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  get size(): number {
    return this.bytes;
  }

  private evict(): void {
    for (const [key, e] of this.entries) {
      if (this.bytes <= this.maxBytes) return;
      if (e.bytes === 0) continue; // still on its way
      this.entries.delete(key);
      this.bytes -= e.bytes;
    }
  }
}

export interface RemoteSourceOptions {
  signal?: AbortSignal;
  /** Reads go through this cache, under this release. */
  cache?: { cache: ReadCache; release: string };
}

export class RemoteSource implements Source {
  /** The ETag of the first answer, which every later answer must match. */
  etag: string | undefined;
  reads = 0;

  constructor(
    private readonly remote: RemoteFiles,
    private readonly url: string,
    private readonly totalBytes: number,
    private readonly options: RemoteSourceOptions = {},
  ) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const stop = signal ?? this.options.signal;
    stop?.throwIfAborted();
    const n = Math.max(0, Math.min(length, this.totalBytes - offset));
    if (n === 0) return { data: new ArrayBuffer(0), ...(this.etag ? { etag: this.etag } : {}) };
    const c = this.options.cache;
    const r = c ? await c.cache.read(this.remote, c.release, this.url, offset, n, stop) : await this.remote.read(this.url, offset, n, stop);
    this.reads++;
    if (r.totalBytes !== undefined && r.totalBytes !== this.totalBytes) {
      throw new RemoteFileChangedError(`${this.url} is ${r.totalBytes} bytes, the catalog says ${this.totalBytes}`);
    }
    const expected = etag ?? this.etag;
    if (expected !== undefined && r.etag !== undefined && r.etag !== expected) {
      throw new RemoteFileChangedError(`${this.url} changed while it was read`);
    }
    this.etag ??= r.etag;
    if (r.data.byteLength !== n) throw new Error(`${this.url}: asked for ${n} bytes at ${offset}, got ${r.data.byteLength}`);
    // A copy, so a cached read is never changed by whoever uses it.
    return { data: c ? r.data.slice(0) : r.data, ...(r.etag !== undefined ? { etag: r.etag } : {}) };
  }
}

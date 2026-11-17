// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A pmtiles byte source over the platform's reads of a hosted file, for the
// planner. It knows the file's size from the catalog, so a read past the end
// is cut short instead of being asked of the server, and it refuses a file
// whose ETag changes between reads.

import type { RangeResponse, Source } from 'pmtiles';
import type { RemoteFiles } from './contract';

/** The hosted file changed while it was being read. The plan must be made again. */
export class RemoteFileChangedError extends Error {
  override name = 'RemoteFileChangedError';
}

export class RemoteSource implements Source {
  /** The ETag of the first answer, which every later answer must match. */
  etag: string | undefined;
  reads = 0;

  constructor(
    private readonly remote: RemoteFiles,
    private readonly url: string,
    private readonly totalBytes: number,
    private readonly signal?: AbortSignal,
  ) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const stop = signal ?? this.signal;
    stop?.throwIfAborted();
    const n = Math.max(0, Math.min(length, this.totalBytes - offset));
    if (n === 0) return { data: new ArrayBuffer(0), ...(this.etag ? { etag: this.etag } : {}) };
    const r = await this.remote.read(this.url, offset, n, stop);
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
    return { data: r.data, ...(r.etag !== undefined ? { etag: r.etag } : {}) };
  }
}

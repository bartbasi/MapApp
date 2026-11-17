// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A downloader that keeps finished areas in memory: the stand-in for the
// native one (contract.ts DownloadJobs) in a development browser, and the
// downloader the manager's tests run against. It does the real work: writes
// the head, fetches each range in pieces, checks the ETag, the size and the
// checksum, and can stop and go on at any byte. What it does not do is outlive
// the page: a reload forgets every area.

import type { Source } from 'pmtiles';
import type { AreaError, AreaJob, AreaState, AreaStatus, DownloadJobs, Network, RemoteFiles } from '../downloads/contract';
import { parseArchiveMeta, type ArchiveEntry } from './archive-meta';

/** A failed read that came back from the server with a status. */
export class RemoteStatusError extends Error {
  override name = 'RemoteStatusError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface MemoryDownloadJobsOptions {
  remote: RemoteFiles;
  /** When given, a lost connection makes an area wait, and a new one starts it again. */
  network?: Network;
  /** Bytes per read. Default 4 MiB. */
  chunkBytes?: number;
  /** Least time between two progress reports. Default 1000 ms. */
  progressMs?: number;
  /** Time before an area waiting for a connection tries again by itself. Default 5000 ms. */
  retryMs?: number;
  /** Free space to report, if any. */
  freeBytes?: () => Promise<number | undefined>;
  now?: () => number;
}

interface FileProgress {
  data: Uint8Array | null;
  written: number;
}

interface Area {
  job: AreaJob;
  status: AreaStatus;
  error?: AreaError;
  files: FileProgress[];
  controller: AbortController | null;
  archives: ArchiveEntry[];
}

/** Thrown inside a run to end it with a status. */
class Stop extends Error {
  constructor(
    readonly status: 'failed' | 'waiting',
    readonly error?: AreaError,
  ) {
    super(status);
  }
}

const totalOf = (job: AreaJob) => job.files.reduce((n, f) => n + f.bytes, 0);

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A byte source over an archive held in memory. */
export function memoryArchiveSource(data: Uint8Array, key: string): Source {
  return {
    getKey: () => key,
    getBytes: async (offset: number, length: number) => ({ data: data.slice(offset, Math.min(data.length, offset + length)).buffer as ArrayBuffer }),
  };
}

export class MemoryDownloadJobs implements DownloadJobs {
  private readonly areas = new Map<string, Area>();
  private readonly listeners = new Set<(s: AreaState) => void>();
  private running: Area | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly chunkBytes: number;
  private readonly progressMs: number;
  private readonly retryMs: number;
  private readonly now: () => number;
  private readonly offNetwork: (() => void) | undefined;
  private online = true;

  constructor(private readonly options: MemoryDownloadJobsOptions) {
    this.chunkBytes = options.chunkBytes ?? 4 * 1024 * 1024;
    this.progressMs = options.progressMs ?? 1000;
    this.retryMs = options.retryMs ?? 5000;
    this.now = options.now ?? (() => Date.now());
    this.offNetwork = options.network?.onChange((s) => {
      this.online = s.online;
      if (s.online) this.wakeWaiting();
    });
    void options.network?.get().then((s) => (this.online = s.online)).catch(() => {});
  }

  // ------------------------------------------------------------ DownloadJobs

  async start(job: AreaJob): Promise<void> {
    if (this.areas.has(job.id)) throw new Error(`area ${job.id} exists already`);
    // Checked now so a bad job fails at once and not when it completes.
    for (const f of job.files) parseArchiveMeta(JSON.parse(f.meta));
    const area: Area = { job, status: 'queued', files: job.files.map(() => ({ data: null, written: 0 })), controller: null, archives: [] };
    this.areas.set(job.id, area);
    this.report(area);
    this.pump();
  }

  async pause(id: string): Promise<void> {
    const area = this.areas.get(id);
    if (!area || area.status === 'complete' || area.status === 'paused') return;
    area.controller?.abort();
    this.setStatus(area, 'paused');
  }

  async resume(id: string): Promise<void> {
    const area = this.areas.get(id);
    if (!area || area.status === 'complete' || area.status === 'downloading' || area.status === 'queued') return;
    this.setStatus(area, 'queued');
    this.pump();
  }

  async remove(id: string): Promise<void> {
    const area = this.areas.get(id);
    if (!area) return;
    area.controller?.abort();
    this.areas.delete(id);
    if (this.running === area) this.running = null;
    this.pump();
  }

  async list(): Promise<AreaState[]> {
    return [...this.areas.values()].map((a) => this.state(a));
  }

  onChange(listener: (state: AreaState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async freeBytes(): Promise<number | undefined> {
    return this.options.freeBytes ? this.options.freeBytes() : undefined;
  }

  // ------------------------------------------------------------ for the archive list

  /** The archives of every complete area, with `area` set. */
  completedArchives(): ArchiveEntry[] {
    return [...this.areas.values()].filter((a) => a.status === 'complete').flatMap((a) => a.archives);
  }

  /** A byte source for one archive of a complete area, or null if there is none. */
  open(entry: ArchiveEntry): Source | null {
    const area = entry.area ? this.areas.get(entry.area) : undefined;
    if (!area || area.status !== 'complete') return null;
    const i = area.job.files.findIndex((f) => f.county === entry.county && f.layer === entry.layer);
    const data = area.files[i]?.data;
    return data ? memoryArchiveSource(data, `area:${area.job.id}/${entry.county}/${entry.layer}`) : null;
  }

  /** The finished bytes of one file of an area, for tests. */
  fileBytes(id: string, index: number): Uint8Array | null {
    const a = this.areas.get(id);
    const f = a?.files[index];
    return a && f?.data && f.written === a.job.files[index]?.bytes ? f.data : null;
  }

  dispose(): void {
    this.offNetwork?.();
    clearTimeout(this.retryTimer);
    for (const a of this.areas.values()) a.controller?.abort();
  }

  // ------------------------------------------------------------ running

  private state(a: Area): AreaState {
    const s: AreaState = {
      id: a.job.id,
      record: a.job.record,
      status: a.status,
      bytesDone: a.files.reduce((n, f) => n + f.written, 0),
      bytesTotal: totalOf(a.job),
    };
    if (a.error !== undefined) s.error = a.error;
    return s;
  }

  private report(a: Area): void {
    const s = this.state(a);
    for (const l of [...this.listeners]) l(s);
  }

  private setStatus(a: Area, status: AreaStatus, error?: AreaError): void {
    a.status = status;
    if (error === undefined) delete a.error;
    else a.error = error;
    this.report(a);
  }

  private wakeWaiting(): void {
    for (const a of this.areas.values()) if (a.status === 'waiting') this.setStatus(a, 'queued');
    this.pump();
  }

  private pump(): void {
    if (this.running) return;
    const next = [...this.areas.values()].find((a) => a.status === 'queued');
    if (!next) return;
    this.running = next;
    void this.run(next).finally(() => {
      if (this.running === next) this.running = null;
      this.pump();
    });
  }

  private async run(area: Area): Promise<void> {
    const controller = new AbortController();
    area.controller = controller;
    this.setStatus(area, 'downloading');
    let lastReport = this.now();
    const progress = () => {
      if (this.now() - lastReport >= this.progressMs) {
        lastReport = this.now();
        this.report(area);
      }
    };
    try {
      for (let i = 0; i < area.job.files.length; i++) {
        await this.runFile(area, i, controller.signal, progress);
      }
      area.archives = area.job.files.map((f) => ({ county: f.county, layer: f.layer, meta: parseArchiveMeta(JSON.parse(f.meta)), area: area.job.id }));
      this.setStatus(area, 'complete');
    } catch (e) {
      if (controller.signal.aborted) return; // paused or removed: the status is set already
      if (e instanceof Stop) {
        this.setStatus(area, e.status, e.error);
        if (e.status === 'waiting') this.scheduleRetry();
        return;
      }
      console.warn(`area ${area.job.id} failed:`, e);
      this.setStatus(area, 'failed', 'other');
    } finally {
      area.controller = null;
    }
  }

  private scheduleRetry(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (this.online) this.wakeWaiting();
      else this.scheduleRetry();
    }, this.retryMs);
  }

  private async runFile(area: Area, index: number, signal: AbortSignal, progress: () => void): Promise<void> {
    const file = area.job.files[index]!;
    const p = area.files[index]!;
    if (p.data && p.written === file.bytes) return;
    p.data ??= new Uint8Array(file.bytes);
    if (p.written < file.head.length) {
      p.data.set(file.head, 0);
      p.written = file.head.length;
    }
    // Where to go on from: skip the ranges already written.
    let skip = p.written - file.head.length;
    for (const range of file.ranges) {
      if (skip >= range.length) {
        skip -= range.length;
        continue;
      }
      for (let done = skip; done < range.length; ) {
        signal.throwIfAborted();
        const length = Math.min(this.chunkBytes, range.length - done);
        const bytes = await this.read(file.url, range.offset + done, length, file.etag, signal);
        if (p.written + bytes.length > file.bytes) throw new Stop('failed', 'corrupt');
        p.data.set(bytes, p.written);
        p.written += bytes.length;
        done += length;
        progress();
      }
      skip = 0;
    }
    if (p.written !== file.bytes) throw new Stop('failed', 'corrupt');
    if (file.sha256) {
      const digest = toHex(await crypto.subtle.digest('SHA-256', p.data as Uint8Array<ArrayBuffer>));
      if (digest !== file.sha256) {
        p.written = 0;
        p.data = null;
        throw new Stop('failed', 'corrupt');
      }
    }
  }

  private async read(url: string, offset: number, length: number, etag: string | undefined, signal: AbortSignal): Promise<Uint8Array> {
    let r;
    try {
      r = await this.options.remote.read(url, offset, length, signal);
    } catch (e) {
      if (signal.aborted) throw e;
      if (e instanceof RemoteStatusError) throw new Stop('failed', 'server');
      // No answer at all: the connection is gone, or the server is away for now.
      throw new Stop('waiting');
    }
    if (etag !== undefined && r.etag !== undefined && r.etag !== etag) throw new Stop('failed', 'changed');
    if (r.data.byteLength !== length) throw new Stop('failed', 'server');
    return new Uint8Array(r.data);
  }
}

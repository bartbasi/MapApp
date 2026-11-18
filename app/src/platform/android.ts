// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Android implementation. The native side is in
// android/app/src/main/java/io/github/bartbasi/mapapp/ (archives/, downloads/).
//
// Listing goes through the "Archives" native plugin. Reads go through a plain
// request to /_tiles/<county>/<layer>.pmtiles?o=<offset>&n=<length>, or for an
// archive of a downloaded area /_tiles/_area/<area>/<county>/<layer>.pmtiles,
// which the shell answers with exactly those bytes. The range is in the
// address, never in a Range header, because Android WebView mishandles Range
// headers on responses supplied by the app (DECISIONS D5).
//
// Downloads (D33) go through the "Downloads" plugin (the downloader and small
// reads of hosted files) and the "NetworkState" plugin (D12).

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { RangeResponse, Source } from 'pmtiles';
import type { AreaJob, AreaState, DownloadJobs, Network, NetworkState, RemoteFiles, RemoteRead } from '../downloads/contract';
import { ARCHIVE_ID_PATTERN, archivePath, parseArchiveMeta, type ArchiveEntry } from './archive-meta';
import { fromBase64, toBase64 } from './base64';
import type { ArchiveAccess, DownloadParts, Platform, SystemSettings } from './platform';

interface NativeArchiveRow {
  county: string;
  layer: string;
  /** Where the archive lives: "bundled" (inside the APK) or "downloaded" (an area). */
  location: string;
  /** The downloaded area the archive belongs to; absent for a bundled one. */
  area?: string;
  /** The meta.json file's text. */
  meta: string;
}

interface ArchivesPlugin {
  list(): Promise<{ archives: NativeArchiveRow[] }>;
}

const Archives = registerPlugin<ArchivesPlugin>('Archives');

/**
 * The path of an archive of a downloaded area. "_area" starts with an
 * underscore, which no county ID can, so it never collides with archivePath().
 */
export function areaArchivePath(area: string, county: string, layer: string): string {
  if (!ARCHIVE_ID_PATTERN.test(area)) throw new Error(`bad area ID: ${area}`);
  return `/_tiles/_area/${area}/${county}/${layer}.pmtiles`;
}

class ShellRangeSource implements Source {
  constructor(private readonly path: string) {}

  getKey(): string {
    return this.path;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const res = await fetch(`${this.path}?o=${offset}&n=${length}`, signal ? { signal } : {});
    if (!res.ok) throw new Error(`archive read failed with status ${res.status}: ${this.path}`);
    return { data: await res.arrayBuffer() };
  }
}

const androidArchives: ArchiveAccess = {
  async list() {
    const { archives } = await Archives.list();
    const out: ArchiveEntry[] = [];
    for (const row of archives) {
      try {
        const meta = parseArchiveMeta(JSON.parse(row.meta));
        if (meta.county !== row.county || meta.layer !== row.layer) {
          throw new Error(`metadata names ${meta.county}/${meta.layer}`);
        }
        if (row.area !== undefined && !ARCHIVE_ID_PATTERN.test(row.area)) throw new Error(`bad area ID ${row.area}`);
        out.push({ county: row.county, layer: row.layer, meta, ...(row.area !== undefined ? { area: row.area } : {}) });
      } catch (e) {
        console.warn(`skipped archive ${row.county}/${row.layer}:`, (e as Error).message);
      }
    }
    return out;
  },
  open(entry) {
    const path = entry.area !== undefined ? areaArchivePath(entry.area, entry.county, entry.layer) : archivePath(entry.county, entry.layer);
    return new ShellRangeSource(path);
  },
};

/** The "SystemSettings" native plugin (android/.../settings/SystemSettingsPlugin.java). */
interface SystemSettingsPlugin {
  open(options: { page: 'app' | 'location' }): Promise<void>;
}

const NativeSettings = registerPlugin<SystemSettingsPlugin>('SystemSettings');

const androidSettings: SystemSettings = {
  canOpen: true,
  async open(page) {
    try {
      await NativeSettings.open({ page });
      return true;
    } catch (e) {
      console.warn(`could not open the ${page} settings page:`, (e as Error).message);
      return false;
    }
  },
};

// ---------------------------------------------------------------- downloads

/** A file of a job as the native side takes it: the head is sent apart, ranges are flat. */
interface NativeFileJob {
  county: string;
  layer: string;
  url: string;
  etag?: string;
  headBytes: number;
  /** offset, length, offset, length, ... */
  ranges: number[];
  bytes: number;
  sha256?: string;
  meta: string;
}

/** The "Downloads" native plugin (android/.../downloads/DownloadsPlugin.java). */
interface DownloadsPlugin {
  writeHead(o: { id: string; index: number; offset: number; data: string }): Promise<void>;
  /** allowMetered: false means nothing is fetched over a metered connection (contract.ts AreaJob). Stored with the job. */
  start(o: { id: string; record: string; files: NativeFileJob[]; allowMetered: boolean }): Promise<void>;
  pause(o: { id: string }): Promise<void>;
  resume(o: { id: string }): Promise<void>;
  remove(o: { id: string }): Promise<void>;
  /** Changes and stores an area's allowMetered (contract.ts DownloadJobs.setAllowMetered). */
  setAllowMetered(o: { id: string; allow: boolean }): Promise<void>;
  list(): Promise<{ areas: AreaState[] }>;
  freeBytes(): Promise<{ bytes?: number }>;
  text(o: { url: string }): Promise<{ text: string }>;
  read(o: { url: string; offset: number; length: number }): Promise<{ data: string; etag?: string; totalBytes?: number }>;
  addListener(event: 'change', listener: (state: AreaState) => void): Promise<PluginListenerHandle>;
}

/**
 * An area's state as the native side reports it, made safe: allowMetered is
 * false unless the native side says true, and waitingFor is kept only with
 * status 'waiting' and only with a value the contract knows.
 */
export function areaStateFromNative(raw: AreaState): AreaState {
  const out: AreaState = { ...raw, allowMetered: raw.allowMetered === true };
  delete out.waitingFor;
  if (raw.status === 'waiting' && (raw.waitingFor === 'connection' || raw.waitingFor === 'unmetered')) out.waitingFor = raw.waitingFor;
  return out;
}

/** The "NetworkState" native plugin (android/.../downloads/NetworkStatePlugin.java). */
interface NetworkStatePlugin {
  get(): Promise<NetworkState>;
  addListener(event: 'change', listener: (state: NetworkState) => void): Promise<PluginListenerHandle>;
}

const NativeDownloads = registerPlugin<DownloadsPlugin>('Downloads');
const NativeNetwork = registerPlugin<NetworkStatePlugin>('NetworkState');

/** Heads cross the bridge in pieces of this many bytes (before base64). */
const HEAD_PIECE_BYTES = 512 * 1024;

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

/** Rejects with AbortError when the signal fires. The native call itself runs to its end; its answer is dropped. */
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Adds a native listener and returns a plain unsubscribe, as the contract wants. */
function subscribe<T>(add: (cb: (v: T) => void) => Promise<PluginListenerHandle>, listener: (v: T) => void): () => void {
  let handle: PluginListenerHandle | undefined;
  let removed = false;
  add(listener).then(
    (h) => {
      if (removed) void h.remove();
      else handle = h;
    },
    (e: unknown) => console.warn('could not listen to the native side:', e),
  );
  return () => {
    removed = true;
    if (handle) void handle.remove();
  };
}

const androidRemote: RemoteFiles = {
  async text(url, signal) {
    const { text } = await abortable(NativeDownloads.text({ url }), signal);
    return text;
  },
  async read(url, offset, length, signal): Promise<RemoteRead> {
    const r = await abortable(NativeDownloads.read({ url, offset, length }), signal);
    const data = fromBase64(r.data);
    if (data.length !== length) throw new Error(`read ${data.length} of ${length} bytes at ${offset} of ${url}`);
    const out: RemoteRead = { data: data.buffer as ArrayBuffer };
    if (r.etag !== undefined) out.etag = r.etag;
    if (r.totalBytes !== undefined) out.totalBytes = r.totalBytes;
    return out;
  },
};

/** Sends each file's head in pieces, then the job without heads. */
async function startJob(job: AreaJob): Promise<void> {
  for (const [index, file] of job.files.entries()) {
    for (let offset = 0; offset < file.head.length; offset += HEAD_PIECE_BYTES) {
      const piece = file.head.subarray(offset, offset + HEAD_PIECE_BYTES);
      await NativeDownloads.writeHead({ id: job.id, index, offset, data: toBase64(piece) });
    }
  }
  await NativeDownloads.start({
    id: job.id,
    record: job.record,
    allowMetered: job.allowMetered === true,
    files: job.files.map((f) => {
      const n: NativeFileJob = {
        county: f.county,
        layer: f.layer,
        url: f.url,
        headBytes: f.head.length,
        ranges: f.ranges.flatMap((r) => [r.offset, r.length]),
        bytes: f.bytes,
        meta: f.meta,
      };
      if (f.etag !== undefined) n.etag = f.etag;
      if (f.sha256 !== undefined) n.sha256 = f.sha256;
      return n;
    }),
  });
}

const androidJobs: DownloadJobs = {
  start: startJob,
  pause: (id) => NativeDownloads.pause({ id }),
  resume: (id) => NativeDownloads.resume({ id }),
  remove: (id) => NativeDownloads.remove({ id }),
  setAllowMetered: (id, allow) => NativeDownloads.setAllowMetered({ id, allow }),
  async list() {
    return (await NativeDownloads.list()).areas.map(areaStateFromNative);
  },
  onChange(listener) {
    return subscribe((cb) => NativeDownloads.addListener('change', cb), (state: AreaState) => listener(areaStateFromNative(state)));
  },
  async freeBytes() {
    try {
      return (await NativeDownloads.freeBytes()).bytes;
    } catch {
      return undefined;
    }
  },
};

const androidNetwork: Network = {
  get: () => NativeNetwork.get(),
  onChange(listener) {
    return subscribe((cb) => NativeNetwork.addListener('change', cb), listener);
  },
};

const androidDownloads: DownloadParts = { remote: androidRemote, jobs: androidJobs, network: androidNetwork };

export const androidPlatform: Platform = { kind: 'android', archives: androidArchives, settings: androidSettings, downloads: androidDownloads };

// A test build can drive the downloader from the WebView's console before the
// screens exist (window.__mapappDownloads). Never in an ordinary build.
if (import.meta.env['VITE_MAPAPP_DOWNLOAD_HOOK'] === '1') {
  void import('./android-download-hook').then((m) => m.installDownloadHook(androidDownloads));
}

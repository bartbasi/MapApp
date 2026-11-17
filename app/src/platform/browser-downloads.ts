// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The browser stand-in for the download parts (platform.ts DownloadParts),
// for development and for building the download screens without a phone.
// browser.ts uses it in development builds only.
//
// - Hosted files are read with fetch. Release hosts send no cross-origin
//   headers, so every read goes through the development server's
//   pass-through route (vite-plugins/remote-pass-through.ts).
// - The downloader keeps finished areas in memory (memory-download-jobs.ts).
//   A page reload forgets them.
// - The network state is the browser's own, which is good enough here. On a
//   phone it comes from the shell (D12).

import type { Network, NetworkState, RemoteFiles, RemoteRead } from '../downloads/contract';
import type { ArchiveEntry } from './archive-meta';
import { MemoryDownloadJobs, RemoteStatusError } from './memory-download-jobs';
import type { DownloadParts } from './platform';

/** The development server's route that fetches a hosted file for the page (vite-plugins/remote-pass-through.ts). */
export const PASS_THROUGH_PATH = '/_remote';

/** The address the page fetches for a hosted file. */
export function passThroughUrl(url: string): string {
  return `${PASS_THROUGH_PATH}?url=${encodeURIComponent(url)}`;
}

/** Reads hosted files with fetch, through `route` (the pass-through route by default). */
export function fetchRemoteFiles(route: (url: string) => string = passThroughUrl): RemoteFiles {
  return {
    async text(url, signal) {
      const res = await fetch(route(url), { cache: 'no-store', ...(signal ? { signal } : {}) });
      if (res.status !== 200) throw new RemoteStatusError(res.status, `${url} answered ${res.status}`);
      return res.text();
    },
    async read(url, offset, length, signal): Promise<RemoteRead> {
      const res = await fetch(route(url), {
        cache: 'no-store',
        headers: { Range: `bytes=${offset}-${offset + length - 1}` },
        ...(signal ? { signal } : {}),
      });
      if (res.status !== 206) throw new RemoteStatusError(res.status, `${url} answered ${res.status} to a range read`);
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers.get('Content-Range') ?? '');
      if (!m || Number(m[1]) !== offset || Number(m[2]) !== offset + length - 1) throw new RemoteStatusError(res.status, `${url} answered with other bytes than asked`);
      const data = await res.arrayBuffer();
      if (data.byteLength !== length) throw new Error(`${url}: ${data.byteLength} of ${length} bytes arrived`);
      const out: RemoteRead = { data, totalBytes: Number(m[3]) };
      const etag = res.headers.get('ETag');
      if (etag) out.etag = etag;
      return out;
    },
  };
}

/** The browser's idea of the connection. Never metered: a browser cannot tell. */
export const browserNetwork: Network = {
  get: async () => ({ online: navigator.onLine, metered: false }),
  onChange(listener: (state: NetworkState) => void) {
    const on = () => listener({ online: navigator.onLine, metered: false });
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  },
};

export interface BrowserDownloads {
  parts: DownloadParts;
  /** The archives of complete areas, for the browser's archive list. */
  archives(): ArchiveEntry[];
  /** The downloader, which also opens the archives of complete areas. */
  jobs: MemoryDownloadJobs;
}

export function createBrowserDownloads(): BrowserDownloads {
  const remote = fetchRemoteFiles();
  const jobs = new MemoryDownloadJobs({ remote, network: browserNetwork });
  return { parts: { remote, jobs, network: browserNetwork }, archives: () => jobs.completedArchives(), jobs };
}

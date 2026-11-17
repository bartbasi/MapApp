// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Browser implementation: archives come from the web server that serves the
// app, read with ordinary HTTP Range requests. During development that server
// is the Vite plugin in vite-plugins/archive-server.ts.
//
// In a development build the browser can also download areas, through the
// stand-in in browser-downloads.ts, which keeps them in memory. A production
// browser build offers no downloads (Platform.downloads is absent).

import { FetchSource } from 'pmtiles';
import { archivePath, parseArchiveMeta, type ArchiveEntry } from './archive-meta';
import { createBrowserDownloads } from './browser-downloads';
import type { ArchiveAccess, Platform, SystemSettings } from './platform';

/** The download stand-in, in development builds only. The whole branch is left out of a production build. */
const standIn = import.meta.env.DEV ? createBrowserDownloads() : undefined;

async function served(): Promise<ArchiveEntry[]> {
  const res = await fetch('/_tiles/index.json', { cache: 'no-store' });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`archive index request failed with status ${res.status}`);
  const body = (await res.json()) as { archives?: unknown };
  if (!Array.isArray(body.archives)) return [];
  const out: ArchiveEntry[] = [];
  for (const raw of body.archives as Array<{ meta?: unknown }>) {
    try {
      const meta = parseArchiveMeta(raw.meta);
      out.push({ county: meta.county, layer: meta.layer, meta });
    } catch (e) {
      console.warn('skipped an archive with bad metadata:', (e as Error).message);
    }
  }
  return out;
}

const browserArchives: ArchiveAccess = {
  async list() {
    return [...(standIn?.archives() ?? []), ...(await served())];
  },
  open(entry) {
    if (entry.area !== undefined) {
      const source = standIn?.jobs.open(entry);
      if (!source) throw new Error(`area ${entry.area} has no archive ${entry.county}/${entry.layer}`);
      return source;
    }
    return new FetchSource(new URL(archivePath(entry.county, entry.layer), location.origin).href);
  },
};

/** A web page cannot open the browser's or the system's settings. */
const browserSettings: SystemSettings = {
  canOpen: false,
  open: async () => false,
};

export const browserPlatform: Platform = {
  kind: 'browser',
  archives: browserArchives,
  settings: browserSettings,
  ...(standIn ? { downloads: standIn.parts } : {}),
};

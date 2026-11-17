// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Browser implementation: archives come from the web server that serves the
// app, read with ordinary HTTP Range requests. During development that server
// is the Vite plugin in vite-plugins/archive-server.ts.

import { FetchSource } from 'pmtiles';
import { archivePath, parseArchiveMeta, type ArchiveEntry } from './archive-meta';
import type { ArchiveAccess, Platform, SystemSettings } from './platform';

const browserArchives: ArchiveAccess = {
  async list() {
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
  },
  open(entry) {
    return new FetchSource(new URL(archivePath(entry.county, entry.layer), location.origin).href);
  },
};

/** A web page cannot open the browser's or the system's settings. */
const browserSettings: SystemSettings = {
  canOpen: false,
  open: async () => false,
};

export const browserPlatform: Platform = { kind: 'browser', archives: browserArchives, settings: browserSettings };

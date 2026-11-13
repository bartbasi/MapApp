// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Android implementation. The native side is in
// android/app/src/main/java/io/github/bartbasi/mapapp/archives/.
//
// Listing goes through the "Archives" native plugin. Reads go through a plain
// request to /_tiles/<county>/<layer>.pmtiles?o=<offset>&n=<length>, which the
// shell answers with exactly those bytes. The range is in the address, never in
// a Range header, because Android WebView mishandles Range headers on
// responses supplied by the app (DECISIONS D5).

import { registerPlugin } from '@capacitor/core';
import type { RangeResponse, Source } from 'pmtiles';
import { archivePath, parseArchiveMeta, type ArchiveEntry } from './archive-meta';
import type { ArchiveAccess, Platform } from './platform';

interface NativeArchiveRow {
  county: string;
  layer: string;
  /** Where the archive lives: "bundled" (inside the APK) or, from Step 2, "downloaded". */
  location: string;
  /** The meta.json file's text. */
  meta: string;
}

interface ArchivesPlugin {
  list(): Promise<{ archives: NativeArchiveRow[] }>;
}

const Archives = registerPlugin<ArchivesPlugin>('Archives');

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
        out.push({ county: row.county, layer: row.layer, meta });
      } catch (e) {
        console.warn(`skipped archive ${row.county}/${row.layer}:`, (e as Error).message);
      }
    }
    return out;
  },
  open(entry) {
    return new ShellRangeSource(archivePath(entry.county, entry.layer));
  },
};

export const androidPlatform: Platform = { kind: 'android', archives: androidArchives };

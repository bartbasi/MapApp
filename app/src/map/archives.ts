// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Opens installed archives with the pmtiles library, through the platform's
// byte-range reader, and wraps them for the TileResolver.

import { PMTiles } from 'pmtiles';
import type { ArchiveEntry } from '../platform/archive-meta';
import type { ArchiveAccess } from '../platform/platform';
import type { TileArchive } from './tile-resolver';

export interface OpenArchive extends TileArchive {
  readonly entry: ArchiveEntry;
  /** The JSON metadata stored inside the archive (tippecanoe adds tilestats there). */
  getMetadata(): Promise<unknown>;
}

export function openArchives(access: ArchiveAccess, entries: readonly ArchiveEntry[]): OpenArchive[] {
  return entries.map((entry) => {
    const pm = new PMTiles(access.open(entry));
    return {
      id: `${entry.county}/${entry.layer}`,
      entry,
      layer: entry.layer,
      minzoom: entry.meta.minzoom,
      maxzoom: entry.meta.maxzoom,
      bounds: entry.meta.bounds,
      async getTile(z, x, y, signal) {
        const r = await pm.getZxy(z, x, y, signal);
        return r?.data;
      },
      getMetadata: () => pm.getMetadata(),
    };
  });
}

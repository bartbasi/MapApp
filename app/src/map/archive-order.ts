// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The order in which installed archives answer for a tile (D33):
//
//   1. downloaded areas, newest first. A new download is the user's latest
//      choice, and may be from a newer release than an older one.
//   2. archives that came with the app.
//   3. the overview map (county "overview") last: it is the low-detail map of
//      the whole region, for where nothing else is installed.
//
// Within each group the platform's own order is kept.

import { compareAreaIdsNewestFirst } from '../downloads/area-record';
import type { ArchiveEntry } from '../platform/archive-meta';

/** The county ID of the overview map that comes with the app. */
export const OVERVIEW_COUNTY = 'overview';

function group(e: ArchiveEntry): number {
  if (e.area !== undefined) return 0;
  return e.county === OVERVIEW_COUNTY ? 2 : 1;
}

/** The archives in the order tiles are looked up. A new list; the input is not changed. */
export function orderArchives(entries: readonly ArchiveEntry[]): ArchiveEntry[] {
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      const ga = group(a.entry);
      const gb = group(b.entry);
      if (ga !== gb) return ga - gb;
      if (ga === 0 && a.entry.area !== b.entry.area) return compareAreaIdsNewestFirst(a.entry.area!, b.entry.area!);
      return a.i - b.i;
    })
    .map((x) => x.entry);
}

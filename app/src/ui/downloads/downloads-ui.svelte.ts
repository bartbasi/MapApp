// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the download screens and the map share while the downloads panel is
// open: which screen shows, which download is outlined, and the rectangle the
// picker's frame holds. It lives as long as the app, so a fold or unfold, or
// closing and opening the panel, keeps it.

import type { CountyOffer } from '../../downloads/contract';
import type { Bounds } from '../../map/tile-math';

export type DownloadsMode = 'list' | 'pick';

export class DownloadsUi {
  mode = $state<DownloadsMode>('list');
  /** The download whose outline is picked out on the map, by area ID. */
  shown = $state<string | null>(null);
  /** The ground the picker's frame holds now, or null before the map has placed it. */
  pickBounds = $state.raw<Bounds | null>(null);
  /** The counties on offer, once fetched. Kept so the panel does not fetch them each time it opens. */
  offers = $state.raw<CountyOffer[] | null>(null);
}

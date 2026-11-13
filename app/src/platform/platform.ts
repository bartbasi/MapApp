// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The one place where the app touches what differs between Android and a
// plain browser. Everything outside src/platform/ talks to this interface only,
// so the map core and the screens run unchanged on every platform (D3).

import type { Source } from 'pmtiles';
import type { ArchiveEntry } from './archive-meta';

/** Installed tile archives and byte-range access to them (D5). */
export interface ArchiveAccess {
  /** Every installed archive with its metadata. */
  list(): Promise<ArchiveEntry[]>;
  /** A byte-range reader for one archive, for the pmtiles library. */
  open(entry: ArchiveEntry): Source;
}

export interface Platform {
  readonly kind: 'android' | 'browser';
  readonly archives: ArchiveAccess;
}

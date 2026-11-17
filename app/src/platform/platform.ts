// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The one place where the app touches what differs between Android and a
// plain browser. Everything outside src/platform/ talks to this interface only,
// so the map core and the screens run unchanged on every platform (D3).

import type { Source } from 'pmtiles';
import type { DownloadJobs, Network, RemoteFiles } from '../downloads/contract';
import type { ArchiveEntry } from './archive-meta';

/** Installed tile archives and byte-range access to them (D5). */
export interface ArchiveAccess {
  /**
   * Every installed archive with its metadata: those that came with the app,
   * and those of every downloaded area that is complete (with `area` set).
   * An area that is still downloading is not listed.
   */
  list(): Promise<ArchiveEntry[]>;
  /** A byte-range reader for one archive, for the pmtiles library. */
  open(entry: ArchiveEntry): Source;
}

/** The phone's own settings pages, where a refused permission is turned back on. */
export interface SystemSettings {
  /** False where no settings page can be opened from the app (a browser). */
  readonly canOpen: boolean;
  /** Opens this app's settings page or the phone's Location page. True if it opened. */
  open(page: 'app' | 'location'): Promise<boolean>;
}

/** What offline downloads need from the platform (downloads/contract.ts, D33). */
export interface DownloadParts {
  readonly remote: RemoteFiles;
  readonly jobs: DownloadJobs;
  readonly network: Network;
}

export interface Platform {
  readonly kind: 'android' | 'browser';
  readonly archives: ArchiveAccess;
  readonly settings: SystemSettings;
  /** Absent where downloads are not possible; the screens then do not offer them. */
  readonly downloads?: DownloadParts;
}

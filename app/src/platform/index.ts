// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { Capacitor } from '@capacitor/core';
import { androidPlatform } from './android';
import { browserPlatform } from './browser';
import type { Platform } from './platform';

export type { Platform, ArchiveAccess, SystemSettings } from './platform';
export type { ArchiveEntry, ArchiveMeta, ArchiveSource } from './archive-meta';

/** Picks the platform implementation once, at startup. */
export function detectPlatform(): Platform {
  return Capacitor.getPlatform() === 'android' ? androidPlatform : browserPlatform;
}

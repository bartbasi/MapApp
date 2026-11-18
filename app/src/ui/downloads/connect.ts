// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The one place where the app gets its download service. The screens take any
// DownloadService and know nothing else of downloads.

import type { DownloadService } from '../../downloads/contract';
import type { Platform } from '../../platform/platform';

/**
 * The download service for this platform, or null where downloads are not
 * possible (then the screens do not offer them).
 *
 * In a development build, ?fakeDownloads in the address uses the in-memory
 * stand-in instead (downloads/fake-service.ts), so every screen and state can
 * be seen in a browser.
 */
export async function connectDownloads(platform: Platform): Promise<DownloadService | null> {
  if (import.meta.env.DEV) {
    const { fakeOptionsFrom, createFakeDownloadService } = await import('../../downloads/fake-service');
    const options = fakeOptionsFrom(location.search);
    if (options) return createFakeDownloadService(options);
  }
  if (!platform.downloads) return null;
  const { createDownloadService } = await import('../../downloads/service');
  const manager = createDownloadService(platform.downloads);
  // The list of areas and the network state, which need no connection.
  await manager.ready;
  return manager;
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The position feature's front door: picks the right source for the platform.

import type { Platform } from '../platform/platform';
import { BrowserPositionSource } from './browser-source';
import { NativePositionSource } from './native-source';
import type { PositionSource } from './types';

export type { PermissionState, PositionError, PositionErrorKind, PositionEvent, PositionFix, PositionListener, PositionSource } from './types';
export { PositionStore, STALE_AFTER_MS, NO_POSITION_AFTER_MS, isStale, isTooOld, fixAgeMs, type CameraCommand, type PositionSnapshot } from './store';
export type { FollowMode } from './follow';
export type { Heading, HeadingSource } from './heading';

/** The real location service of the platform the app runs on. */
export function createPositionSource(kind: Platform['kind']): PositionSource {
  return kind === 'android' ? new NativePositionSource() : new BrowserPositionSource();
}

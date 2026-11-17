// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The browser position source, through navigator.geolocation. Used by the
// development build and, later, by the iPhone and desktop versions.

import { BasePositionSource, finiteOrNull, type PermissionState, type PositionErrorKind, type PositionFix } from './types';

export const BROWSER_WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 };

/** GeolocationPositionError codes: 1 permission denied, 2 position unavailable, 3 timeout. */
export function browserErrorKind(code: number): PositionErrorKind {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export function fixFromBrowser(p: GeolocationPosition): PositionFix {
  const c = p.coords;
  return {
    lng: c.longitude,
    lat: c.latitude,
    accuracyM: c.accuracy,
    headingDeg: finiteOrNull(c.heading),
    speedMps: finiteOrNull(c.speed),
    timeMs: p.timestamp,
  };
}

export class BrowserPositionSource extends BasePositionSource {
  readonly kind = 'browser' as const;
  private watchId: number | null = null;

  async start(): Promise<void> {
    if (this.watchId !== null) return;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      this.emitPermission('unavailable');
      this.emitError('unavailable', 'navigator.geolocation is missing');
      return;
    }
    const known = await this.queryPermission();
    if (known !== 'unknown') this.emitPermission(known);
    this.watchId = geo.watchPosition(
      (p) => {
        if (this.permission !== 'granted') this.emitPermission('granted');
        this.emitFix(fixFromBrowser(p));
      },
      (err) => {
        const kind = browserErrorKind(err.code);
        if (kind === 'denied') this.emitPermission('denied');
        this.emitError(kind, err.message);
        // The browser keeps a watch alive after a timeout, so only a refusal ends it.
        if (kind === 'denied') void this.stop();
      },
      BROWSER_WATCH_OPTIONS,
    );
  }

  async stop(): Promise<void> {
    if (this.watchId === null) return;
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  private async queryPermission(): Promise<PermissionState> {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status?.state === 'granted') return 'granted';
      if (status?.state === 'denied') return 'denied';
    } catch {
      // Some browsers cannot answer this; the watch will find out.
    }
    return 'unknown';
  }
}

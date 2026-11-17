// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Android position source, through the Capacitor geolocation plugin. The
// plugin asks Android for permission with its own system prompt and then
// watches the phone's GPS. An emulator's `adb emu geo fix` arrives here the
// same way a real GPS reading does.

import { Geolocation, type Position } from '@capacitor/geolocation';
import { BasePositionSource, finiteOrNull, type PositionErrorKind, type PositionFix } from './types';

/**
 * Watch settings: GPS on (high accuracy), a reading about every second, and
 * never a cached reading older than a second.
 */
export const NATIVE_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 30000,
  interval: 1000,
  minimumUpdateInterval: 500,
} as const;

/** The plugin's error codes (GeolocationErrors.kt in @capacitor/geolocation 8.2.5), in the app's words. */
export function nativeErrorKind(code: string | undefined): PositionErrorKind {
  switch (code) {
    case 'OS-PLUG-GLOC-0003':
      return 'denied';
    case 'OS-PLUG-GLOC-0007': // Location services are off.
    case 'OS-PLUG-GLOC-0009': // The user said no to turning Location on.
    case 'OS-PLUG-GLOC-0016': // Location settings do not allow the request.
    case 'OS-PLUG-GLOC-0017': // Location and network both off.
      return 'location-off';
    case 'OS-PLUG-GLOC-0010':
      return 'timeout';
    default:
      return 'unavailable';
  }
}

/** One plugin reading as a fix. The course is the direction of travel; the plugin's `heading` may be a compass, so it is only a fallback. */
export function fixFromPlugin(p: Position): PositionFix {
  const c = p.coords;
  return {
    lng: c.longitude,
    lat: c.latitude,
    accuracyM: c.accuracy,
    headingDeg: finiteOrNull(c.course) ?? finiteOrNull(c.heading),
    speedMps: finiteOrNull(c.speed),
    timeMs: p.timestamp,
  };
}

function errorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

export class NativePositionSource extends BasePositionSource {
  readonly kind = 'android' as const;
  private watchId: string | null = null;
  private starting = false;

  async start(): Promise<void> {
    if (this.watchId !== null || this.starting) return;
    this.starting = true;
    try {
      if (!(await this.ensurePermission())) return;
      this.watchId = await Geolocation.watchPosition({ ...NATIVE_WATCH_OPTIONS }, (position, err) => {
        if (err) {
          this.onWatchError(err);
          return;
        }
        if (position) this.emitFix(fixFromPlugin(position));
      });
    } catch (e) {
      this.fail(e);
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<void> {
    const id = this.watchId;
    this.watchId = null;
    if (id === null) return;
    try {
      await Geolocation.clearWatch({ id });
    } catch (e) {
      console.warn('position: clearing the watch failed:', errorText(e));
    }
  }

  /** Checks, and asks if needed. True when the app may read the position. */
  private async ensurePermission(): Promise<boolean> {
    // Both calls throw when the phone's Location switch is off.
    let status = await Geolocation.checkPermissions();
    if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
      // "denied" here means Android will not show its prompt again: only the
      // app's settings page can change it. Asking anyway costs nothing.
      status = await Geolocation.requestPermissions({ permissions: ['location'] });
    }
    // Approximate location (coarse only) still works, just with a large circle.
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      this.emitPermission('granted');
      return true;
    }
    this.emitPermission('denied');
    this.emitError('denied', `permission ${status.location}`);
    return false;
  }

  private onWatchError(err: unknown): void {
    const kind = nativeErrorKind(errorCode(err));
    // A slow first reading is not a failure: keep watching.
    if (kind === 'timeout') {
      this.emitError(kind, errorText(err));
      return;
    }
    this.fail(err);
    void this.stop();
  }

  private fail(e: unknown): void {
    const kind = nativeErrorKind(errorCode(e));
    if (kind === 'denied') this.emitPermission('denied');
    this.emitError(kind, `${errorCode(e) ?? ''} ${errorText(e)}`.trim());
  }
}

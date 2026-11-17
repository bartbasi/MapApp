// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Android position source, through MapApp's own "DeviceLocation" plugin
// (android/app/src/main/java/io/github/bartbasi/mapapp/location/). The plugin
// uses only Android's own location service: the GPS, and the platform's fused
// provider where the phone has one, with GPS fixes always preferred
// (DECISIONS D31). It links no closed library. An emulator's
// `adb emu geo fix` arrives here the same way a real GPS reading does.
//
// PRECISE OR APPROXIMATE
//
// Android's prompt offers Precise or Approximate. Approximate gives fixes
// about 2 km wide, which cannot place the phone against a property line, so
// the app watches only with the precise permission. The plugin reports it as
// `location` (fine and coarse both granted) and the approximate one as
// `coarseLocation`.
//
// Each tap of the position button checks first. Without the precise
// permission it asks Android, once per tap. With nothing granted Android
// shows its usual prompt. With Approximate already granted, Android 12 and
// later show the prompt to change to precise, unless the user has turned it
// down often enough that Android answers at once without showing anything.
// Either way, if the answer is still approximate only, the app says it needs
// the precise location and offers the app's settings page. It never starts
// the watch then.
//
// LOCATION SWITCHED OFF
//
// Before anything else the source asks whether the phone's Location switch is
// on, and says so if it is off. While watching, the plugin hears the switch
// go off and ends the watch with "location-off".

import { registerPlugin, type PermissionState as CapacitorPermissionState } from '@capacitor/core';
import { BasePositionSource, finiteOrNull, type PositionErrorKind, type PositionFix } from './types';

/** The two permission aliases the plugin declares, as Capacitor reports them. */
export interface LocationPermissionStatus {
  /** Precise: fine and coarse both granted. */
  location: CapacitorPermissionState;
  /** Approximate. */
  coarseLocation: CapacitorPermissionState;
}

/** Whether Location is on, and which providers the phone has. */
export interface LocationStatus {
  locationEnabled: boolean;
  gps: boolean;
  fused: boolean;
}

/**
 * One fix as the plugin sends it. Fields Android does not report for a fix
 * are absent: accuracy, bearing and speed.
 */
export interface NativeFix {
  type: 'fix';
  provider: 'gps' | 'fused';
  lng: number;
  lat: number;
  accuracyM?: number;
  /** Direction of travel, degrees clockwise from true north. */
  bearingDeg?: number;
  speedMps?: number;
  /** When the fix was taken, milliseconds since 1970, by the fix's own clock. */
  timeMs: number;
  /** How old the fix was when the plugin sent it, by the phone's monotonic clock. */
  ageMs: number;
}

/** The watch's last event: it could not start, or it stopped. */
export interface NativeWatchError {
  type: 'error';
  code: 'denied' | 'location-off' | 'unavailable' | string;
}

export type NativeWatchEvent = NativeFix | NativeWatchError;

export type NativeWatchCallback = (event: NativeWatchEvent | null, err?: unknown) => void;

/** The plugin's methods this source uses, so tests can give a fake. */
export interface DeviceLocationPlugin {
  status(): Promise<LocationStatus>;
  checkPermissions(): Promise<LocationPermissionStatus>;
  requestPermissions(options: { permissions: ('location' | 'coarseLocation')[] }): Promise<LocationPermissionStatus>;
  /** Resolves with the watch's id. Every event after that arrives through the callback. */
  watch(options: Record<string, never>, callback: NativeWatchCallback): Promise<string>;
  clearWatch(options: { id: string }): Promise<void>;
}

const DeviceLocation = registerPlugin<DeviceLocationPlugin>('DeviceLocation');

/** The plugin's error codes, in the app's words. */
export function nativeErrorKind(code: string | undefined): PositionErrorKind {
  switch (code) {
    case 'denied':
      return 'denied';
    case 'location-off':
      return 'location-off';
    default:
      return 'unavailable';
  }
}

/**
 * One plugin fix as the app's fix. A missing accuracy becomes 0, which the
 * app reads as not known (DECISIONS D32).
 */
export function fixFromNative(f: NativeFix): PositionFix {
  const accuracy = finiteOrNull(f.accuracyM);
  const age = finiteOrNull(f.ageMs);
  return {
    lng: f.lng,
    lat: f.lat,
    accuracyM: accuracy ?? 0,
    headingDeg: finiteOrNull(f.bearingDeg),
    speedMps: finiteOrNull(f.speedMps),
    timeMs: f.timeMs,
    ageAtDeliveryMs: age !== null && age > 0 ? age : 0,
  };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

/** One watch, from the moment it is asked for. */
interface Watch {
  /** The plugin's id, once the plugin has given it. */
  id: string | null;
}

export class NativePositionSource extends BasePositionSource {
  readonly kind = 'android' as const;
  /** The running or starting watch, or null. Events from any other watch are ignored. */
  private watch: Watch | null = null;
  private starting = false;
  /** Counts stop() calls, so a start() that a stop() overtook gives up. */
  private stops = 0;

  constructor(private readonly plugin: DeviceLocationPlugin = DeviceLocation) {
    super();
  }

  async start(): Promise<void> {
    if (this.watch !== null || this.starting) return;
    this.starting = true;
    const stops = this.stops;
    try {
      const status = await this.plugin.status();
      if (!status.locationEnabled) {
        this.emitError('location-off', 'Location is switched off');
        return;
      }
      if (!(await this.ensurePermission()) || this.stops !== stops) return;
      const watch: Watch = { id: null };
      this.watch = watch;
      watch.id = await this.plugin.watch({}, (event, err) => this.onWatchEvent(watch, event, err));
      // Stopped while the plugin was starting it: stop it there too.
      if (this.watch !== watch) await this.clear(watch.id);
    } catch (e) {
      this.watch = null;
      this.emitError('unavailable', errorText(e));
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<void> {
    this.stops++;
    const watch = this.watch;
    this.watch = null;
    if (watch?.id) await this.clear(watch.id);
  }

  private async clear(id: string): Promise<void> {
    try {
      await this.plugin.clearWatch({ id });
    } catch (e) {
      console.warn('position: clearing the watch failed:', errorText(e));
    }
  }

  private onWatchEvent(watch: Watch, event: NativeWatchEvent | null, err: unknown): void {
    if (this.watch !== watch) return;
    if (event?.type === 'fix') {
      this.emitFix(fixFromNative(event));
      return;
    }
    // Any other event is the watch's last: the plugin has already ended it.
    this.watch = null;
    if (event?.type === 'error') {
      const kind = nativeErrorKind(event.code);
      if (kind === 'denied') this.emitPermission('denied');
      this.emitError(kind, `watch ended: ${event.code}`);
    } else {
      this.emitError('unavailable', errorText(err ?? 'no event'));
    }
  }

  /**
   * Checks, and asks if needed. True when the app may read the precise
   * position. See "Precise or approximate" at the top of this file.
   */
  private async ensurePermission(): Promise<boolean> {
    let status = await this.plugin.checkPermissions();
    if (status.location !== 'granted') {
      // "denied" here means Android will not show its prompt again: only the
      // app's settings page can change it. Asking anyway costs nothing.
      status = await this.plugin.requestPermissions({ permissions: ['location'] });
    }
    if (status.location === 'granted') {
      this.emitPermission('granted');
      return true;
    }
    if (status.coarseLocation === 'granted') {
      this.emitPermission('approximate');
      this.emitError('approximate', 'only the approximate location is allowed');
      return false;
    }
    this.emitPermission('denied');
    this.emitError('denied', `permission ${status.location}`);
    return false;
  }
}

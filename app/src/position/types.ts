// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The shape every position source shares. A source turns one platform's
// location service (the Android plugin, the browser, a replayed route) into
// the same three kinds of event. Nothing here sends a position anywhere or
// writes it to storage (DECISIONS D21).

/** One position reading from the phone. */
export interface PositionFix {
  lng: number;
  lat: number;
  /**
   * Radius in meters within which the true position probably lies. Zero, a
   * negative or a non-finite value means not known (Android reports 0 for a
   * fix with no accuracy): see accuracyKnown.
   */
  accuracyM: number;
  /** Direction of travel, degrees clockwise from true north, or null when the source has none. */
  headingDeg: number | null;
  /** Ground speed in meters per second, or null when the source has none. */
  speedMps: number | null;
  /** When the reading was taken, in milliseconds since 1970, by the source's clock. */
  timeMs: number;
}

/**
 * Whether the app may use the position.
 * - unknown: not asked yet, or not known.
 * - granted: allowed, with the precise position.
 * - approximate: allowed only an approximate position (Android's
 *   "Approximate" choice), which is too rough to use against property lines.
 * - denied: the user said no. On Android this may need the app's settings page.
 * - unavailable: this device or browser has no location service at all.
 */
export type PermissionState = 'unknown' | 'granted' | 'approximate' | 'denied' | 'unavailable';

/**
 * What went wrong, in the app's own words.
 * - denied: permission refused.
 * - approximate: only an approximate position is allowed. Position stays off.
 * - location-off: the phone's Location switch is off.
 * - timeout: no reading came in time. Not fatal: the source keeps waiting.
 * - unavailable: the location service failed or does not exist.
 */
export type PositionErrorKind = 'denied' | 'approximate' | 'location-off' | 'timeout' | 'unavailable';

export interface PositionError {
  kind: PositionErrorKind;
  /** The platform's own wording or code, for the developer console only. */
  detail: string;
}

export type PositionEvent =
  | { type: 'fix'; fix: PositionFix }
  | { type: 'permission'; state: PermissionState }
  | { type: 'error'; error: PositionError };

export type PositionListener = (event: PositionEvent) => void;

/** One platform's location service. */
export interface PositionSource {
  readonly kind: 'android' | 'browser' | 'replay';
  /** The last permission state this source learned. */
  readonly permission: PermissionState;
  /**
   * Asks for permission if needed, then starts watching. Resolves once the
   * watch is running or has failed; the outcome arrives as events. Calling it
   * while running does nothing.
   */
  start(): Promise<void>;
  /** Stops watching. Safe to call when not running. */
  stop(): Promise<void>;
  /** Every fix, permission change and error. Returns the unsubscribe function. */
  subscribe(listener: PositionListener): () => void;
}

/** Shared listener bookkeeping for the sources. */
export abstract class BasePositionSource implements PositionSource {
  abstract readonly kind: PositionSource['kind'];
  private readonly listeners = new Set<PositionListener>();
  private permissionState: PermissionState = 'unknown';

  get permission(): PermissionState {
    return this.permissionState;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  subscribe(listener: PositionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(event: PositionEvent): void {
    if (event.type === 'permission') this.permissionState = event.state;
    for (const l of [...this.listeners]) l(event);
  }

  protected emitFix(fix: PositionFix): void {
    this.emit({ type: 'fix', fix });
  }

  protected emitPermission(state: PermissionState): void {
    this.emit({ type: 'permission', state });
  }

  protected emitError(kind: PositionErrorKind, detail: string): void {
    this.emit({ type: 'error', error: { kind, detail } });
  }
}

/**
 * True when an accuracy radius is a real measurement: finite and above zero.
 * No real fix is exact, so 0 means the platform had no accuracy to give.
 */
export function accuracyKnown(accuracyM: number): boolean {
  return Number.isFinite(accuracyM) && accuracyM > 0;
}

/** A finite number, else null. Sources report missing values in several ways. */
export function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

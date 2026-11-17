// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The app's one record of where the phone is. It runs a position source and
// the compass, keeps the latest fix and how old it is, and holds the locate
// button's state. Screens and the map read it through subscribe(), which
// follows the Svelte store contract, so plain TypeScript can use it too.
//
// The position lives in memory only. It is never written to storage and
// never sent anywhere (DECISIONS D21).

import { DeviceCompass, type CompassSensor } from './compass';
import { LOCATE_ZOOM, nextFollowMode, type FollowEvent, type FollowMode } from './follow';
import { chooseHeading, smoothHeading, type Heading } from './heading';
import type { PermissionState, PositionError, PositionEvent, PositionFix, PositionSource } from './types';

/** A fix older than this is stale: the marker turns gray and the app says how old it is. */
export const STALE_AFTER_MS = 10_000;

/** How old the latest fix is, by this phone's clock, or null with no fix. */
export function fixAgeMs(receivedAt: number | null, now: number): number | null {
  return receivedAt === null ? null : Math.max(0, now - receivedAt);
}

/**
 * A fix older than this says nothing useful about where the phone is now:
 * the readout stops naming a parcel or a distance, and says only that there
 * is no current position. Five minutes on foot is a few hundred meters.
 */
export const NO_POSITION_AFTER_MS = 5 * 60_000;

/** True when there was a fix and none has come for more than STALE_AFTER_MS. */
export function isStale(receivedAt: number | null, now: number): boolean {
  const age = fixAgeMs(receivedAt, now);
  return age !== null && age > STALE_AFTER_MS;
}

/** True when there was a fix and none has come for more than NO_POSITION_AFTER_MS. */
export function isTooOld(receivedAt: number | null, now: number): boolean {
  const age = fixAgeMs(receivedAt, now);
  return age !== null && age > NO_POSITION_AFTER_MS;
}

export interface PositionSnapshot {
  /** Position is switched on: the source is running or starting. */
  on: boolean;
  /** The locate button's state. */
  follow: FollowMode;
  /** Same as follow === 'following'. */
  following: boolean;
  permission: PermissionState;
  /** The latest fix since position was turned on, or null. */
  fix: PositionFix | null;
  /** Milliseconds since that fix arrived, or null. */
  ageMs: number | null;
  /** Older than STALE_AFTER_MS: the marker is gray. */
  stale: boolean;
  /** Older than NO_POSITION_AFTER_MS: too old to place the phone at all. */
  tooOld: boolean;
  /** The heading to show, or null for none. */
  heading: Heading | null;
  /** The last error that stopped position or still matters, until dismissed or a fix arrives. */
  error: PositionError | null;
}

/** Asks the map to center on a point; at least minZoom when given. */
export interface CameraCommand {
  lng: number;
  lat: number;
  minZoom: number | null;
}

export interface PositionStoreDeps {
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  compass?: CompassSensor | null;
  /**
   * Calls back when the app comes back to the screen, and returns the
   * unsubscribe function. Default: the page's visibilitychange event, where
   * there is a page. Null for none.
   */
  onVisible?: ((fn: () => void) => () => void) | null;
}

/** The page's visibilitychange event, when running in a page. */
function pageVisibility(fn: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => {
    if (document.visibilityState === 'visible') fn();
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/** How often the age and stale state are brought up to date while position is on. */
const TICK_MS = 1000;
/** Compass changes smaller than this, or sooner than this, are not passed on: the map need not redraw 60 times a second. */
const COMPASS_MIN_TURN_DEG = 1;
const COMPASS_MIN_INTERVAL_MS = 66;

export class PositionStore {
  private source: PositionSource;
  private unsubscribeSource: () => void;
  private readonly now: () => number;
  private readonly setIntervalFn: (fn: () => void, ms: number) => unknown;
  private readonly clearIntervalFn: (handle: unknown) => void;
  private readonly compass: CompassSensor | null;

  private readonly subscribers = new Set<(s: PositionSnapshot) => void>();
  private readonly cameraListeners = new Set<(c: CameraCommand) => void>();

  private on = false;
  private follow: FollowMode = 'off';
  private fix: PositionFix | null = null;
  private receivedAt: number | null = null;
  private error: PositionError | null = null;
  private heading: Heading | null = null;
  private compassDeg: number | null = null;
  private compassAt: number | null = null;
  private lastCompassNotify = -Infinity;
  private centerOnNextFix = false;
  private ticker: unknown = null;
  private current: PositionSnapshot;
  private readonly unsubscribeVisible: () => void;

  constructor(source: PositionSource, deps: PositionStoreDeps = {}) {
    this.source = source;
    this.unsubscribeSource = source.subscribe((e) => this.onSourceEvent(e));
    this.now = deps.now ?? (() => Date.now());
    this.setIntervalFn = deps.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    this.clearIntervalFn = deps.clearInterval ?? ((h) => globalThis.clearInterval(h as ReturnType<typeof globalThis.setInterval>));
    this.compass = deps.compass === undefined ? new DeviceCompass() : deps.compass;
    this.current = this.makeSnapshot();
    // Back from the background, the age is brought up to date at once: the
    // ticker may not have run while the app was hidden, and an old fix must
    // not show as current until the next tick.
    const onVisible = deps.onVisible === undefined ? pageVisibility : deps.onVisible;
    this.unsubscribeVisible = onVisible ? onVisible(() => this.refresh()) : () => {};
  }

  /** Brings the fix's age and stale state up to date now. */
  refresh(): void {
    if (this.on) this.notify();
  }

  /** Svelte store contract: called at once with the current state, then on every change. */
  subscribe(run: (s: PositionSnapshot) => void): () => void {
    this.subscribers.add(run);
    run(this.current);
    return () => this.subscribers.delete(run);
  }

  get snapshot(): PositionSnapshot {
    return this.current;
  }

  get sourceKind(): PositionSource['kind'] {
    return this.source.kind;
  }

  /** Where the map should go. The map binding listens; the store never touches the map itself. */
  onCamera(listener: (c: CameraCommand) => void): () => void {
    this.cameraListeners.add(listener);
    return () => this.cameraListeners.delete(listener);
  }

  /** The locate button. Turns position on if off, and centers and follows. */
  tapLocate(): void {
    const was = this.follow;
    this.follow = nextFollowMode(was, 'tap');
    if (!this.on) {
      this.turnOnSource();
    } else if (this.fix) {
      this.emitCamera(this.fix, null);
    } else {
      this.centerOnNextFix = true;
    }
    this.notify();
  }

  /** The user dragged, pinched or turned the map. */
  userMovedMap(): void {
    const next = nextFollowMode(this.follow, 'user-move');
    if (next === this.follow) return;
    this.follow = next;
    this.centerOnNextFix = false;
    this.notify();
  }

  /** Position off entirely: the source and compass stop and the marker goes. */
  turnOff(): void {
    this.apply('turn-off');
    this.error = null;
    this.notify();
  }

  /** Hides the current error message. */
  dismissError(): void {
    if (!this.error) return;
    this.error = null;
    this.notify();
  }

  /** Swaps the position source, for a replayed route in development. Keeps position on if it was. */
  useSource(source: PositionSource): void {
    const wasOn = this.on;
    if (wasOn) void this.source.stop();
    this.unsubscribeSource();
    this.source = source;
    this.unsubscribeSource = source.subscribe((e) => this.onSourceEvent(e));
    this.fix = null;
    this.receivedAt = null;
    if (wasOn) {
      this.centerOnNextFix = this.follow === 'following';
      void source.start();
    }
    this.notify();
  }

  destroy(): void {
    this.turnOff();
    this.unsubscribeVisible();
    this.unsubscribeSource();
    this.subscribers.clear();
    this.cameraListeners.clear();
  }

  private turnOnSource(): void {
    this.on = true;
    this.error = null;
    this.fix = null;
    this.receivedAt = null;
    this.heading = null;
    this.centerOnNextFix = true;
    this.ticker = this.setIntervalFn(() => this.notify(), TICK_MS);
    this.compass?.start((deg) => this.onCompass(deg));
    void this.source.start();
  }

  /** Off or failed: everything that runs stops and the fix is dropped. */
  private apply(event: Extract<FollowEvent, 'turn-off' | 'failed'>): void {
    this.follow = nextFollowMode(this.follow, event);
    if (this.on) void this.source.stop();
    this.on = false;
    if (this.ticker !== null) this.clearIntervalFn(this.ticker);
    this.ticker = null;
    this.compass?.stop();
    this.fix = null;
    this.receivedAt = null;
    this.heading = null;
    this.compassDeg = null;
    this.compassAt = null;
    this.centerOnNextFix = false;
  }

  private onSourceEvent(e: PositionEvent): void {
    switch (e.type) {
      case 'permission':
        this.notify();
        return;
      case 'error':
        // A slow reading is not a failure: keep waiting and say nothing new.
        if (e.error.kind === 'timeout') return;
        console.warn(`position: ${e.error.kind} (${e.error.detail})`);
        this.apply('failed');
        this.error = e.error;
        this.notify();
        return;
      case 'fix':
        this.onFix(e.fix);
    }
  }

  private onFix(fix: PositionFix): void {
    if (!this.on) return;
    this.fix = fix;
    this.receivedAt = this.now();
    this.error = null;
    this.updateHeading();
    if (this.follow === 'following') {
      this.emitCamera(fix, this.centerOnNextFix ? LOCATE_ZOOM : null);
      this.centerOnNextFix = false;
    }
    this.notify();
  }

  private onCompass(deg: number): void {
    if (!this.on) return;
    const now = this.now();
    this.compassDeg = deg;
    this.compassAt = now;
    const before = this.heading;
    this.updateHeading();
    const after = this.heading;
    const turned = !before || !after || before.source !== after.source || Math.abs(after.deg - before.deg) >= COMPASS_MIN_TURN_DEG;
    if (turned && now - this.lastCompassNotify >= COMPASS_MIN_INTERVAL_MS) {
      this.lastCompassNotify = now;
      this.notify();
    }
  }

  private updateHeading(): void {
    const now = this.now();
    const target = this.fix
      ? chooseHeading({
          compassDeg: this.compassDeg,
          compassAgeMs: this.compassAt === null ? null : now - this.compassAt,
          courseDeg: this.fix.headingDeg,
          speedMps: this.fix.speedMps,
        })
      : null;
    this.heading = smoothHeading(this.heading, target);
  }

  private emitCamera(fix: PositionFix, minZoom: number | null): void {
    const cmd: CameraCommand = { lng: fix.lng, lat: fix.lat, minZoom };
    for (const l of [...this.cameraListeners]) l(cmd);
  }

  private makeSnapshot(): PositionSnapshot {
    const now = this.now();
    const stale = isStale(this.receivedAt, now);
    const tooOld = isTooOld(this.receivedAt, now);
    return {
      on: this.on,
      follow: this.follow,
      following: this.follow === 'following',
      permission: this.source.permission,
      fix: this.fix,
      ageMs: fixAgeMs(this.receivedAt, now),
      stale,
      tooOld,
      // A stale fix shows no heading: the phone may have turned since.
      heading: stale ? null : this.heading,
      error: this.error,
    };
  }

  private notify(): void {
    this.current = this.makeSnapshot();
    for (const s of [...this.subscribers]) s(this.current);
  }
}

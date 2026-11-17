// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A position source that plays back a list of timed points. Used by the unit
// tests and, in a development build, from window.__mapapp to walk a route on
// a desktop. It never touches the real location service.

import { bearingDeg, distanceM } from './geo';
import { BasePositionSource, type PositionFix } from './types';

export interface ReplayPoint {
  lng: number;
  lat: number;
  /** When this point is reported, in milliseconds after start. */
  atMs: number;
  /** Defaults to 5 m. */
  accuracyM?: number;
  /** Defaults to the direction from the previous point, when it moved. */
  headingDeg?: number | null;
  /** Defaults to the speed from the previous point. */
  speedMps?: number | null;
}

export interface ReplayOptions {
  /** Start again from the first point after the last one. */
  loop?: boolean;
  /** Playback speed: 2 plays twice as fast. */
  rate?: number;
  /** Clock and timers, replaced in tests. */
  clock?: ReplayClock;
}

export interface ReplayClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realClock: ReplayClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
};

/** Fills in each point's heading and speed from the one before it, where not given. */
export function replayFixes(points: readonly ReplayPoint[]): Omit<PositionFix, 'timeMs'>[] {
  return points.map((p, i) => {
    const prev = i > 0 ? points[i - 1] : undefined;
    let heading: number | null = null;
    let speed: number | null = null;
    if (prev) {
      const d = distanceM(prev.lng, prev.lat, p.lng, p.lat);
      const dt = (p.atMs - prev.atMs) / 1000;
      if (dt > 0) speed = d / dt;
      if (d > 0.5) heading = bearingDeg(prev.lng, prev.lat, p.lng, p.lat);
    }
    return {
      lng: p.lng,
      lat: p.lat,
      accuracyM: p.accuracyM ?? 5,
      headingDeg: p.headingDeg !== undefined ? p.headingDeg : heading,
      speedMps: p.speedMps !== undefined ? p.speedMps : speed,
    };
  });
}

export class ReplayPositionSource extends BasePositionSource {
  readonly kind = 'replay' as const;
  private readonly fixes: Omit<PositionFix, 'timeMs'>[];
  private readonly times: number[];
  private readonly clock: ReplayClock;
  private readonly loop: boolean;
  private readonly rate: number;
  private timer: unknown = null;
  private running = false;
  private next = 0;
  private startedAt = 0;

  constructor(points: readonly ReplayPoint[], options: ReplayOptions = {}) {
    super();
    if (points.length === 0) throw new Error('a replay needs at least one point');
    for (let i = 1; i < points.length; i++) {
      if (points[i]!.atMs < points[i - 1]!.atMs) throw new Error('replay points must be in time order');
    }
    this.fixes = replayFixes(points);
    this.times = points.map((p) => p.atMs);
    this.clock = options.clock ?? realClock;
    this.loop = options.loop ?? false;
    this.rate = options.rate && options.rate > 0 ? options.rate : 1;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.next = 0;
    this.startedAt = this.clock.now();
    this.emitPermission('granted');
    this.schedule();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  /** True while points remain to be played. */
  get playing(): boolean {
    return this.running;
  }

  private schedule(): void {
    if (!this.running) return;
    if (this.next >= this.fixes.length) {
      if (!this.loop) {
        this.running = false;
        return;
      }
      // Go round again, one second after the last point.
      this.startedAt += (this.times[this.times.length - 1]! + 1000) / this.rate;
      this.next = 0;
    }
    const due = this.startedAt + this.times[this.next]! / this.rate;
    const wait = Math.max(0, due - this.clock.now());
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      const fix = this.fixes[this.next]!;
      this.next++;
      this.emitFix({ ...fix, timeMs: this.clock.now() });
      this.schedule();
    }, wait);
  }
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A hand-driven clock for the position tests: time moves only when a test
// calls advance(), and timers fire in time order as it passes them.

interface Timer {
  id: number;
  due: number;
  fn: () => void;
  every: number | null;
}

export class TestClock {
  private t: number;
  private nextId = 1;
  private timers: Timer[] = [];

  constructor(start = 1_000_000) {
    this.t = start;
  }

  now = (): number => this.t;

  setTimeout = (fn: () => void, ms: number): unknown => this.add(fn, ms, null);
  clearTimeout = (h: unknown): void => this.remove(h);
  setInterval = (fn: () => void, ms: number): unknown => this.add(fn, ms, ms);
  clearInterval = (h: unknown): void => this.remove(h);

  /** Moves time forward, firing every timer that falls due on the way. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.due - b.due || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.due > end) break;
      this.t = next.due;
      if (next.every !== null) next.due += next.every;
      else this.timers.shift();
      next.fn();
    }
    this.t = end;
  }

  /**
   * Moves time forward without firing any timer, as when the app is in the
   * background and its timers do not run.
   */
  jump(ms: number): void {
    this.t += ms;
  }

  get pending(): number {
    return this.timers.length;
  }

  private add(fn: () => void, ms: number, every: number | null): number {
    const id = this.nextId++;
    this.timers.push({ id, due: this.t + Math.max(0, ms), fn, every: every === null ? null : Math.max(1, every) });
    return id;
  }

  private remove(h: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== h);
  }
}

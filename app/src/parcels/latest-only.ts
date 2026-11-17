// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Runs an async job for the latest input only, one at a time. A GPS fix can
// arrive while the parcel query for the last one is still running. Queries
// must never pile up: while one runs, newer inputs wait in a single slot,
// each replacing the one before it, and the slot is run when the job ends.
// So at most one job runs, at most one waits, and the newest input always
// gets its answer.

export interface LatestOnlyOptions<I, O> {
  /** The job. It is given an abort signal, which fires when cancel() is called. */
  run: (input: I, signal: AbortSignal) => Promise<O>;
  /** Called with each finished job's input and result, in order. Not called after cancel(). */
  onResult: (input: I, output: O, ms: number) => void;
  /** Called when a job fails (not when it is cancelled). */
  onError?: (input: I, error: unknown) => void;
  /** Skip an input when this says it would give the same answer as the last one run. */
  same?: (a: I, b: I) => boolean;
  /** A steady clock in milliseconds, for timing. */
  now?: () => number;
}

export class LatestOnly<I, O> {
  private running = false;
  private waiting: { input: I } | null = null;
  private last: { input: I } | null = null;
  private controller = new AbortController();
  private readonly now: () => number;

  constructor(private readonly options: LatestOnlyOptions<I, O>) {
    this.now = options.now ?? (() => performance.now());
  }

  /** True while a job runs. */
  get busy(): boolean {
    return this.running;
  }

  /** Asks for an answer for this input. */
  push(input: I): void {
    const same = this.options.same;
    const latest = this.waiting ?? this.last;
    if (same && latest && same(latest.input, input)) {
      // Nothing new to ask; a waiting input that is the same stays as it is.
      return;
    }
    if (this.running) {
      this.waiting = { input };
      return;
    }
    void this.start(input);
  }

  /** Drops the waiting input and ignores the running job's answer. */
  cancel(): void {
    this.waiting = null;
    this.last = null;
    this.controller.abort();
    this.controller = new AbortController();
  }

  private async start(input: I): Promise<void> {
    this.running = true;
    this.last = { input };
    const controller = this.controller;
    const t0 = this.now();
    try {
      const out = await this.options.run(input, controller.signal);
      if (!controller.signal.aborted) this.options.onResult(input, out, this.now() - t0);
    } catch (e) {
      if (!controller.signal.aborted) this.options.onError?.(input, e);
    } finally {
      this.running = false;
      const next = this.waiting;
      this.waiting = null;
      if (next) void this.start(next.input);
    }
  }
}

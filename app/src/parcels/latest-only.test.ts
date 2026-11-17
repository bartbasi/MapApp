// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { LatestOnly } from './latest-only';

/** A job whose calls are resolved by hand. */
function manualJob() {
  const calls: { input: number; resolve: (v: string) => void; reject: (e: unknown) => void; signal: AbortSignal }[] = [];
  const run = (input: number, signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      calls.push({ input, resolve, reject, signal });
    });
  return { calls, run };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('one query at a time, latest input wins', () => {
  it('runs one job, keeps only the newest waiting input, then runs it', async () => {
    const job = manualJob();
    const results: [number, string][] = [];
    const q = new LatestOnly<number, string>({ run: job.run, onResult: (i, o) => results.push([i, o]) });
    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4);
    expect(job.calls.map((c) => c.input)).toEqual([1]);
    expect(q.busy).toBe(true);
    job.calls[0]!.resolve('a');
    await flush();
    // 2 and 3 were replaced by 4 while 1 ran.
    expect(job.calls.map((c) => c.input)).toEqual([1, 4]);
    job.calls[1]!.resolve('d');
    await flush();
    expect(results).toEqual([
      [1, 'a'],
      [4, 'd'],
    ]);
    expect(q.busy).toBe(false);
  });

  it('never has more than one job running', async () => {
    let running = 0;
    let most = 0;
    const q = new LatestOnly<number, number>({
      run: async (i) => {
        running++;
        most = Math.max(most, running);
        await flush();
        running--;
        return i;
      },
      onResult: () => {},
    });
    for (let i = 0; i < 50; i++) {
      q.push(i);
      if (i % 7 === 0) await flush();
    }
    for (let i = 0; i < 10; i++) await flush();
    expect(most).toBe(1);
  });

  it('skips an input that would give the same answer as the last one asked', async () => {
    const job = manualJob();
    const q = new LatestOnly<number, string>({ run: job.run, onResult: () => {}, same: (a, b) => Math.abs(a - b) < 1 });
    q.push(10);
    q.push(10.5);
    expect(job.calls).toHaveLength(1);
    job.calls[0]!.resolve('x');
    await flush();
    expect(job.calls).toHaveLength(1);
    q.push(12);
    expect(job.calls.map((c) => c.input)).toEqual([10, 12]);
  });

  it('cancel drops the waiting input and the running answer, and aborts the job', async () => {
    const job = manualJob();
    const results: number[] = [];
    const q = new LatestOnly<number, string>({ run: job.run, onResult: (i) => results.push(i) });
    q.push(1);
    q.push(2);
    q.cancel();
    expect(job.calls[0]!.signal.aborted).toBe(true);
    job.calls[0]!.resolve('late');
    await flush();
    expect(results).toEqual([]);
    expect(job.calls).toHaveLength(1);
    q.push(3);
    job.calls[1]!.resolve('c');
    await flush();
    expect(results).toEqual([3]);
  });

  it('reports a failure and carries on with the next input', async () => {
    const job = manualJob();
    const errors: number[] = [];
    const results: number[] = [];
    const q = new LatestOnly<number, string>({ run: job.run, onResult: (i) => results.push(i), onError: (i) => errors.push(i) });
    q.push(1);
    q.push(2);
    job.calls[0]!.reject(new Error('bad tile'));
    await flush();
    job.calls[1]!.resolve('ok');
    await flush();
    expect(errors).toEqual([1]);
    expect(results).toEqual([2]);
  });

  it('times each job', async () => {
    let t = 100;
    const job = manualJob();
    const times: number[] = [];
    const q = new LatestOnly<number, string>({ run: job.run, onResult: (_i, _o, ms) => times.push(ms), now: () => t });
    q.push(1);
    t = 112;
    job.calls[0]!.resolve('a');
    await flush();
    expect(times).toEqual([12]);
  });
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaEstimate, AreaRequest } from '../../downloads/contract';
import { ESTIMATE_DEBOUNCE_MS, EstimateRunner, isEmptyEstimate, type EstimateState } from './estimate-runner';

const req = (w: number): AreaRequest => ({ where: { bounds: [w, 39.9, w + 0.1, 40] }, layers: ['basemap'], aerialMaxzoom: 14 });
const est = (bytes: number): AreaEstimate => ({ bytes, layers: [{ county: 'il-macon', layer: 'basemap', title: 'Base map', bytes, tiles: 1 }], missing: [] });

describe('EstimateRunner', () => {
  let states: EstimateState[];
  let calls: { request: AreaRequest; signal: AbortSignal; resolve: (e: AreaEstimate) => void; reject: (e: unknown) => void }[];
  let runner: EstimateRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    states = [];
    calls = [];
    runner = new EstimateRunner(
      (request, signal) => new Promise((resolve, reject) => calls.push({ request, signal, resolve, reject })),
      (s) => states.push(s),
    );
  });

  afterEach(() => {
    runner.destroy();
    vi.useRealTimers();
  });

  it('waits for the map to be still, and asks once for the last place', async () => {
    runner.request(req(-89.1));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS / 2);
    runner.request(req(-89.05));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS / 2);
    runner.request(req(-89.0));
    expect(calls).toHaveLength(0);
    expect(runner.current.kind).toBe('working');
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.request).toEqual(req(-89.0));
    calls[0]!.resolve(est(1000));
    await vi.runAllTimersAsync();
    expect(runner.current).toEqual({ kind: 'ready', estimate: est(1000) });
  });

  it('cancels a question in flight when the frame moves on, and ignores its answer', async () => {
    runner.request(req(-89.1));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    runner.request(req(-89.0));
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(est(5));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    calls[1]!.resolve(est(7));
    await vi.runAllTimersAsync();
    expect(runner.current).toEqual({ kind: 'ready', estimate: est(7) });
    expect(states.filter((s) => s.kind === 'ready')).toHaveLength(1);
  });

  it('does not ask again for the same request', async () => {
    runner.request(req(-89.1));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    calls[0]!.resolve(est(1));
    await vi.runAllTimersAsync();
    runner.request(req(-89.1));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
  });

  it('says offline without asking, and asks when the phone is online again', async () => {
    runner.setOnline(false);
    runner.request(req(-89.1));
    expect(runner.current.kind).toBe('offline');
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS * 2);
    expect(calls).toHaveLength(0);
    runner.setOnline(true);
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);
  });

  it('reads the service error names: nothing here, offline, and other failures', async () => {
    runner.request(req(-89.1));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    calls[0]!.reject(Object.assign(new Error('x'), { code: 'nothing' }));
    await vi.runAllTimersAsync();
    expect(runner.current.kind).toBe('empty');

    runner.request(req(-89.0));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    calls[1]!.reject(Object.assign(new Error('x'), { code: 'offline' }));
    await vi.runAllTimersAsync();
    expect(runner.current.kind).toBe('offline');

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    runner.request(req(-88.9));
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    calls[2]!.reject(new Error('server said no'));
    await vi.runAllTimersAsync();
    expect(runner.current.kind).toBe('error');
    runner.retry();
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS);
    expect(calls).toHaveLength(4);
  });

  it('treats an answer with nothing in it as nothing to download', () => {
    expect(isEmptyEstimate({ bytes: 0, layers: [], missing: ['basemap'] }, req(0))).toBe(true);
    expect(isEmptyEstimate({ bytes: 10, layers: [], missing: ['basemap'] }, req(0))).toBe(true);
    expect(isEmptyEstimate(est(10), req(0))).toBe(false);
  });

  it('clears when there is nothing to ask', () => {
    runner.request(req(-89.1));
    runner.request(null);
    vi.advanceTimersByTime(ESTIMATE_DEBOUNCE_MS * 2);
    expect(calls).toHaveLength(0);
    expect(runner.current.kind).toBe('none');
  });
});

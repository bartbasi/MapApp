// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { urbanaWalk, walkRoute } from './demo-route';
import { distanceM } from './geo';
import { ReplayPositionSource, replayFixes, type ReplayPoint } from './replay-source';
import { TestClock } from './test-clock';
import type { PositionEvent, PositionFix } from './types';

const ROUTE: ReplayPoint[] = [
  { lng: -88.2, lat: 40.1, atMs: 0, accuracyM: 4 },
  { lng: -88.2, lat: 40.10002, atMs: 1000 },
  { lng: -88.2, lat: 40.10004, atMs: 2000, accuracyM: 9 },
];

function record(source: ReplayPositionSource) {
  const events: PositionEvent[] = [];
  source.subscribe((e) => events.push(e));
  const fixes = () => events.filter((e): e is { type: 'fix'; fix: PositionFix } => e.type === 'fix').map((e) => e.fix);
  return { events, fixes };
}

describe('ReplayPositionSource', () => {
  it('reports permission, then each point at its time', async () => {
    const clock = new TestClock();
    const src = new ReplayPositionSource(ROUTE, { clock });
    const { events, fixes } = record(src);
    await src.start();
    expect(events[0]).toEqual({ type: 'permission', state: 'granted' });
    expect(src.permission).toBe('granted');
    clock.advance(0);
    expect(fixes()).toHaveLength(1);
    clock.advance(999);
    expect(fixes()).toHaveLength(1);
    clock.advance(1);
    expect(fixes()).toHaveLength(2);
    clock.advance(1000);
    expect(fixes().map((f) => f.accuracyM)).toEqual([4, 5, 9]);
    expect(src.playing).toBe(false);
  });

  it('works out speed and direction of travel between points', () => {
    const fixes = replayFixes(ROUTE);
    expect(fixes[0]!.headingDeg).toBeNull();
    expect(fixes[0]!.speedMps).toBeNull();
    // About 2.2 m north in one second.
    expect(fixes[1]!.headingDeg).toBeCloseTo(0, 3);
    expect(fixes[1]!.speedMps).toBeCloseTo(distanceM(-88.2, 40.1, -88.2, 40.10002), 6);
  });

  it('stops when asked', async () => {
    const clock = new TestClock();
    const src = new ReplayPositionSource(ROUTE, { clock });
    const { fixes } = record(src);
    await src.start();
    clock.advance(1000);
    await src.stop();
    clock.advance(5000);
    expect(fixes()).toHaveLength(2);
    expect(clock.pending).toBe(0);
  });

  it('plays faster at a higher rate and goes round again when looping', async () => {
    const clock = new TestClock();
    const src = new ReplayPositionSource(ROUTE, { clock, rate: 2, loop: true });
    const { fixes } = record(src);
    await src.start();
    clock.advance(1000); // 0, 500 and 1000 ms at double speed
    expect(fixes()).toHaveLength(3);
    clock.advance(600); // the next lap starts (2000 + 1000) / 2 ms after the first
    expect(fixes()).toHaveLength(4);
    expect(fixes()[3]!.lat).toBe(40.1);
    await src.stop();
  });

  it('refuses an empty route and points out of time order', () => {
    expect(() => new ReplayPositionSource([])).toThrow();
    expect(() => new ReplayPositionSource([ROUTE[1]!, ROUTE[0]!])).toThrow();
  });
});

describe('walkRoute', () => {
  it('walks the legs at the given pace, a reading a second', () => {
    const pts = walkRoute(
      [
        [-88.2, 40.1],
        [-88.2, 40.101],
      ],
      { speedMps: 1.5, accuracyM: 5 },
    );
    const leg = distanceM(-88.2, 40.1, -88.2, 40.101);
    expect(pts).toHaveLength(1 + Math.round(leg / 1.5));
    expect(pts[1]!.atMs).toBe(1000);
    expect(pts[pts.length - 1]!.lat).toBeCloseTo(40.101, 9);
  });

  it('the Urbana demo walk stays near Urbana and ends standing still', () => {
    const pts = urbanaWalk();
    for (const p of pts) {
      expect(distanceM(-88.2, 40.1, p.lng, p.lat)).toBeLessThan(600);
    }
    expect(pts[pts.length - 1]!.speedMps).toBe(0);
  });
});

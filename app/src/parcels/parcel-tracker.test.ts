// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { LngLat, PositionQuery } from './parcel-source';
import { ParcelTracker, type OutlineSource, type TrackerState } from './parcel-tracker';
import { StoredParcelSource } from './stored-parcel-source';
import { SynthWorld, rect } from './test-tiles';

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

const world = new SynthWorld();
const parcels = [
  { properties: { pid: 'A', owner: 'OWNER A', acres: 2.5, county: 'il-test' }, rings: [rect(-100, -100, 0, 100)] },
  { properties: { pid: 'B', owner: 'OWNER B', acres: 2.5, county: 'il-test' }, rings: [rect(0, -100, 100, 100)] },
];

function kindOf(s: TrackerState): string {
  const r = s.readout;
  if (!r) return 'none';
  return r.kind === 'inside' ? `inside ${r.parcel.pid}` : r.kind;
}

describe('parcel tracker', () => {
  it('follows a walk across a line: inside, near the line, the other side', async () => {
    const tracker = new ParcelTracker(new StoredParcelSource([world.archive(parcels)]));
    const seen: string[] = [];
    for (const east of [-30, -2, 2, 30]) {
      tracker.update({ ...world.at(east, 0), accuracyM: 4 });
      await flush();
      seen.push(kindOf(tracker.current));
    }
    expect(seen).toEqual(['inside A', 'near-line', 'near-line', 'inside B']);
    expect(tracker.timings().count).toBe(4);
  });

  it('highlights the parcel the phone is in, and draws the connector', async () => {
    const tracker = new ParcelTracker(new StoredParcelSource([world.archive(parcels)]));
    tracker.update({ ...world.at(-30, 0), accuracyM: 4 });
    await flush();
    expect(tracker.current.relation.features.map((f) => f.properties.part)).toEqual(['here', 'connector', 'tick']);
  });

  it('asks again only when the phone has moved, and never runs two queries at once', async () => {
    let running = 0;
    let most = 0;
    const asked: LngLat[] = [];
    const inner = new StoredParcelSource([world.archive(parcels)]);
    const source: OutlineSource = {
      parcelsAt: (at) => inner.parcelsAt(at),
      outline: async () => null,
      positionQuery: async (at): Promise<PositionQuery> => {
        asked.push(at);
        running++;
        most = Math.max(most, running);
        const q = await inner.positionQuery(at);
        running--;
        return q;
      },
    };
    const tracker = new ParcelTracker(source);
    for (let i = 0; i < 10; i++) tracker.update({ ...world.at(-30 + i * 0.1, 0), accuracyM: 4 });
    await flush();
    tracker.update({ ...world.at(-20, 0), accuracyM: 4 });
    await flush();
    expect(most).toBe(1);
    // The first fix, then the latest of the nine that came while it ran (moved 0.9 m), then the one 10 m on.
    expect(asked).toHaveLength(3);
    expect(kindOf(tracker.current)).toBe('inside A');
  });

  it('clears everything when position goes off', async () => {
    const tracker = new ParcelTracker(new StoredParcelSource([world.archive(parcels)]));
    tracker.update({ ...world.at(-30, 0), accuracyM: 4 });
    await flush();
    tracker.update(null);
    expect(tracker.current).toMatchObject({ readout: null, fix: null });
    expect(tracker.current.relation.features).toEqual([]);
  });

  it('says no data outside the archive', async () => {
    const tracker = new ParcelTracker(new StoredParcelSource([world.archive(parcels)]));
    tracker.update({ lng: -88.2, lat: 40.1, accuracyM: 4 });
    await flush();
    expect(tracker.current.readout).toEqual({ kind: 'no-data', reason: 'no-archive' });
  });
});

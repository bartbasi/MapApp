// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the web app makes of an area's state from the native downloader,
// whether or not the native side sends the mobile data fields yet.

import { describe, expect, it } from 'vitest';
import type { AreaState } from '../downloads/contract';
import { areaStateFromNative } from './android';

const base = { id: 'a1', record: '{}', bytesDone: 1, bytesTotal: 2 };

describe('area states from the native side', () => {
  it('reads allowMetered as false unless it is true', () => {
    expect(areaStateFromNative({ ...base, status: 'downloading' } as unknown as AreaState).allowMetered).toBe(false);
    expect(areaStateFromNative({ ...base, status: 'downloading', allowMetered: 'yes' } as unknown as AreaState).allowMetered).toBe(false);
    expect(areaStateFromNative({ ...base, status: 'downloading', allowMetered: true }).allowMetered).toBe(true);
  });

  it('keeps waitingFor only with status waiting and a known value', () => {
    expect(areaStateFromNative({ ...base, status: 'waiting', allowMetered: false, waitingFor: 'unmetered' }).waitingFor).toBe('unmetered');
    expect(areaStateFromNative({ ...base, status: 'waiting', allowMetered: false, waitingFor: 'connection' }).waitingFor).toBe('connection');
    expect(areaStateFromNative({ ...base, status: 'waiting', allowMetered: false, waitingFor: 'wifi' } as unknown as AreaState).waitingFor).toBeUndefined();
    expect(areaStateFromNative({ ...base, status: 'paused', allowMetered: false, waitingFor: 'unmetered' }).waitingFor).toBeUndefined();
  });
});

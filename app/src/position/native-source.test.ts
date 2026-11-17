// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Android source's permission steps, with a fake plugin standing in for
// Android. What Android shows is described in native-source.ts; this checks
// what the app does with each answer.

import type { PermissionStatus, WatchPositionCallback } from '@capacitor/geolocation';
import { describe, expect, it } from 'vitest';
import { NativePositionSource, type GeolocationPlugin } from './native-source';
import { PositionStore } from './store';
import { positionMessage } from './messages';
import { TestClock } from './test-clock';
import type { PositionEvent } from './types';

type State = PermissionStatus['location'];

/**
 * A fake plugin. `answers` is what each permission request returns in turn,
 * as the user's choice in Android's prompt would.
 */
class FakePlugin implements GeolocationPlugin {
  requests = 0;
  watches: WatchPositionCallback[] = [];
  constructor(
    public status: PermissionStatus,
    private readonly answers: PermissionStatus[] = [],
  ) {}
  async checkPermissions() {
    return this.status;
  }
  async requestPermissions() {
    this.requests++;
    this.status = this.answers.shift() ?? this.status;
    return this.status;
  }
  async watchPosition(_o: unknown, cb: WatchPositionCallback) {
    this.watches.push(cb);
    return `w${this.watches.length}`;
  }
  async clearWatch() {}
}

const status = (location: State, coarseLocation: State): PermissionStatus => ({ location, coarseLocation });
const PRECISE = status('granted', 'granted');
const APPROXIMATE = status('denied', 'granted');
const NEITHER = status('prompt', 'prompt');
const REFUSED = status('denied', 'denied');

function setup(plugin: FakePlugin) {
  const source = new NativePositionSource(plugin);
  const events: PositionEvent[] = [];
  source.subscribe((e) => events.push(e));
  return { source, events, errors: () => events.flatMap((e) => (e.type === 'error' ? [e.error.kind] : [])) };
}

describe('native source permission', () => {
  it('with the precise permission, watches without asking', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.requests).toBe(0);
    expect(plugin.watches).toHaveLength(1);
    expect(t.source.permission).toBe('granted');
  });

  it('first tap, the user picks Precise: watches', async () => {
    const plugin = new FakePlugin(NEITHER, [PRECISE]);
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.requests).toBe(1);
    expect(plugin.watches).toHaveLength(1);
  });

  it('first tap, the user picks Approximate: does not watch, and says precise location is needed', async () => {
    const plugin = new FakePlugin(NEITHER, [APPROXIMATE]);
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.watches).toHaveLength(0);
    expect(t.errors()).toEqual(['approximate']);
    expect(t.source.permission).toBe('approximate');
  });

  it('second tap with Approximate held: asks once more (Android offers the change to precise), and watches if the user agrees', async () => {
    const plugin = new FakePlugin(APPROXIMATE, [PRECISE]);
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.requests).toBe(1);
    expect(plugin.watches).toHaveLength(1);
    expect(t.errors()).toEqual([]);
  });

  it('second tap with Approximate held, the user keeps it or Android no longer asks: says so again, never watches', async () => {
    const plugin = new FakePlugin(APPROXIMATE, [APPROXIMATE]);
    const t = setup(plugin);
    await t.source.start();
    await t.source.start();
    expect(plugin.requests).toBe(2);
    expect(plugin.watches).toHaveLength(0);
    expect(t.errors()).toEqual(['approximate', 'approximate']);
  });

  it('a refusal is a refusal', async () => {
    const plugin = new FakePlugin(NEITHER, [REFUSED]);
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.watches).toHaveLength(0);
    expect(t.errors()).toEqual(['denied']);
  });

  it('through the store: Approximate shows the precise location message with the settings button, and no position', async () => {
    const plugin = new FakePlugin(NEITHER, [APPROXIMATE]);
    const clock = new TestClock();
    const store = new PositionStore(new NativePositionSource(plugin), { now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval, compass: null, onVisible: null });
    store.tapLocate();
    await new Promise((r) => setTimeout(r, 0));
    const s = store.snapshot;
    expect(s).toMatchObject({ on: false, fix: null, follow: 'off' });
    const m = positionMessage(s, { android: true, canOpenSettings: true });
    expect(m).toMatchObject({ kind: 'approximate', title: 'MapApp needs your precise location.', settings: 'app' });
    store.destroy();
  });
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The Android source's permission steps and watch events, with a fake plugin
// standing in for Android. What Android shows is described in
// native-source.ts; this checks what the app does with each answer.

import { describe, expect, it } from 'vitest';
import {
  NativePositionSource,
  type DeviceLocationPlugin,
  type LocationPermissionStatus,
  type LocationStatus,
  type NativeFix,
  type NativeWatchCallback,
} from './native-source';
import { PositionStore } from './store';
import { positionMessage } from './messages';
import { TestClock } from './test-clock';
import type { PositionEvent } from './types';

type State = LocationPermissionStatus['location'];

/**
 * A fake plugin. `answers` is what each permission request returns in turn,
 * as the user's choice in Android's prompt would.
 */
class FakePlugin implements DeviceLocationPlugin {
  requests = 0;
  watches: NativeWatchCallback[] = [];
  cleared: string[] = [];
  locationEnabled = true;
  constructor(
    public permissions: LocationPermissionStatus,
    private readonly answers: LocationPermissionStatus[] = [],
  ) {}
  async status(): Promise<LocationStatus> {
    return { locationEnabled: this.locationEnabled, gps: true, fused: true };
  }
  async checkPermissions() {
    return this.permissions;
  }
  async requestPermissions() {
    this.requests++;
    this.permissions = this.answers.shift() ?? this.permissions;
    return this.permissions;
  }
  async watch(_o: unknown, cb: NativeWatchCallback) {
    this.watches.push(cb);
    return `w${this.watches.length}`;
  }
  async clearWatch({ id }: { id: string }) {
    this.cleared.push(id);
  }
  /** Sends an event on the latest watch. */
  send(event: Parameters<NativeWatchCallback>[0]) {
    this.watches[this.watches.length - 1]!(event);
  }
}

const status = (location: State, coarseLocation: State): LocationPermissionStatus => ({ location, coarseLocation });
const PRECISE = status('granted', 'granted');
const APPROXIMATE = status('denied', 'granted');
const NEITHER = status('prompt', 'prompt');
const REFUSED = status('denied', 'denied');

const FIX: NativeFix = { type: 'fix', provider: 'gps', lng: -89.061662, lat: 39.9155, accuracyM: 5, timeMs: 1000, ageMs: 20 };

function setup(plugin: FakePlugin) {
  const source = new NativePositionSource(plugin);
  const events: PositionEvent[] = [];
  source.subscribe((e) => events.push(e));
  return {
    source,
    events,
    errors: () => events.flatMap((e) => (e.type === 'error' ? [e.error.kind] : [])),
    fixes: () => events.flatMap((e) => (e.type === 'fix' ? [e.fix] : [])),
  };
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

describe('native source, Location switched off', () => {
  it('off at the tap: says so before asking anything, and does not watch', async () => {
    const plugin = new FakePlugin(NEITHER, [PRECISE]);
    plugin.locationEnabled = false;
    const t = setup(plugin);
    await t.source.start();
    expect(plugin.requests).toBe(0);
    expect(plugin.watches).toHaveLength(0);
    expect(t.errors()).toEqual(['location-off']);
  });

  it('switched off while watching: the watch ends with location-off, and a new tap watches again', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    plugin.send({ type: 'error', code: 'location-off' });
    expect(t.errors()).toEqual(['location-off']);
    // The plugin has already ended it, so there is nothing to clear.
    await t.source.stop();
    expect(plugin.cleared).toEqual([]);
    await t.source.start();
    expect(plugin.watches).toHaveLength(2);
  });

  it('through the store: shows the Location message with the Location settings button', async () => {
    const plugin = new FakePlugin(PRECISE);
    plugin.locationEnabled = false;
    const clock = new TestClock();
    const store = new PositionStore(new NativePositionSource(plugin), { now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval, compass: null, onVisible: null });
    store.tapLocate();
    await new Promise((r) => setTimeout(r, 0));
    const m = positionMessage(store.snapshot, { android: true, canOpenSettings: true });
    expect(m).toMatchObject({ kind: 'location-off', title: 'Location is switched off on this phone.', settings: 'location' });
    store.destroy();
  });
});

describe('native source watch', () => {
  it('passes each fix on, with its age at delivery', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    plugin.send(FIX);
    plugin.send({ ...FIX, provider: 'fused', accuracyM: undefined, ageMs: 300 });
    expect(t.fixes()).toEqual([
      { lng: -89.061662, lat: 39.9155, accuracyM: 5, headingDeg: null, speedMps: null, timeMs: 1000, ageAtDeliveryMs: 20 },
      { lng: -89.061662, lat: 39.9155, accuracyM: 0, headingDeg: null, speedMps: null, timeMs: 1000, ageAtDeliveryMs: 300 },
    ]);
  });

  it('stop clears the watch, and its late fixes are ignored', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    const first = plugin.watches[0]!;
    await t.source.stop();
    expect(plugin.cleared).toEqual(['w1']);
    first(FIX);
    expect(t.fixes()).toEqual([]);
  });

  it('a start while running does nothing', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    await t.source.start();
    expect(plugin.watches).toHaveLength(1);
  });

  it('a stop during the permission prompt means no watch', async () => {
    const plugin = new FakePlugin(NEITHER, [PRECISE]);
    const t = setup(plugin);
    const starting = t.source.start();
    await t.source.stop();
    await starting;
    expect(plugin.watches).toHaveLength(0);
  });

  it('the plugin refusing the watch (permission taken away) reads as a refusal', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    plugin.send({ type: 'error', code: 'denied' });
    expect(t.errors()).toEqual(['denied']);
    expect(t.source.permission).toBe('denied');
  });

  it('a phone with no location provider reads as unavailable', async () => {
    const plugin = new FakePlugin(PRECISE);
    const t = setup(plugin);
    await t.source.start();
    plugin.send({ type: 'error', code: 'unavailable' });
    expect(t.errors()).toEqual(['unavailable']);
  });
});

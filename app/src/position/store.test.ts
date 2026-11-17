// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { CompassSensor } from './compass';
import { LOCATE_ZOOM, locateZoom, nextFollowMode } from './follow';
import { NO_POSITION_AFTER_MS, STALE_AFTER_MS, PositionStore, fixAgeMs, fixTakenAt, isStale, isTooOld, type CameraCommand, type PositionSnapshot } from './store';
import { TestClock } from './test-clock';
import { BasePositionSource, type PositionErrorKind, type PositionFix } from './types';

/** A source the test drives by hand. */
class HandSource extends BasePositionSource {
  readonly kind = 'replay' as const;
  starts = 0;
  stops = 0;
  async start() {
    this.starts++;
  }
  async stop() {
    this.stops++;
  }
  grant() {
    this.emitPermission('granted');
  }
  send(fix: Partial<PositionFix> = {}) {
    this.emitFix({ lng: -88.2, lat: 40.1, accuracyM: 5, headingDeg: null, speedMps: null, timeMs: 0, ...fix });
  }
  fail(kind: PositionErrorKind) {
    if (kind === 'denied') this.emitPermission('denied');
    this.emitError(kind, 'test');
  }
}

class HandCompass implements CompassSensor {
  listener: ((deg: number) => void) | null = null;
  start(fn: (deg: number) => void) {
    this.listener = fn;
  }
  stop() {
    this.listener = null;
  }
}

function setup() {
  const clock = new TestClock();
  const source = new HandSource();
  const compass = new HandCompass();
  let visible: (() => void) | null = null;
  const onVisible = (fn: () => void) => {
    visible = fn;
    return () => (visible = null);
  };
  const store = new PositionStore(source, { now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval, compass, onVisible });
  const camera: CameraCommand[] = [];
  store.onCamera((c) => camera.push(c));
  let last: PositionSnapshot = store.snapshot;
  let updates = 0;
  store.subscribe((s) => {
    last = s;
    updates++;
  });
  return { clock, source, compass, store, camera, snap: () => last, updates: () => updates, becomeVisible: () => visible?.() };
}

describe('stale detection', () => {
  it('a fix is stale after more than 10 seconds', () => {
    expect(isStale(null, 5000)).toBe(false);
    expect(isStale(1000, 1000 + STALE_AFTER_MS)).toBe(false);
    expect(isStale(1000, 1001 + STALE_AFTER_MS)).toBe(true);
    expect(fixAgeMs(1000, 4500)).toBe(3500);
    expect(fixAgeMs(null, 4500)).toBeNull();
  });

  it('the store turns stale when the fixes stop, and fresh again on the next one', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    expect(t.snap().stale).toBe(false);
    expect(t.snap().ageMs).toBe(0);
    t.clock.advance(10_000);
    expect(t.snap().stale).toBe(false);
    expect(t.snap().ageMs).toBe(10_000);
    t.clock.advance(1000);
    expect(t.snap().stale).toBe(true);
    expect(t.snap().ageMs).toBe(11_000);
    t.source.send();
    expect(t.snap().stale).toBe(false);
  });

  it('a stale fix shows no heading', () => {
    const t = setup();
    t.store.tapLocate();
    t.compass.listener!(45);
    t.source.send();
    expect(t.snap().heading?.source).toBe('compass');
    t.clock.advance(11_000);
    expect(t.snap().heading).toBeNull();
  });
});

describe('a fix too old to use', () => {
  it('is too old after more than five minutes, and the limit is one named constant', () => {
    expect(NO_POSITION_AFTER_MS).toBe(300_000);
    expect(isTooOld(null, 10_000_000)).toBe(false);
    expect(isTooOld(1000, 1000 + NO_POSITION_AFTER_MS)).toBe(false);
    expect(isTooOld(1000, 1001 + NO_POSITION_AFTER_MS)).toBe(true);
  });

  it('the store says so after five minutes without a fix, and not before', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    t.clock.advance(NO_POSITION_AFTER_MS);
    expect(t.snap()).toMatchObject({ stale: true, tooOld: false });
    t.clock.advance(1000);
    expect(t.snap()).toMatchObject({ stale: true, tooOld: true });
    t.source.send();
    expect(t.snap()).toMatchObject({ stale: false, tooOld: false });
  });

  it('back from the background, an old fix is marked stale at once, before the next tick', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    // Hidden: time passes, the ticker does not run.
    t.clock.jump(60_000);
    expect(t.snap().stale).toBe(false);
    t.becomeVisible();
    expect(t.snap()).toMatchObject({ stale: true, ageMs: 60_000 });
    t.clock.jump(NO_POSITION_AFTER_MS);
    t.becomeVisible();
    expect(t.snap().tooOld).toBe(true);
  });

  it('counts the age from when the fix was taken, when the source knows it', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send({ ageAtDeliveryMs: 1500 });
    expect(t.snap().ageMs).toBe(1500);
    // A fix that was already 9 s old turns stale 1 s and a bit later, not 10 s later.
    t.source.send({ ageAtDeliveryMs: 9000 });
    t.clock.advance(1000);
    expect(t.snap()).toMatchObject({ ageMs: 10_000, stale: false });
    t.clock.advance(1000);
    expect(t.snap()).toMatchObject({ ageMs: 11_000, stale: true });
  });

  it('counts from arrival when the source gives no age, or a nonsense one', () => {
    expect(fixTakenAt({ lng: 0, lat: 0, accuracyM: 5, headingDeg: null, speedMps: null, timeMs: 0 }, 5000)).toBe(5000);
    for (const bad of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fixTakenAt({ lng: 0, lat: 0, accuracyM: 5, headingDeg: null, speedMps: null, timeMs: 0, ageAtDeliveryMs: bad }, 5000)).toBe(5000);
    }
    expect(fixTakenAt({ lng: 0, lat: 0, accuracyM: 5, headingDeg: null, speedMps: null, timeMs: 0, ageAtDeliveryMs: 250 }, 5000)).toBe(4750);
  });

  it('stops listening for the app coming back when destroyed', () => {
    const t = setup();
    t.store.destroy();
    expect(() => t.becomeVisible()).not.toThrow();
  });
});

describe('follow state machine', () => {
  it('off, following, not following, following', () => {
    let m = nextFollowMode('off', 'tap');
    expect(m).toBe('following');
    m = nextFollowMode(m, 'user-move');
    expect(m).toBe('free');
    m = nextFollowMode(m, 'tap');
    expect(m).toBe('following');
    expect(nextFollowMode(m, 'tap')).toBe('following');
    expect(nextFollowMode('off', 'user-move')).toBe('off');
    expect(nextFollowMode('free', 'user-move')).toBe('free');
    expect(nextFollowMode('following', 'turn-off')).toBe('off');
    expect(nextFollowMode('free', 'failed')).toBe('off');
  });

  it('zooms to 17 on the first fix, or keeps a closer zoom', () => {
    expect(locateZoom(12)).toBe(17);
    expect(locateZoom(19)).toBe(19);
  });

  it('the store: first tap starts the source and centers at zoom 17 on the first fix', () => {
    const t = setup();
    expect(t.snap().follow).toBe('off');
    t.store.tapLocate();
    expect(t.source.starts).toBe(1);
    expect(t.snap()).toMatchObject({ on: true, follow: 'following', following: true, fix: null });
    expect(t.camera).toHaveLength(0);
    t.source.send({ lng: -88.21, lat: 40.11 });
    expect(t.camera).toEqual([{ lng: -88.21, lat: 40.11, minZoom: LOCATE_ZOOM }]);
    t.source.send({ lng: -88.211, lat: 40.111 });
    expect(t.camera[1]).toEqual({ lng: -88.211, lat: 40.111, minZoom: null });
  });

  it('the store: a hand move stops following, keeps the marker, and a tap follows again', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    t.store.userMovedMap();
    expect(t.snap()).toMatchObject({ on: true, follow: 'free', following: false });
    expect(t.snap().fix).not.toBeNull();
    t.source.send({ lat: 40.2 });
    expect(t.camera).toHaveLength(1);
    t.store.tapLocate();
    expect(t.snap().follow).toBe('following');
    expect(t.camera[1]).toEqual({ lng: -88.2, lat: 40.2, minZoom: null });
    expect(t.source.starts).toBe(1);
  });

  it('the store: a tap while following keeps position on', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    t.store.tapLocate();
    expect(t.snap()).toMatchObject({ on: true, follow: 'following' });
    expect(t.source.stops).toBe(0);
  });

  it('the store: a hand move before the first fix means no jump when it comes', () => {
    const t = setup();
    t.store.tapLocate();
    t.store.userMovedMap();
    t.source.send();
    expect(t.camera).toHaveLength(0);
    expect(t.snap().follow).toBe('free');
  });

  it('the store: turning off stops everything and drops the fix', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    t.store.turnOff();
    expect(t.source.stops).toBe(1);
    expect(t.compass.listener).toBeNull();
    expect(t.snap()).toMatchObject({ on: false, follow: 'off', fix: null, heading: null });
    // A late fix from the stopped source is ignored.
    t.source.send();
    expect(t.snap().fix).toBeNull();
    // No ticking while off.
    const before = t.updates();
    t.clock.advance(5000);
    expect(t.updates()).toBe(before);
  });
});

describe('errors and permission', () => {
  it('a refusal turns position off and keeps the error until dismissed', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.fail('denied');
    expect(t.snap()).toMatchObject({ on: false, follow: 'off', permission: 'denied' });
    expect(t.snap().error?.kind).toBe('denied');
    t.store.dismissError();
    expect(t.snap().error).toBeNull();
  });

  it('Location switched off turns position off; a new tap tries again', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.fail('location-off');
    expect(t.snap().error?.kind).toBe('location-off');
    expect(t.snap().on).toBe(false);
    t.store.tapLocate();
    expect(t.source.starts).toBe(2);
    expect(t.snap().error).toBeNull();
  });

  it('a timeout is not a failure: the store keeps waiting', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.fail('timeout');
    expect(t.snap()).toMatchObject({ on: true, error: null });
  });

  it('passes on the permission the source learned', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.grant();
    expect(t.snap().permission).toBe('granted');
  });
});

describe('heading through the store', () => {
  it('uses the compass standing still and the course when walking', () => {
    const t = setup();
    t.store.tapLocate();
    t.compass.listener!(100);
    t.source.send({ speedMps: 0, headingDeg: 0 });
    expect(t.snap().heading).toEqual({ deg: 100, source: 'compass' });
    t.source.send({ speedMps: 1.5, headingDeg: 270 });
    expect(t.snap().heading).toEqual({ deg: 270, source: 'course' });
  });

  it('shows no heading when there is no compass and the phone is still', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send({ speedMps: 0, headingDeg: 0 });
    expect(t.snap().heading).toBeNull();
  });

  it('does not pass on every tiny compass change', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    t.compass.listener!(100);
    const before = t.updates();
    for (let i = 0; i < 10; i++) t.compass.listener!(100.1);
    expect(t.updates()).toBe(before);
  });
});

describe('swapping the source', () => {
  it('keeps position on and centers on the new source’s first fix', () => {
    const t = setup();
    t.store.tapLocate();
    t.source.send();
    const next = new HandSource();
    t.store.useSource(next);
    expect(t.source.stops).toBe(1);
    expect(next.starts).toBe(1);
    expect(t.snap().fix).toBeNull();
    next.send({ lat: 40.3 });
    expect(t.camera[t.camera.length - 1]).toEqual({ lng: -88.2, lat: 40.3, minZoom: LOCATE_ZOOM });
    // The old source is no longer heard.
    t.source.send({ lat: 41 });
    expect(t.snap().fix?.lat).toBe(40.3);
  });
});

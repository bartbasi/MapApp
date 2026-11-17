// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { markerData } from './marker';
import { accuracyText, formatAge, formatDistance, positionMessage, type MessageContext } from './messages';
import type { PositionSnapshot } from './store';

const ANDROID: MessageContext = { android: true, canOpenSettings: true };
const BROWSER: MessageContext = { android: false, canOpenSettings: false };

const FIX = { lng: -88.2, lat: 40.1, accuracyM: 4, headingDeg: null, speedMps: null, timeMs: 0 };

function snap(o: Partial<PositionSnapshot>): PositionSnapshot {
  return { on: true, follow: 'following', following: true, permission: 'granted', fix: FIX, ageMs: 0, stale: false, tooOld: false, heading: null, error: null, ...o };
}

describe('words', () => {
  // The words with ordinary spaces, for comparing.
  const plain = (s: string) => s.replace(/\u00a0/g, ' ');

  it('gives feet first, then meters', () => {
    expect(plain(accuracyText(4))).toBe('GPS accurate to about 13 ft (4 m)');
    expect(plain(formatDistance(0.2))).toBe('1 ft (1 m)');
    expect(plain(formatDistance(65))).toBe('210 ft (65 m)');
    expect(plain(formatDistance(2000))).toBe('1.2 mi (2.0 km)');
  });

  it('says the accuracy is not known when the fix gives none, never about 0 ft', () => {
    expect(accuracyText(0)).toBe('GPS accuracy not known');
    expect(accuracyText(-1)).toBe('GPS accuracy not known');
    expect(accuracyText(NaN)).toBe('GPS accuracy not known');
    expect(accuracyText(Infinity)).toBe('GPS accuracy not known');
  });

  it('keeps each number with its unit', () => {
    expect(formatDistance(4)).toBe('13\u00a0ft (4\u00a0m)');
  });

  it('gives ages in seconds, then minutes, then hours', () => {
    expect(formatAge(45_200)).toBe('45 s');
    expect(formatAge(185_000)).toBe('3 min');
    expect(formatAge(2 * 3600_000 + 5000)).toBe('2 h');
  });

  it('uses no em dashes anywhere', () => {
    const all = [
      positionMessage(snap({ on: false, error: { kind: 'denied', detail: '' } }), ANDROID),
      positionMessage(snap({ on: false, error: { kind: 'denied', detail: '' } }), BROWSER),
      positionMessage(snap({ on: false, error: { kind: 'location-off', detail: '' } }), ANDROID),
      positionMessage(snap({ on: false, error: { kind: 'approximate', detail: '' } }), ANDROID),
      positionMessage(snap({ on: false, error: { kind: 'approximate', detail: '' } }), BROWSER),
      positionMessage(snap({ on: false, error: { kind: 'unavailable', detail: '' } }), ANDROID),
      positionMessage(snap({ fix: null }), ANDROID),
      positionMessage(snap({ stale: true, ageMs: 45_000 }), ANDROID),
    ];
    for (const m of all) {
      expect(m).not.toBeNull();
      expect(`${m!.title} ${m!.body}`).not.toMatch(/\u2014/);
    }
  });
});

describe('positionMessage', () => {
  it('says nothing with a fresh fix or with position off', () => {
    expect(positionMessage(snap({}), ANDROID)).toBeNull();
    expect(positionMessage(snap({ on: false, fix: null }), ANDROID)).toBeNull();
  });

  it('a refusal on Android offers the app settings page', () => {
    const m = positionMessage(snap({ on: false, error: { kind: 'denied', detail: '' } }), ANDROID)!;
    expect(m.kind).toBe('denied');
    expect(m.settings).toBe('app');
    expect(m.body).toMatch(/Permissions/);
    expect(m.dismissible).toBe(true);
  });

  it('a refusal in a browser offers no button', () => {
    expect(positionMessage(snap({ on: false, error: { kind: 'denied', detail: '' } }), BROWSER)!.settings).toBeNull();
  });

  it('Location switched off offers the Location page', () => {
    const m = positionMessage(snap({ on: false, error: { kind: 'location-off', detail: '' } }), ANDROID)!;
    expect(m.title).toBe('Location is switched off on this phone.');
    expect(m.settings).toBe('location');
  });

  it('approximate location only: says precise location is needed, and where to turn it on', () => {
    const m = positionMessage(snap({ on: false, fix: null, error: { kind: 'approximate', detail: '' } }), ANDROID)!;
    expect(m.kind).toBe('approximate');
    expect(m.title).toBe('MapApp needs your precise location.');
    expect(m.body).toContain('Permissions, then Location, and turn on Use precise location');
    expect(m.body).not.toMatch(/weak|open sky|into the open/);
    expect(m.settings).toBe('app');
    expect(m.dismissible).toBe(true);
  });

  it('waiting for the first fix', () => {
    expect(positionMessage(snap({ fix: null }), ANDROID)!.kind).toBe('waiting');
  });

  it('stale says how old the last position is', () => {
    expect(positionMessage(snap({ stale: true, ageMs: 45_000 }), ANDROID)!.title).toBe('Last position 45 s ago.');
  });
});

describe('markerData', () => {
  it('is empty with position off or no fix', () => {
    expect(markerData(snap({ on: false })).features).toHaveLength(0);
    expect(markerData(snap({ fix: null })).features).toHaveLength(0);
  });

  it('draws the accuracy circle and the dot, and the wedge only with a heading', () => {
    const parts = (s: PositionSnapshot) => markerData(s).features.map((f) => f.properties.part);
    expect(parts(snap({}))).toEqual(['accuracy', 'dot']);
    expect(parts(snap({ heading: { deg: 33, source: 'compass' } }))).toEqual(['accuracy', 'heading', 'dot']);
    const wedge = markerData(snap({ heading: { deg: 33.333, source: 'compass' } })).features[1]!;
    expect(wedge.properties.heading).toBe(33.3);
  });

  it('draws no accuracy circle when the accuracy is not known', () => {
    const parts = (s: PositionSnapshot) => markerData(s).features.map((f) => f.properties.part);
    expect(parts(snap({ fix: { ...FIX, accuracyM: 0 } }))).toEqual(['dot']);
    expect(parts(snap({ fix: { ...FIX, accuracyM: NaN } }))).toEqual(['dot']);
  });

  it('marks a stale fix and drops its wedge', () => {
    const d = markerData(snap({ stale: true, heading: { deg: 33, source: 'compass' } }));
    expect(d.features.map((f) => f.properties.part)).toEqual(['accuracy', 'dot']);
    expect(d.features.every((f) => f.properties.stale)).toBe(true);
  });
});

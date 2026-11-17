// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// How the Android plugin's and the browser's readings and errors are read.

import { describe, expect, it } from 'vitest';
import { browserErrorKind } from './browser-source';
import { fixFromNative, nativeErrorKind, type NativeFix } from './native-source';

describe('native source', () => {
  it('maps the plugin error codes to the app’s kinds', () => {
    expect(nativeErrorKind('denied')).toBe('denied');
    expect(nativeErrorKind('location-off')).toBe('location-off');
    expect(nativeErrorKind('unavailable')).toBe('unavailable');
    expect(nativeErrorKind('something new')).toBe('unavailable');
    expect(nativeErrorKind(undefined)).toBe('unavailable');
  });

  const full: NativeFix = { type: 'fix', provider: 'gps', lng: -88.2, lat: 40.1, accuracyM: 6, bearingDeg: 180, speedMps: 1.2, timeMs: 5, ageMs: 40 };

  it('reads every field of a plugin fix, with the age it already had', () => {
    expect(fixFromNative(full)).toEqual({ lng: -88.2, lat: 40.1, accuracyM: 6, headingDeg: 180, speedMps: 1.2, timeMs: 5, ageAtDeliveryMs: 40 });
  });

  it('a fix with no accuracy reads as accuracy not known (0), and no bearing or speed as none', () => {
    const bare: NativeFix = { type: 'fix', provider: 'fused', lng: -88.2, lat: 40.1, timeMs: 5, ageMs: 0 };
    expect(fixFromNative(bare)).toMatchObject({ accuracyM: 0, headingDeg: null, speedMps: null });
  });

  it('a nonsense age counts as none', () => {
    expect(fixFromNative({ ...full, ageMs: -3 }).ageAtDeliveryMs).toBe(0);
    expect(fixFromNative({ ...full, ageMs: Number.NaN }).ageAtDeliveryMs).toBe(0);
  });
});

describe('browser source', () => {
  it('maps GeolocationPositionError codes', () => {
    expect(browserErrorKind(1)).toBe('denied');
    expect(browserErrorKind(2)).toBe('unavailable');
    expect(browserErrorKind(3)).toBe('timeout');
  });
});

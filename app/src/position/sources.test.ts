// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// How the Android plugin's and the browser's readings and errors are read.

import { describe, expect, it } from 'vitest';
import { browserErrorKind } from './browser-source';
import { fixFromPlugin, nativeErrorKind, NATIVE_WATCH_OPTIONS } from './native-source';

describe('native source', () => {
  it('maps the plugin error codes to the app’s kinds', () => {
    expect(nativeErrorKind('OS-PLUG-GLOC-0003')).toBe('denied');
    expect(nativeErrorKind('OS-PLUG-GLOC-0007')).toBe('location-off');
    expect(nativeErrorKind('OS-PLUG-GLOC-0009')).toBe('location-off');
    expect(nativeErrorKind('OS-PLUG-GLOC-0017')).toBe('location-off');
    expect(nativeErrorKind('OS-PLUG-GLOC-0010')).toBe('timeout');
    expect(nativeErrorKind('OS-PLUG-GLOC-0002')).toBe('unavailable');
    expect(nativeErrorKind(undefined)).toBe('unavailable');
  });

  it('watches with GPS on and no old cached reading', () => {
    expect(NATIVE_WATCH_OPTIONS.enableHighAccuracy).toBe(true);
    expect(NATIVE_WATCH_OPTIONS.maximumAge).toBeLessThanOrEqual(2000);
  });

  it('prefers the course over the plugin heading, which may be a compass', () => {
    const base = { latitude: 40.1, longitude: -88.2, accuracy: 6, altitude: null, altitudeAccuracy: null, speed: 1.2, magneticHeading: null, trueHeading: null, headingAccuracy: null };
    expect(fixFromPlugin({ timestamp: 5, coords: { ...base, heading: 90, course: 180 } })).toEqual({
      lng: -88.2,
      lat: 40.1,
      accuracyM: 6,
      headingDeg: 180,
      speedMps: 1.2,
      timeMs: 5,
    });
    expect(fixFromPlugin({ timestamp: 5, coords: { ...base, heading: 90, course: undefined } }).headingDeg).toBe(90);
    expect(fixFromPlugin({ timestamp: 5, coords: { ...base, speed: null, heading: null, course: null } })).toMatchObject({ headingDeg: null, speedMps: null });
  });
});

describe('browser source', () => {
  it('maps GeolocationPositionError codes', () => {
    expect(browserErrorKind(1)).toBe('denied');
    expect(browserErrorKind(2)).toBe('unavailable');
    expect(browserErrorKind(3)).toBe('timeout');
  });
});

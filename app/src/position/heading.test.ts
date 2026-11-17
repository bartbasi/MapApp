// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { COMPASS_MAX_AGE_MS, chooseHeading, compassFromOrientation, smoothHeading } from './heading';

describe('chooseHeading: compass or course', () => {
  it('uses the compass when standing still', () => {
    expect(chooseHeading({ compassDeg: 80, compassAgeMs: 100, courseDeg: 0, speedMps: 0 })).toEqual({ deg: 80, source: 'compass' });
  });

  it('uses the compass when the speed is unknown', () => {
    expect(chooseHeading({ compassDeg: 80, compassAgeMs: 100, courseDeg: 200, speedMps: null })).toEqual({ deg: 80, source: 'compass' });
  });

  it('uses the course when moving faster than about 1 m/s', () => {
    expect(chooseHeading({ compassDeg: 80, compassAgeMs: 100, courseDeg: 200, speedMps: 1.4 })).toEqual({ deg: 200, source: 'course' });
  });

  it('falls back to the course when the phone has no compass and is moving', () => {
    expect(chooseHeading({ compassDeg: null, compassAgeMs: null, courseDeg: 200, speedMps: 3 })).toEqual({ deg: 200, source: 'course' });
  });

  it('treats an old compass reading as missing', () => {
    expect(chooseHeading({ compassDeg: 80, compassAgeMs: COMPASS_MAX_AGE_MS + 1, courseDeg: 200, speedMps: 2 })?.source).toBe('course');
  });

  it('shows no heading with no compass while standing still, rather than a wrong one', () => {
    expect(chooseHeading({ compassDeg: null, compassAgeMs: null, courseDeg: 0, speedMps: 0 })).toBeNull();
    expect(chooseHeading({ compassDeg: null, compassAgeMs: null, courseDeg: 120, speedMps: null })).toBeNull();
    expect(chooseHeading({ compassDeg: 80, compassAgeMs: COMPASS_MAX_AGE_MS + 1, courseDeg: null, speedMps: 0 })).toBeNull();
  });

  it('uses the compass when moving but the course is missing', () => {
    expect(chooseHeading({ compassDeg: 15, compassAgeMs: 50, courseDeg: null, speedMps: 5 })).toEqual({ deg: 15, source: 'compass' });
  });
});

describe('smoothHeading', () => {
  it('moves part of the way, the short way round through north', () => {
    const s = smoothHeading({ deg: 350, source: 'compass' }, { deg: 10, source: 'compass' })!;
    expect(s.deg).toBeCloseTo(355, 6);
    const back = smoothHeading({ deg: 10, source: 'compass' }, { deg: 350, source: 'compass' })!;
    expect(back.deg).toBeCloseTo(5, 6);
  });

  it('settles on a steady reading', () => {
    let h = smoothHeading(null, { deg: 0, source: 'compass' });
    for (let i = 0; i < 60; i++) h = smoothHeading(h, { deg: 90, source: 'compass' });
    expect(h!.deg).toBeCloseTo(90, 3);
  });

  it('jumps straight to a new source, and to nothing', () => {
    expect(smoothHeading({ deg: 10, source: 'compass' }, { deg: 200, source: 'course' })).toEqual({ deg: 200, source: 'course' });
    expect(smoothHeading({ deg: 10, source: 'compass' }, null)).toBeNull();
  });
});

describe('compassFromOrientation', () => {
  it('turns the counterclockwise alpha into a clockwise heading', () => {
    expect(compassFromOrientation(0, 0)).toBe(0);
    expect(compassFromOrientation(270, 0)).toBe(90);
    expect(compassFromOrientation(90, 0)).toBe(270);
  });

  it('allows for a screen turned to landscape', () => {
    expect(compassFromOrientation(0, 90)).toBe(90);
    expect(compassFromOrientation(0, 270)).toBe(270);
  });
});

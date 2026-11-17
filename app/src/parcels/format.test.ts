// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { compassPoint, formatDistance } from './format';
import { bearingOf } from './local-frame';

describe('compassPoint', () => {
  it('names the eight points', () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(compassPoint)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  });

  it('wraps around past north', () => {
    expect(compassPoint(359.9)).toBe('N');
    expect(compassPoint(337.6)).toBe('N');
    expect(compassPoint(337.4)).toBe('NW');
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(361)).toBe('N');
    expect(compassPoint(-10)).toBe('N');
    expect(compassPoint(-30)).toBe('NW');
    expect(compassPoint(720 + 90)).toBe('E');
  });

  it('splits at the half-way bearings', () => {
    expect(compassPoint(22.4)).toBe('N');
    expect(compassPoint(22.5)).toBe('NE');
    expect(compassPoint(202.6)).toBe('SW');
  });
});

describe('bearingOf', () => {
  it('measures clockwise from north and stays in 0 up to 360', () => {
    expect(bearingOf(0, 1)).toBe(0);
    expect(bearingOf(1, 0)).toBe(90);
    expect(bearingOf(0, -1)).toBe(180);
    expect(bearingOf(-1, 0)).toBe(270);
    expect(bearingOf(-1e-12, 1)).toBeGreaterThan(359.99);
    expect(bearingOf(-1e-12, 1)).toBeLessThan(360);
    expect(bearingOf(0, 0)).toBe(0);
  });
});

describe('formatDistance', () => {
  it('gives whole feet under 1,000 ft with meters alongside', () => {
    expect(formatDistance(0)).toEqual({ imperial: '0 ft', metric: '0 m', text: '0 ft (0 m)' });
    expect(formatDistance(30).text).toBe('98 ft (30 m)');
    expect(formatDistance(100.6).text).toBe('330 ft (101 m)');
    expect(formatDistance(304.6).imperial).toBe('999 ft');
  });

  it('switches to miles to one decimal from 1,000 ft', () => {
    expect(formatDistance(304.8).imperial).toBe('0.2 mi');
    expect(formatDistance(1609.344).text).toBe('1.0 mi (1.6 km)');
    expect(formatDistance(2414).imperial).toBe('1.5 mi');
    expect(formatDistance(999.4).metric).toBe('999 m');
    expect(formatDistance(999.6).metric).toBe('1.0 km');
  });

  it('refuses nonsense', () => {
    expect(formatDistance(NaN).text).toBe('unknown');
    expect(formatDistance(-1).text).toBe('unknown');
  });
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, DOUBLE_TAP_PX, isSecondTap } from './taps';

describe('isSecondTap', () => {
  const first = { time: 1000, x: 100, y: 100 };

  it('is false for the first tap', () => {
    expect(isSecondTap(null, first)).toBe(false);
  });

  it('is true for a quick tap at the same place', () => {
    expect(isSecondTap(first, { time: 1000 + DOUBLE_TAP_MS - 50, x: 104, y: 97 })).toBe(true);
  });

  it('is false when the second tap comes late', () => {
    expect(isSecondTap(first, { time: 1000 + DOUBLE_TAP_MS + 1, x: 100, y: 100 })).toBe(false);
  });

  it('is false when the second tap is somewhere else', () => {
    expect(isSecondTap(first, { time: 1100, x: 100 + DOUBLE_TAP_PX + 1, y: 100 })).toBe(false);
  });
});

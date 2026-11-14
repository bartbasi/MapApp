// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { revealOffset } from './reveal';

describe('revealOffset', () => {
  it('does nothing when the tapped point is already above the sheet', () => {
    expect(revealOffset(200, 800, 400)).toBe(0);
  });

  it('moves a point under the sheet to the middle of the visible part', () => {
    // 800 tall, sheet covers 500: visible 300, middle 150. Point at 600 moves up by 450.
    expect(revealOffset(600, 800, 500)).toBe(450);
  });

  it('moves a point just above the sheet edge into clear view', () => {
    expect(revealOffset(395, 800, 400)).toBe(195);
  });

  it('does nothing with no sheet room at all', () => {
    expect(revealOffset(500, 800, 800)).toBe(0);
  });

  it('brings a point at the side edge to the middle when nothing is covered', () => {
    // Sideways use: 540 wide, nothing covered. A point 10 px from the right edge moves to the middle.
    expect(revealOffset(530, 540, 0)).toBe(260);
    expect(revealOffset(270, 540, 0)).toBe(0);
  });
});

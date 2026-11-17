// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { OWNER_MASK_TEXT, OwnerMask, acresText, maskRequested, ownerText } from './owner-text';

describe('owner names', () => {
  it('shows the name as the county wrote it, or says it is not listed', () => {
    expect(ownerText('  SOME OWNER ', false)).toBe('SOME OWNER');
    expect(ownerText('', false)).toBe('Owner not listed in the county record');
    expect(ownerText(' ', false, 'short')).toBe('Owner not listed');
  });

  it('masks a name only when masked, and never hides that an owner is missing', () => {
    expect(ownerText('SOME OWNER', true)).toBe(OWNER_MASK_TEXT);
    expect(ownerText('', true)).toBe('Owner not listed in the county record');
  });
});

describe('the owner mask', () => {
  it('cannot be turned on in a production build', () => {
    // The app creates the mask with allowed = import.meta.env.DEV, which is false in a production build.
    const production = new OwnerMask(false, true);
    expect(production.on).toBe(false);
    production.set(true);
    expect(production.on).toBe(false);
    expect(ownerText('SOME OWNER', production.on)).toBe('SOME OWNER');
  });

  it('can be turned on and off in a development build, and tells its subscribers', () => {
    const dev = new OwnerMask(true);
    const seen: boolean[] = [];
    dev.subscribe((on) => seen.push(on));
    dev.set(true);
    dev.set(true);
    dev.set(false);
    expect(seen).toEqual([false, true, false]);
    expect(new OwnerMask(true, true).on).toBe(true);
  });

  it('reads the ?maskOwners flag', () => {
    expect(maskRequested('?maskOwners')).toBe(true);
    expect(maskRequested('?a=1&maskOwners=1')).toBe(true);
    expect(maskRequested('')).toBe(false);
  });
});

describe('acreage', () => {
  it('gives one decimal, and says when the county lists none', () => {
    expect(acresText(12.345)).toBe('12.3 acres');
    expect(acresText(1)).toBe('1.0 acre');
    expect(acresText(1234.56)).toBe('1,234.6 acres');
    expect(acresText(null)).toBe('Acreage not listed in the county record');
    expect(acresText(0)).toBe('Acreage not listed in the county record');
  });
});

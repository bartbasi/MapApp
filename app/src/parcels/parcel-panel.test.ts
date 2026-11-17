// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { OWNER_MASK_TEXT } from './owner-text';
import { parcelPanel } from './parcel-panel';
import type { ParcelDetails, ParcelLookup } from './parcel-source';

const at = { lng: -88.95, lat: 39.84 };

function details(pid: string, extra: Partial<ParcelDetails> = {}): ParcelDetails {
  return { pid, owner: `PERSON ${pid}`, acres: 40.04, county: 'il-test', countyName: 'Test County, Illinois', dataDate: '2026-10-28', ...extra };
}

const lookup = (parcels: ParcelDetails[], coverage: ParcelLookup['coverage'] = 'ok'): ParcelLookup => ({ at, coverage, parcels });

describe('tap panel: parcels', () => {
  it('shows owner, acreage to one decimal, parcel ID, county and data date, and nothing else', () => {
    const p = parcelPanel(lookup([details('07-01')]), false, ['Test County']);
    expect(p.kind).toBe('parcels');
    if (p.kind !== 'parcels') return;
    expect(p.first.owner).toBe('PERSON 07-01');
    expect(p.first.facts).toEqual([
      { label: 'Acreage', value: '40.0 acres' },
      { label: 'Parcel ID', value: '07-01' },
      { label: 'County', value: 'Test County, Illinois' },
      { label: 'Data date', value: 'October 28, 2026' },
    ]);
    expect(p.survey).toBe('From county tax records. Not a legal survey.');
    expect(p.others).toEqual([]);
  });

  it('says when the owner or the acreage is not listed', () => {
    const p = parcelPanel(lookup([details('07-02', { owner: '', acres: null })]), false, []);
    expect(p.kind === 'parcels' && p.first.owner).toBe('Owner not listed in the county record');
    expect(p.kind === 'parcels' && p.first.facts[0]!.value).toBe('Acreage not listed in the county record');
  });

  it('lists stacked parcels after the first, one line each', () => {
    const stack = Array.from({ length: 5 }, (_, i) => details(`S-${i}`, { acres: i === 2 ? null : 0.25 }));
    const p = parcelPanel(lookup(stack), false, []);
    expect(p.kind === 'parcels' && p.others).toEqual([
      'PERSON S-1, parcel S-1, 0.3 acres',
      'PERSON S-2, parcel S-2, acreage not listed',
      'PERSON S-3, parcel S-3, 0.3 acres',
      'PERSON S-4, parcel S-4, 0.3 acres',
    ]);
  });

  it('masks owner names when asked', () => {
    const p = parcelPanel(lookup([details('A'), details('B')]), true, []);
    expect(JSON.stringify(p)).not.toContain('PERSON');
    expect(p.kind === 'parcels' && p.first.owner).toBe(OWNER_MASK_TEXT);
  });
});

describe('tap panel: no parcel', () => {
  it('a record with no parcel ID is not a parcel: the plain message, no owner', () => {
    const strip = details(' ', { pid: '', owner: '', acres: null });
    expect(parcelPanel(lookup([strip]), false, [])).toEqual({ kind: 'gap', title: 'Not in a parcel.', text: 'This is often a road or a railway.' });
    expect(parcelPanel(lookup([]), false, []).kind).toBe('gap');
    // A real parcel under a strip is still shown.
    const p = parcelPanel(lookup([strip, details('R')]), false, []);
    expect(p.kind === 'parcels' && p.first.pid).toBe('R');
  });

  it('outside the installed counties says so and names the counties that have lines', () => {
    expect(parcelPanel(lookup([], 'no-archive'), false, ['Macon County'])).toEqual({
      kind: 'no-data',
      title: 'No property lines for this place yet.',
      text: 'Property lines are installed for Macon County only.',
    });
    expect(parcelPanel(lookup([], 'read-error'), false, []).kind).toBe('no-data');
  });
});

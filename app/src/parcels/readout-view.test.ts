// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { OWNER_MASK_TEXT } from './owner-text';
import type { ParcelDetails, PositionQuery, PropertyLine } from './parcel-source';
import { positionReadout } from './readout';
import { SURVEY_TEXT, readoutView, type ReadoutViewOptions } from './readout-view';
import { M_PER_DEG_LNG } from './test-tiles';

const at = { lng: -88.95, lat: 39.84 };
const NB = ' ';

function details(pid: string, owner = `PERSON ${pid}`): ParcelDetails {
  return { pid, owner, acres: 12.34, county: 'il-test', countyName: 'Test County, Illinois', dataDate: '2026-10-28' };
}

function line(distanceM: number, thisSide: ParcelDetails[], otherSide: ParcelDetails[], bearingDeg = 45): PropertyLine {
  return { distanceM, bearingDeg, point: at, thisSide, otherSide, segment: [at, at] };
}

function query(inside: ParcelDetails[] | null, nearestLine: PropertyLine | null, coverage: PositionQuery['coverage'] = 'ok'): PositionQuery {
  return { at, coverage, searchRadiusM: 150, inside, nearestLine };
}

const opts: ReadoutViewOptions = { masked: false, staleFix: false, countiesWithLines: ['Macon County'] };
const view = (accuracyM: number, q: PositionQuery, o: Partial<ReadoutViewOptions> = {}) => readoutView(positionReadout({ ...at, accuracyM }, q), { ...opts, ...o });
const A = details('11-22-333-001');
const B = details('11-22-333-002');

describe('readout words: inside a parcel', () => {
  it('names the owner, the distance and direction to the line, the parcel and the accuracy', () => {
    const v = view(4, query([A], line(26, [A], [B])));
    expect(v).toMatchObject({ kind: 'inside', tone: 'clear', icon: 'parcel', title: 'PERSON 11-22-333-001' });
    expect(v.lines).toEqual([`Property line 85${NB}ft${NB}(26${NB}m) to the NE`]);
    expect(v.small[0]).toBe(`Parcel 11-22-333-001 · GPS accurate to about 13${NB}ft (4${NB}m)`);
    expect(v.more).toContain('Across that line: PERSON 11-22-333-002, parcel 11-22-333-002.');
    expect(v.more).toContain('Parcel 11-22-333-001: 12.3 acres.');
    expect(v.more).toContain('Test County, Illinois. County data of October 28, 2026.');
    expect(v.more).toContain(SURVEY_TEXT);
    expect(v.expandable).toBe(true);
  });

  it('says when the owner is not listed and when no line is near', () => {
    const v = view(4, query([details('9', '')], null));
    expect(v.title).toBe('Owner not listed');
    expect(v.lines[0]).toBe(`No property line within 492${NB}ft${NB}(150${NB}m)`);
  });

  it('shows the first of many stacked parcels and how many more, with the full list when opened', () => {
    const stack = Array.from({ length: 101 }, (_, i) => details(`S-${i}`));
    const v = view(4, query(stack, line(40, stack, [B])));
    expect(v.title).toBe('PERSON S-0');
    expect(v.lines).toContain('and 100 more parcels at this spot');
    expect(v.moreList).toHaveLength(100);
    expect(v.moreList[0]).toBe('PERSON S-1, parcel S-1');
  });
});

describe('readout words: on or near a line', () => {
  it('says the GPS cannot tell which side, and names both sides', () => {
    const v = view(5, query([A], line(3, [A], [B])));
    expect(v).toMatchObject({ kind: 'near-line', tone: 'caution', icon: 'caution', title: 'On or near a property line.' });
    expect(v.lines).toEqual(['GPS cannot tell which side.']);
    expect(v.sides).toEqual(['PERSON 11-22-333-001, parcel 11-22-333-001', 'PERSON 11-22-333-002, parcel 11-22-333-002']);
    expect(v.more).toContain(SURVEY_TEXT);
  });

  it('says no parcel for a side that is a gap', () => {
    const v = view(5, query([A], line(3, [A], [])));
    expect(v.sides[1]).toBe('No parcel. Often a road or a railway.');
  });
});

describe('readout words: in no parcel', () => {
  it('says not in a parcel, what that usually is, and the nearest line', () => {
    const v = view(2, query(null, line(12, [], [B], 90)));
    expect(v).toMatchObject({ kind: 'no-parcel', tone: 'clear', icon: 'gap', title: 'Not in a parcel.', lines: ['This is often a road or a railway.'] });
    expect(v.small[0]).toBe(`Nearest property line 39${NB}ft${NB}(12${NB}m) to the E`);
    expect(v.more[0]).toBe('Across that line: PERSON 11-22-333-002, parcel 11-22-333-002.');
  });
});

describe('readout words: poor fix', () => {
  it('says the GPS is too weak, how weak, and marks the guess as a guess', () => {
    const v = view(60, query([A], line(100, [A], [B])));
    expect(v).toMatchObject({ kind: 'poor-fix', tone: 'weak', icon: 'weak-gps', title: 'GPS is too weak to place you.' });
    expect(v.lines).toEqual([`Accurate to about 200${NB}ft (60${NB}m).`, 'Probably: PERSON 11-22-333-001, parcel 11-22-333-001.']);
  });

  it('guesses near a line by parcel ID only', () => {
    const v = view(60, query([A], line(20, [A], [B])));
    expect(v.lines[1]).toBe('Probably: near the line between parcel 11-22-333-001 and parcel 11-22-333-002.');
  });
});

describe('readout words: no data', () => {
  it('says there are no property lines here yet, and where there are', () => {
    const v = view(4, query(null, null, 'no-archive'), { countiesWithLines: ['Macon County'] });
    expect(v).toMatchObject({ kind: 'no-data', tone: 'none', title: 'No property lines for this place yet.', lines: ['Property lines are installed for Macon County only.'] });
    expect(view(4, query(null, null, 'no-tile'), { countiesWithLines: ['A County', 'B County'] }).lines).toEqual(['Property lines are installed for A County and B County only.']);
    expect(view(4, query(null, null, 'no-archive'), { countiesWithLines: [] }).lines).toEqual([]);
  });

  it('says a read failure plainly', () => {
    expect(view(4, query(null, null, 'read-error')).title).toBe('The property lines could not be read here.');
  });

  it('says it is checking while there is no answer for this spot yet', () => {
    expect(readoutView(null, opts)).toMatchObject({ kind: 'pending', title: 'Checking the property lines here.' });
    const far = positionReadout({ lng: at.lng + 100 / M_PER_DEG_LNG, lat: at.lat, accuracyM: 4 }, query([A], null));
    expect(readoutView(far, opts).kind).toBe('pending');
  });
});

describe('readout words: an old fix and masked owners', () => {
  it('says the answer is from the last GPS position', () => {
    expect(view(4, query([A], null), { staleFix: true }).small).toContain('From the last GPS position.');
  });

  it('masks every owner name when asked, in every state', () => {
    const texts = [
      view(4, query([A, B], line(26, [A], [B])), { masked: true }),
      view(5, query([A], line(3, [A], [B])), { masked: true }),
      view(2, query(null, line(12, [], [B])), { masked: true }),
      view(60, query([A], line(100, [A], [B])), { masked: true }),
    ].map((v) => JSON.stringify(v));
    for (const t of texts) {
      expect(t).not.toContain('PERSON');
    }
    expect(texts[0]).toContain(OWNER_MASK_TEXT);
  });
});

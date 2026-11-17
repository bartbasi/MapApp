// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { ParcelDetails, PositionQuery, PropertyLine } from './parcel-source';
import { LINE_DATA_MARGIN_M, POOR_FIX_M, STALE_QUERY_M, positionReadout, type PositionFix } from './readout';
import { StoredParcelSource } from './stored-parcel-source';
import { M_PER_DEG_LNG, SynthWorld, rect } from './test-tiles';

const at = { lng: -88.95, lat: 40.0 };

function details(pid: string): ParcelDetails {
  return { pid, owner: `OWNER ${pid}`, acres: 10, county: 'il-test', countyName: 'Test County', dataDate: '2026-10-28' };
}

function line(distanceM: number, thisSide: string[], otherSide: string[], bearingDeg = 90): PropertyLine {
  return { distanceM, bearingDeg, point: at, thisSide: thisSide.map(details), otherSide: otherSide.map(details), segment: [at, at] };
}

function q(inside: string[] | null, nearestLine: PropertyLine | null): PositionQuery {
  return { at, coverage: 'ok', searchRadiusM: 150, inside: inside ? inside.map(details) : null, nearestLine };
}

const fix = (accuracyM: number, east = 0): PositionFix => ({ lng: at.lng + east / M_PER_DEG_LNG, lat: at.lat, accuracyM });

describe('position readout', () => {
  it('says inside when the line is further than the accuracy', () => {
    const r = positionReadout(fix(5), q(['A'], line(12, ['A'], ['B'], 350)));
    expect(r.kind).toBe('inside');
    if (r.kind !== 'inside') return;
    expect(r.parcel.pid).toBe('A');
    expect(r.neighbour?.pid).toBe('B');
    expect(r.line).toMatchObject({ distanceM: 12, compass: 'N' });
    expect(r.alsoIn).toEqual([]);
  });

  it('says near-line when the line is within the accuracy, and gives both sides', () => {
    const r = positionReadout(fix(5), q(['A'], line(3, ['A'], ['B'])));
    expect(r.kind).toBe('near-line');
    if (r.kind !== 'near-line') return;
    expect(r.thisSide.map((p) => p.pid)).toEqual(['A']);
    expect(r.otherSide.map((p) => p.pid)).toEqual(['B']);
  });

  it('treats a line exactly at the accuracy radius plus the line margin as near', () => {
    const edge = 5 + LINE_DATA_MARGIN_M;
    expect(positionReadout(fix(5), q(['A'], line(edge, ['A'], ['B']))).kind).toBe('near-line');
    expect(positionReadout(fix(5), q(['A'], line(edge + 0.01, ['A'], ['B']))).kind).toBe('inside');
  });

  it('allows 3 m for error in the county lines on top of the GPS accuracy', () => {
    expect(LINE_DATA_MARGIN_M).toBe(3);
    // 4 m from a line with 2 m accuracy: the line may be off by 3 m, so either side.
    expect(positionReadout(fix(2), q(['A'], line(4, ['A'], ['B']))).kind).toBe('near-line');
    // 6 m from a line with 2 m accuracy: clear of 2 + 3 = 5 m.
    expect(positionReadout(fix(2), q(['A'], line(6, ['A'], ['B']))).kind).toBe('inside');
    const r = positionReadout(fix(2), q(['A'], line(6, ['A'], ['B'])));
    expect(r.kind === 'inside' && r.uncertaintyM).toBe(5);
    expect(r.kind === 'inside' && r.accuracyM).toBe(2);
  });

  it('prefers near-line over no-parcel in a gap', () => {
    expect(positionReadout(fix(8), q(null, line(6, [], ['B']))).kind).toBe('near-line');
    expect(positionReadout(fix(4), q(null, line(6, [], ['B']))).kind).toBe('near-line');
    const r = positionReadout(fix(2), q(null, line(6, [], ['B'])));
    expect(r.kind).toBe('no-parcel');
    if (r.kind === 'no-parcel') expect(r.nearest?.pid).toBe('B');
  });

  it('says no-parcel with no line when nothing is near', () => {
    const r = positionReadout(fix(4), q(null, null));
    expect(r).toMatchObject({ kind: 'no-parcel', line: null, nearest: null });
  });

  it('lists overlapping parcels and finds the neighbour among the others', () => {
    const r = positionReadout(fix(3), q(['SMALL', 'BIG'], line(10, ['SMALL', 'BIG'], ['BIG'])));
    expect(r.kind).toBe('inside');
    if (r.kind !== 'inside') return;
    expect(r.parcel.pid).toBe('SMALL');
    expect(r.alsoIn.map((p) => p.pid)).toEqual(['BIG']);
    expect(r.neighbour).toBeNull();
  });

  it('says inside with no line when none is within the search radius', () => {
    const r = positionReadout(fix(5), q(['A'], null));
    expect(r).toMatchObject({ kind: 'inside', line: null, neighbour: null, searchRadiusM: 150 });
  });

  it('gives a flagged guess when the fix is poor, and the guess still never claims a side', () => {
    const r = positionReadout(fix(POOR_FIX_M + 1), q(['A'], line(20, ['A'], ['B'])));
    expect(r.kind).toBe('poor-fix');
    if (r.kind !== 'poor-fix') return;
    expect(r.guess.kind).toBe('near-line');
    const far = positionReadout(fix(60), q(['A'], line(100, ['A'], ['B'])));
    expect(far.kind === 'poor-fix' && far.guess.kind).toBe('inside');
    expect(positionReadout(fix(POOR_FIX_M), q(['A'], line(100, ['A'], ['B']))).kind).toBe('inside');
  });

  it('treats an unknown or nonsense accuracy as a poor fix', () => {
    expect(positionReadout(fix(NaN), q(['A'], null)).kind).toBe('poor-fix');
    expect(positionReadout(fix(-1), q(['A'], null)).kind).toBe('poor-fix');
    expect(positionReadout(fix(Infinity), q(['A'], null)).kind).toBe('poor-fix');
  });

  it('passes on missing data', () => {
    expect(positionReadout(fix(5), { ...q(null, null), coverage: 'no-archive' })).toEqual({ kind: 'no-data', reason: 'no-archive' });
    expect(positionReadout(fix(5), { ...q(null, null), coverage: 'no-tile' })).toEqual({ kind: 'no-data', reason: 'no-tile' });
    expect(positionReadout(fix(5), { ...q(null, null), coverage: 'read-error' })).toEqual({ kind: 'no-data', reason: 'read-error' });
  });

  it('widens the uncertainty by how far the fix has moved from the query, and drops a stale query', () => {
    // Accuracy 5 m, line 11 m from the queried point, fix 4 m from it: 5 + 4 + 3 reaches the line.
    const r = positionReadout(fix(5, 4), q(['A'], line(11, ['A'], ['B'])));
    expect(r.kind).toBe('near-line');
    if (r.kind === 'near-line') expect(Math.abs(r.uncertaintyM - 12)).toBeLessThan(0.01);
    expect(positionReadout(fix(5), q(['A'], line(11, ['A'], ['B']))).kind).toBe('inside');
    expect(positionReadout(fix(5, STALE_QUERY_M + 1), q(['A'], null))).toEqual({ kind: 'no-data', reason: 'stale' });
  });

  it('never names a record with no parcel ID: a point in such a strip is in no parcel', () => {
    const strip = { ...details(''), owner: '', acres: null };
    const query: PositionQuery = { ...q(null, line(20, [], ['B'])), inside: [strip] };
    const r = positionReadout(fix(3), query);
    expect(r).toMatchObject({ kind: 'no-parcel', nearest: { pid: 'B' } });
    // A real parcel under the strip is still named, and a strip across the line is not a neighbour.
    const both: PositionQuery = { ...q(['A'], { ...line(20, ['A'], []), otherSide: [strip] }), inside: [strip, details('A')] };
    const r2 = positionReadout(fix(3), both);
    expect(r2).toMatchObject({ kind: 'inside', parcel: { pid: 'A' }, alsoIn: [], neighbour: null });
    // Its edge is still a line: near it, the phone may be on either side.
    const near = positionReadout(fix(3), { ...q(['A'], { ...line(2, ['A'], []), otherSide: [strip] }) });
    expect(near).toMatchObject({ kind: 'near-line', thisSide: [{ pid: 'A' }], otherSide: [] });
  });

  it('does not claim inside when the uncertainty reaches past the search radius', () => {
    const small: PositionQuery = { ...q(['A'], null), searchRadiusM: 20 };
    const r = positionReadout(fix(15, 10), small);
    expect(r.kind).toBe('poor-fix');
  });
});

describe('position readout on synthetic tiles', () => {
  const world = new SynthWorld();
  const parcels = [
    { properties: { pid: 'A', owner: 'OWNER A', acres: 2.5, county: 'il-test' }, rings: [rect(-100, -100, 0, 100)] },
    { properties: { pid: 'B', owner: 'OWNER B', acres: 2.5, county: 'il-test' }, rings: [rect(0, -100, 100, 100)] },
  ];
  const src = new StoredParcelSource([world.archive(parcels)]);

  it('moves from inside to near-line to the other side as the phone walks east', async () => {
    const kinds: string[] = [];
    for (const east of [-20, -3, 3, 20]) {
      const p = world.at(east, 0);
      const query = await src.positionQuery(p);
      const r = positionReadout({ ...p, accuracyM: 5 }, query);
      kinds.push(r.kind === 'inside' ? `inside ${r.parcel.pid}` : r.kind);
    }
    expect(kinds).toEqual(['inside A', 'near-line', 'near-line', 'inside B']);
  });
});

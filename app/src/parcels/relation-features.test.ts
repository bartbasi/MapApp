// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import type { LineString, Point } from 'geojson';
import { describe, expect, it } from 'vitest';
import { LocalFrame } from './local-frame';
import type { ParcelDetails, PositionQuery, PropertyLine } from './parcel-source';
import { positionReadout } from './readout';
import { NEAR_REACH_M, relationFeatures, type HereOutline } from './relation-features';
import { M_PER_DEG_LAT, M_PER_DEG_LNG } from './test-tiles';

const at = { lng: -88.95, lat: 39.84 };
const east = (m: number, north = 0) => ({ lng: at.lng + m / M_PER_DEG_LNG, lat: at.lat + north / M_PER_DEG_LAT });

function details(pid: string): ParcelDetails {
  return { pid, owner: 'X', acres: 1, county: 'il-test', countyName: 'T', dataDate: '' };
}
const A = details('A');
const B = details('B');

/** A north-south line 'distance' meters east of the phone, 1 km long. */
function line(distanceM: number): PropertyLine {
  return { distanceM, bearingDeg: 90, point: east(distanceM), thisSide: [A], otherSide: [B], thisSideCovered: true, otherSideCovered: true, segment: [east(distanceM, -500), east(distanceM, 500)] };
}
const query = (l: PropertyLine | null, inside: ParcelDetails[] | null = [A]): PositionQuery => ({ at, coverage: 'ok', searchRadiusM: 150, inside, nearestLine: l });
const here: HereOutline = { county: 'il-test', pid: 'A', lines: { type: 'MultiLineString', coordinates: [[[at.lng, at.lat], [at.lng, at.lat + 0.001]]] } };
const parts = (d: ReturnType<typeof relationFeatures>) => d.features.map((f) => f.properties.part);

describe('relation features', () => {
  it('inside: the parcel highlight, a connector from the phone to the line, and a tick along the line', () => {
    const r = positionReadout({ ...at, accuracyM: 4 }, query(line(30)));
    const d = relationFeatures(r, at, here, false);
    expect(parts(d)).toEqual(['here', 'connector', 'tick']);
    const connector = d.features[1]!.geometry as LineString;
    expect(connector.coordinates[0]).toEqual([at.lng, at.lat]);
    expect(connector.coordinates[1]![0]).toBeCloseTo(east(30).lng, 9);
    // The line runs north to south, so the east-west tick image turns a quarter turn.
    expect(d.features[2]!.properties.rotate).toBe(90);
    expect((d.features[2]!.geometry as Point).coordinates[0]).toBeCloseTo(east(30).lng, 9);
  });

  it('does not highlight an outline read for another parcel', () => {
    const r = positionReadout({ ...at, accuracyM: 4 }, query(line(30)));
    expect(parts(relationFeatures(r, at, { ...here, pid: 'B' }, false))).toEqual(['connector', 'tick']);
  });

  it('near a line: only the stretch of line near the phone, no connector', () => {
    const r = positionReadout({ ...at, accuracyM: 4 }, query(line(2)));
    const d = relationFeatures(r, at, here, false);
    expect(parts(d)).toEqual(['near']);
    const [a, b] = (d.features[0]!.geometry as LineString).coordinates as [[number, number], [number, number]];
    const frame = new LocalFrame(east(2).lng, east(2).lat);
    const len = Math.hypot(...frame.toLocal(...a)) + Math.hypot(...frame.toLocal(...b));
    expect(len).toBeCloseTo(2 * NEAR_REACH_M, 3);
  });

  it('in no parcel: the connector to the nearest line, no highlight', () => {
    const r = positionReadout({ ...at, accuracyM: 2 }, query(line(20), null));
    expect(parts(relationFeatures(r, at, here, false))).toEqual(['connector', 'tick']);
  });

  it('draws nothing for a poor fix, an old fix, no data or no readout', () => {
    const poor = positionReadout({ ...at, accuracyM: 80 }, query(line(30)));
    expect(relationFeatures(poor, at, here, false).features).toEqual([]);
    const good = positionReadout({ ...at, accuracyM: 4 }, query(line(30)));
    expect(relationFeatures(good, at, here, true).features).toEqual([]);
    const none = positionReadout({ ...at, accuracyM: 4 }, { ...query(null), coverage: 'no-archive' });
    expect(relationFeatures(none, at, here, false).features).toEqual([]);
    expect(relationFeatures(null, at, here, false).features).toEqual([]);
  });
});

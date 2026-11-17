// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The phone's relation to the property lines, as map features for the style's
// parcel relation layers (map/style/parcels.ts):
// - here: the outline of the parcel the phone is in, a soft highlight;
// - connector: a short dashed line from the phone to the nearest point on the
//   nearest property line, and a tick across the line at that point;
// - near: in the caution state, the stretch of line the phone may be on,
//   in place of the connector.
// Nothing is drawn for a poor fix, a stale fix or no data: the map must not
// say more than the readout does.

import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from 'geojson';
import { LocalFrame } from './local-frame';
import type { LngLat } from './parcel-source';
import type { Readout } from './readout';

export type RelationPart = 'here' | 'connector' | 'tick' | 'near';

export interface RelationProps {
  part: RelationPart;
  /** On the tick: its rotation in degrees, so it lies along the property line. */
  rotate?: number;
}

export type RelationData = FeatureCollection<LineString | MultiLineString | Point, RelationProps>;

export const EMPTY_RELATION: RelationData = { type: 'FeatureCollection', features: [] };

/** How much of the line is drawn either side of the nearest point in the caution state, in meters. */
export const NEAR_REACH_M = 40;

/** The outline of the parcel the phone is in, keyed by county and parcel ID. */
export interface HereOutline {
  county: string;
  pid: string;
  lines: MultiLineString;
}

/** Bearing in degrees from a to b, clockwise from north, on a flat local frame. */
function bearing(a: LngLat, b: LngLat): number {
  const [x, y] = new LocalFrame(a.lng, a.lat).toLocal(b.lng, b.lat);
  return (Math.atan2(x, y) * 180) / Math.PI;
}

/** The part of a segment within reach of a point on it. */
function around(segment: [LngLat, LngLat], point: LngLat, reachM: number): [LngLat, LngLat] {
  const frame = new LocalFrame(point.lng, point.lat);
  const [ax, ay] = frame.toLocal(segment[0].lng, segment[0].lat);
  const [bx, by] = frame.toLocal(segment[1].lng, segment[1].lat);
  const len = Math.hypot(bx - ax, by - ay);
  if (len === 0) return segment;
  // Where the point lies along the segment, in meters from a.
  const along = -(ax * (bx - ax) + ay * (by - ay)) / len;
  const from = Math.max(0, along - reachM) / len;
  const to = Math.min(len, along + reachM) / len;
  const at = (t: number): LngLat => {
    const [lng, lat] = frame.toLngLat(ax + (bx - ax) * t, ay + (by - ay) * t);
    return { lng, lat };
  };
  return [at(from), at(to)];
}

const coords = (p: LngLat): [number, number] => [p.lng, p.lat];

/**
 * The relation features for the current readout.
 * @param fix where the phone is now (the connector starts here)
 * @param here the outline of the parcel the phone is in, if it has been read
 * @param staleFix the fix is old: nothing is drawn
 */
export function relationFeatures(readout: Readout | null, fix: LngLat | null, here: HereOutline | null, staleFix: boolean): RelationData {
  if (!readout || !fix || staleFix) return EMPTY_RELATION;
  const features: Feature<LineString | MultiLineString | Point, RelationProps>[] = [];
  switch (readout.kind) {
    case 'inside':
    case 'no-parcel': {
      if (readout.kind === 'inside' && here && here.pid === readout.parcel.pid && here.county === readout.parcel.county) {
        features.push({ type: 'Feature', geometry: here.lines, properties: { part: 'here' } });
      }
      const l = readout.line;
      if (l) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [coords(fix), coords(l.point)] }, properties: { part: 'connector' } });
        const along = bearing(l.segment[0], l.segment[1]);
        // The tick image is a bar lying east to west, so it is turned by the line's bearing less 90 degrees.
        const rotate = Math.round((((along - 90) % 180) + 180) % 180);
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords(l.point) }, properties: { part: 'tick', rotate } });
      }
      break;
    }
    case 'near-line': {
      const [a, b] = around(readout.line.segment, readout.line.point, NEAR_REACH_M);
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [coords(a), coords(b)] }, properties: { part: 'near' } });
      break;
    }
    default:
      break;
  }
  return { type: 'FeatureCollection', features };
}

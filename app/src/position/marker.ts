// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The position marker as map data: the accuracy circle, the dot and the
// heading wedge, as GeoJSON features the style's position layers draw
// (map/style/position.ts). No position, no features.

import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { groundCircle } from './geo';
import type { PositionSnapshot } from './store';

export type MarkerPart = 'accuracy' | 'dot' | 'heading';

export interface MarkerProps {
  part: MarkerPart;
  stale: boolean;
  /** Heading in degrees clockwise from north, on the heading feature only. */
  heading?: number;
}

export type MarkerData = FeatureCollection<Point | Polygon, MarkerProps>;

export const EMPTY_MARKER: MarkerData = { type: 'FeatureCollection', features: [] };

/** Points around the accuracy circle. */
const CIRCLE_STEPS = 72;

export function markerData(s: Pick<PositionSnapshot, 'on' | 'fix' | 'stale' | 'heading'>): MarkerData {
  if (!s.on || !s.fix) return EMPTY_MARKER;
  const { lng, lat, accuracyM } = s.fix;
  const at: Point = { type: 'Point', coordinates: [lng, lat] };
  const features: Feature<Point | Polygon, MarkerProps>[] = [];
  if (accuracyM > 0 && Number.isFinite(accuracyM)) {
    features.push({ type: 'Feature', geometry: groundCircle(lng, lat, accuracyM, CIRCLE_STEPS), properties: { part: 'accuracy', stale: s.stale } });
  }
  if (s.heading && !s.stale) {
    features.push({ type: 'Feature', geometry: at, properties: { part: 'heading', stale: false, heading: Math.round(s.heading.deg * 10) / 10 } });
  }
  features.push({ type: 'Feature', geometry: at, properties: { part: 'dot', stale: s.stale } });
  return { type: 'FeatureCollection', features };
}

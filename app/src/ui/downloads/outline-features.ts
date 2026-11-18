// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The outlines of downloads, as features for the map's download-areas layer
// (map/style/download-areas.ts), which draws them under the position marker.

import type { Feature, FeatureCollection } from 'geojson';
import type { AreaView } from '../../downloads/contract';
import { isDamagedRecord } from './text';

export const NO_OUTLINES: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * One rectangle per download, `shown` set on the one looked at, and a point
 * at that one's north west corner carrying its name. A record the phone could
 * not read has no place, so it has no outline.
 */
export function outlineFeatures(areas: readonly AreaView[], shownId: string | null): FeatureCollection {
  const features: Feature[] = [];
  let label: Feature | null = null;
  for (const a of areas) {
    if (isDamagedRecord(a.record)) continue;
    const [w, s, e, n] = a.record.bounds;
    const shown = a.record.id === shownId;
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
      properties: { id: a.record.id, shown },
    });
    if (shown) label = { type: 'Feature', geometry: { type: 'Point', coordinates: [w, n] }, properties: { name: a.record.name } };
  }
  // The one looked at goes last, so its heavier line is drawn over the others where they cross.
  features.sort((x, y) => Number(x.properties?.['shown'] === true) - Number(y.properties?.['shown'] === true));
  if (label) features.push(label);
  return { type: 'FeatureCollection', features };
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The outlines of downloaded areas, shown while the downloads panel lists
// them. A map layer, so it sits under the phone's position marker and its
// relation to the property lines (D26): the marker is never covered.
//
// The features come from ui/downloads (downloadAreaFeatures): one polygon per
// area with `shown` true for the one the user looks at, and one point at that
// area's top left corner carrying its name.
//
// Every line is dark on a white halo, so it reads on the light map and on
// dark imagery alike. The outlines are dashed, which tells them apart from the
// solid property lines; the one looked at is heavier, lightly filled and
// named, so the difference never rests on color.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { fonts } from './fonts';

export const DOWNLOAD_AREAS_SOURCE = 'download-areas';

export const DOWNLOAD_AREA_LAYER_IDS = [
  'download-area-shown-fill',
  'download-area-halo',
  'download-area-line',
  'download-area-shown-halo',
  'download-area-shown-line',
  'download-area-name',
] as const;

const INK = '#14130f';
const HALO = '#ffffff';

const isArea: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'];
const shown: ExpressionSpecification = ['all', isArea, ['==', ['get', 'shown'], true]];
const notShown: ExpressionSpecification = ['all', isArea, ['!=', ['get', 'shown'], true]];

export function downloadAreaLayers(source: string): LayerSpecification[] {
  return [
    { id: 'download-area-shown-fill', type: 'fill', source, filter: shown, paint: { 'fill-color': HALO, 'fill-opacity': 0.16 } },
    { id: 'download-area-halo', type: 'line', source, filter: notShown, layout: { 'line-join': 'round' }, paint: { 'line-color': HALO, 'line-width': 6 } },
    { id: 'download-area-line', type: 'line', source, filter: notShown, paint: { 'line-color': INK, 'line-width': 2.5, 'line-dasharray': [4, 2.4] } },
    { id: 'download-area-shown-halo', type: 'line', source, filter: shown, layout: { 'line-join': 'round' }, paint: { 'line-color': HALO, 'line-width': 10 } },
    { id: 'download-area-shown-line', type: 'line', source, filter: shown, paint: { 'line-color': INK, 'line-width': 5, 'line-dasharray': [3.2, 1.6] } },
    {
      id: 'download-area-name',
      type: 'symbol',
      source,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': fonts.medium,
        'text-size': 15,
        'text-anchor': 'top-left',
        'text-offset': [0.8, 0.8],
        'text-max-width': 12,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 2.5 },
    },
  ];
}

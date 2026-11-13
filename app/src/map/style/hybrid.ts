// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the hybrid view draws over the imagery, from the base map archive:
// roads, water outlines and (through base-map.ts) place names. Kept thin and
// light so the imagery shows through.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { imageryPalette as img } from './palette';

const kindIn = (...kinds: string[]): ExpressionSpecification => ['in', ['get', 'kind'], ['literal', kinds]];

function width(at10: number, at16: number): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], 10, at10, 16, at16];
}

export function hybridLineLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'hybrid-water-outline',
      type: 'line',
      source,
      'source-layer': 'water',
      minzoom: 10,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': img.waterLine, 'line-width': 1, 'line-opacity': 0.8 },
    },
    {
      id: 'hybrid-water-line',
      type: 'line',
      source,
      'source-layer': 'water',
      minzoom: 11,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': img.waterLine, 'line-width': width(0.6, 1.6), 'line-opacity': 0.8 },
    },
    {
      id: 'hybrid-track',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: ['all', ['==', ['get', 'kind'], 'path'], ['==', ['get', 'kind_detail'], 'track']],
      paint: { 'line-color': img.track, 'line-width': 1.2, 'line-opacity': 0.75, 'line-dasharray': [3, 1.5] },
    },
    {
      id: 'hybrid-road-minor',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: kindIn('minor_road'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': img.minorRoad, 'line-width': width(0.5, 2), 'line-opacity': 0.55 },
    },
    {
      id: 'hybrid-road-major',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: kindIn('highway', 'major_road'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': img.majorRoad, 'line-width': width(1, 3.5), 'line-opacity': 0.75 },
    },
  ];
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// What the hybrid view draws over the imagery, from the base map archive:
// water, roads, field lanes, the county line and (through base-map.ts) names
// and route numbers. Every line is a light core on a dark casing, so it reads
// over dark woods and over pale fields. Lines stay thin so the imagery shows.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { countyLineOnImagery, kindIn, zoomed } from './base-map';
import { imageryPalette as img } from './palette';

const notTunnel: ExpressionSpecification = ['!=', ['get', 'is_tunnel'], true];
const isTrack: ExpressionSpecification = ['all', kindIn('path'), ['==', ['get', 'kind_detail'], 'track']];

interface Cased {
  id: string;
  sourceLayer: string;
  filter: ExpressionSpecification;
  minzoom?: number;
  color: string;
  width: Array<[number, number]>;
  casingExtra: number;
  dash?: number[];
}

/** A line with a dark casing under it. The casing is drawn first. */
function cased(source: string, l: Cased): LayerSpecification[] {
  const base = { source, 'source-layer': l.sourceLayer, filter: l.filter, ...(l.minzoom !== undefined ? { minzoom: l.minzoom } : {}) };
  return [
    {
      id: `${l.id}-casing`,
      type: 'line',
      ...base,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': img.casing, 'line-opacity': 0.75, 'line-width': zoomed(...l.width.map(([z, w]): [number, number] => [z, w + l.casingExtra])) },
    },
    {
      id: l.id,
      type: 'line',
      ...base,
      layout: l.dash ? { 'line-join': 'round' } : { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': l.color, 'line-width': zoomed(...l.width), ...(l.dash ? { 'line-dasharray': l.dash } : {}) },
    },
  ];
}

export function hybridLineLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'hybrid-water-outline',
      type: 'line',
      source,
      'source-layer': 'water',
      minzoom: 10,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!', kindIn('swimming_pool', 'fountain')]],
      paint: { 'line-color': img.waterLine, 'line-width': zoomed([10, 0.8], [16, 1.6]), 'line-opacity': 0.9 },
    },
    ...cased(source, {
      id: 'hybrid-water-line',
      sourceLayer: 'water',
      minzoom: 10,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['>=', ['zoom'], ['match', ['get', 'kind'], 'river', 10, ['canal', 'drain', 'ditch'], 11, 12]]],
      color: img.waterLine,
      width: [[10, 0.8], [13, 1.2], [16, 2.2]],
      casingExtra: 1.2,
    }),
    ...cased(source, {
      id: 'hybrid-track',
      sourceLayer: 'roads',
      minzoom: 13,
      filter: isTrack,
      color: img.track,
      width: [[13, 1], [16, 1.8]],
      casingExtra: 1.4,
      dash: [3, 1.5],
    }),
    ...cased(source, {
      id: 'hybrid-road-minor',
      sourceLayer: 'roads',
      minzoom: 13,
      filter: ['all', notTunnel, kindIn('minor_road')],
      color: img.minorRoad,
      width: [[13, 1.3], [16, 2.8]],
      casingExtra: 1.2,
    }),
    ...cased(source, {
      id: 'hybrid-road-major',
      sourceLayer: 'roads',
      minzoom: 10,
      filter: ['all', notTunnel, kindIn('major_road')],
      color: img.majorRoad,
      width: [[10, 1], [13, 2], [16, 3.8]],
      casingExtra: 1.4,
    }),
    ...cased(source, {
      id: 'hybrid-road-motorway',
      sourceLayer: 'roads',
      filter: ['all', notTunnel, kindIn('highway')],
      color: img.motorway,
      width: [[7, 0.8], [10, 1.6], [13, 2.4], [16, 4.5]],
      casingExtra: 1.6,
    }),
    ...countyLineOnImagery(source),
  ];
}

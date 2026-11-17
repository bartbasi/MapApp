// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The layers of the phone's position marker. They draw the features made by
// position/marker.ts and always come last in the style, above parcels, public
// land and every label (DECISIONS D26).

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { IMAGE_POSITION_HEADING } from './images';
import { positionPalette as p } from './palette';

export const POSITION_SOURCE = 'position';

export const POSITION_LAYER_IDS = [
  'position-accuracy-fill',
  'position-accuracy-edge',
  'position-heading',
  'position-dot-edge',
  'position-dot',
] as const;

const part = (name: string): ExpressionSpecification => ['==', ['get', 'part'], name];
const whenStale = (stale: string, fresh: string): ExpressionSpecification => ['case', ['==', ['get', 'stale'], true], stale, fresh];

export function positionLayers(source: string, onImagery: boolean): LayerSpecification[] {
  return [
    {
      id: 'position-accuracy-fill',
      type: 'fill',
      source,
      filter: part('accuracy'),
      paint: {
        'fill-color': whenStale(p.staleAccuracy, onImagery ? p.accuracyFillOnImagery : p.accuracyFill),
        'fill-opacity': onImagery ? p.accuracyFillOpacityOnImagery : p.accuracyFillOpacity,
        'fill-antialias': true,
      },
    },
    {
      id: 'position-accuracy-edge',
      type: 'line',
      source,
      filter: part('accuracy'),
      paint: {
        'line-color': whenStale(p.staleAccuracy, onImagery ? p.accuracyEdgeOnImagery : p.accuracyEdge),
        'line-opacity': p.accuracyEdgeOpacity,
        'line-width': p.accuracyEdgeWidth,
      },
    },
    {
      id: 'position-heading',
      type: 'symbol',
      source,
      filter: part('heading'),
      layout: {
        'icon-image': IMAGE_POSITION_HEADING,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    {
      // A soft dark edge just outside the white ring: the ring alone is lost on pale ground.
      id: 'position-dot-edge',
      type: 'circle',
      source,
      filter: part('dot'),
      paint: {
        'circle-radius': p.dotRadius + p.ringWidth + p.edgeWidth,
        'circle-color': p.edge,
        'circle-opacity': p.edgeOpacity,
        'circle-blur': 0.25,
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'position-dot',
      type: 'circle',
      source,
      filter: part('dot'),
      paint: {
        'circle-radius': p.dotRadius,
        'circle-color': whenStale(p.stale, p.dot),
        'circle-stroke-color': p.ring,
        'circle-stroke-width': p.ringWidth,
        'circle-pitch-alignment': 'map',
      },
    },
  ];
}

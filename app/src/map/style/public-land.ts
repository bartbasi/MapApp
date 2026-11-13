// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The public land overlay: a fill and an outline colored by managing category,
// a heavier outline on the tapped site, and site names at closer zooms.
//
// Site names are drawn from a separate point source with one point per site
// (see ../public-land-labels.ts), not from the polygons: a polygon label is
// placed once per tile the polygon touches, so names repeated at tile edges.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { PUBLIC_LAND_CATEGORIES, PUBLIC_LAND_LAYER } from '../public-land';
import { fonts } from './fonts';
import { publicLandPalette, publicLandStyle as s } from './palette';
import type { LabelColors } from './base-map';

/** The point source holding one label point per site. */
export const PUBLIC_LAND_LABELS_SOURCE = 'publicland-labels';

/** The zoom from which site names are drawn. */
export const PUBLIC_LAND_LABEL_MINZOOM = 12;

/** The layer a tap is tested against. */
export const PUBLIC_LAND_FILL = 'publicland-fill';

/** Identifies one site for the "selected" outline. */
export interface PublicLandSelection {
  name: string;
  manager: string;
}

const categoryColor: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  ...PUBLIC_LAND_CATEGORIES.flatMap((c) => [c, publicLandPalette[c]]),
  publicLandPalette.other,
] as unknown as ExpressionSpecification;

export function publicLandAreaLayers(source: string, onImagery: boolean, selection: PublicLandSelection | null): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    {
      id: PUBLIC_LAND_FILL,
      type: 'fill',
      source,
      'source-layer': PUBLIC_LAND_LAYER,
      paint: {
        'fill-color': categoryColor,
        'fill-opacity': onImagery ? s.fillOpacityOnImagery : s.fillOpacity,
      },
    },
    {
      id: 'publicland-outline',
      type: 'line',
      source,
      'source-layer': PUBLIC_LAND_LAYER,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': categoryColor,
        'line-width': onImagery ? s.outlineWidthOnImagery : s.outlineWidth,
      },
    },
  ];
  if (selection) {
    const filter: FilterSpecification = [
      'all',
      ['==', ['get', 'name'], selection.name],
      ['==', ['get', 'manager'], selection.manager],
    ];
    layers.push({
      id: 'publicland-selected',
      type: 'line',
      source,
      'source-layer': PUBLIC_LAND_LAYER,
      filter,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': onImagery ? s.selectedOnImagery : s.selected,
        'line-width': 3.5,
      },
    });
  }
  return layers;
}

export function publicLandLabelLayers(source: string, colors: LabelColors): LayerSpecification[] {
  return [
    {
      id: 'publicland-label',
      type: 'symbol',
      source,
      minzoom: PUBLIC_LAND_LABEL_MINZOOM,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': fonts.medium,
        'text-size': 12,
        'text-max-width': 9,
      },
      paint: { 'text-color': categoryColor, 'text-halo-color': colors.halo, 'text-halo-width': 1.6 },
    },
  ];
}

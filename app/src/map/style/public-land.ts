// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The public land overlay. Each site is drawn as:
// - a light fill in its category color (the layer a tap is tested against),
// - a diagonal hatch if access on foot is closed (dense) or restricted (sparse),
// - a wide translucent band just inside the edge, in the category color,
// - a thin edge line in the category color, solid or dashed by category,
//   on a white casing over imagery,
// - the tapped site: a yellow line on a black casing.
// Site names come from a separate point source with one point per site
// (see ../public-land-labels.ts), not from the polygons: a polygon label is
// placed once per tile the polygon touches, so names repeated at tile edges.

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { PUBLIC_LAND_CATEGORIES, PUBLIC_LAND_LAYER, type PublicLandCategory } from '../public-land';
import { fonts } from './fonts';
import { IMAGE_HATCH_CLOSED, IMAGE_HATCH_RESTRICTED } from './images';
import { publicLandDash, publicLandPalette, publicLandStyle as s, publicLandTextPalette, selectionPalette as sel } from './palette';
import { zoomed, type LabelColors } from './base-map';

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

function byCategory(colors: Record<PublicLandCategory, string>): ExpressionSpecification {
  return ['match', ['get', 'category'], ...PUBLIC_LAND_CATEGORIES.flatMap((c) => [c, colors[c]]), colors.other] as unknown as ExpressionSpecification;
}

const categoryColor = byCategory(publicLandPalette);
const categoryTextColor = byCategory(publicLandTextPalette);

const solidCategories = PUBLIC_LAND_CATEGORIES.filter((c) => publicLandDash[c].length === 0);
const dashedCategories = PUBLIC_LAND_CATEGORIES.filter((c) => publicLandDash[c].length > 0);

/** Band width inside the edge, by zoom. The band is offset inward by half its width. */
const BAND: Array<[number, number]> = [
  [10, 3],
  [13, 5],
  [16, 9],
];

export function publicLandAreaLayers(source: string, onImagery: boolean, selection: PublicLandSelection | null): LayerSpecification[] {
  const base = { source, 'source-layer': PUBLIC_LAND_LAYER } as const;
  const outlineWidth = onImagery ? s.outlineWidthOnImagery : s.outlineWidth;
  const layers: LayerSpecification[] = [
    {
      id: PUBLIC_LAND_FILL,
      type: 'fill',
      ...base,
      paint: {
        'fill-color': categoryColor,
        'fill-opacity': onImagery ? s.fillOpacityOnImagery : s.fillOpacity,
      },
    },
    {
      id: 'publicland-hatch',
      type: 'fill',
      ...base,
      filter: ['in', ['get', 'access'], ['literal', ['closed', 'restricted']]],
      paint: { 'fill-pattern': ['match', ['get', 'access'], 'closed', IMAGE_HATCH_CLOSED, IMAGE_HATCH_RESTRICTED] },
    },
    {
      id: 'publicland-band',
      type: 'line',
      ...base,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': categoryColor,
        'line-opacity': onImagery ? s.bandOpacityOnImagery : s.bandOpacity,
        'line-width': zoomed(...BAND),
        // Polygon outer rings run clockwise on screen, so a positive offset is inward.
        'line-offset': zoomed(...BAND.map(([z, w]): [number, number] => [z, w / 2])),
      },
    },
  ];
  if (onImagery) {
    layers.push({
      id: 'publicland-casing',
      type: 'line',
      ...base,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': s.casingOnImagery, 'line-opacity': 0.9, 'line-width': outlineWidth + 2 },
    });
  }
  layers.push({
    id: 'publicland-outline',
    type: 'line',
    ...base,
    filter: ['in', ['get', 'category'], ['literal', solidCategories]],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': categoryColor, 'line-width': outlineWidth },
  });
  for (const cat of dashedCategories) {
    layers.push({
      id: `publicland-outline-${cat}`,
      type: 'line',
      ...base,
      filter: ['==', ['get', 'category'], cat],
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': publicLandPalette[cat], 'line-width': outlineWidth, 'line-dasharray': [...publicLandDash[cat]] },
    });
  }
  if (selection) {
    const filter: FilterSpecification = ['all', ['==', ['get', 'name'], selection.name], ['==', ['get', 'manager'], selection.manager]];
    layers.push(
      {
        id: 'publicland-selected-casing',
        type: 'line',
        ...base,
        filter,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': sel.casing, 'line-width': sel.casingWidth },
      },
      {
        id: 'publicland-selected',
        type: 'line',
        ...base,
        filter,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': sel.core, 'line-width': sel.coreWidth },
      },
    );
  }
  return layers;
}

/** Site names. A closed site says so under its name, so the hatch is never the only signal. */
export function publicLandLabelLayers(source: string, colors: LabelColors, onImagery = false): LayerSpecification[] {
  const accessLine: ExpressionSpecification = ['match', ['get', 'access'], 'closed', 'Closed to the public', 'restricted', 'Restricted access', ''];
  return [
    {
      id: 'publicland-label',
      type: 'symbol',
      source,
      minzoom: PUBLIC_LAND_LABEL_MINZOOM,
      // Small sites are named only closer in, so a town's many small parks do not bury the larger sites.
      filter: ['>=', ['zoom'], ['step', ['coalesce', ['get', 'acres'], 0], 14, 10, 13, 40, PUBLIC_LAND_LABEL_MINZOOM]],
      layout: {
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'acres'], 0]],
        'text-field': [
          'format',
          ['get', 'name'],
          {},
          ['case', ['in', ['get', 'access'], ['literal', ['closed', 'restricted']]], '\n', ''],
          {},
          accessLine,
          { 'font-scale': 0.85, 'text-font': ['literal', fonts.italic] },
        ],
        'text-font': fonts.medium,
        'text-size': zoomed([12, 12], [16, 14]),
        'text-max-width': 9,
        'text-line-height': 1.15,
      },
      paint: onImagery
        ? { 'text-color': colors.text, 'text-halo-color': categoryTextColor, 'text-halo-width': 2, 'text-halo-blur': 0.3 }
        : { 'text-color': categoryTextColor, 'text-halo-color': colors.halo, 'text-halo-width': 1.8, 'text-halo-blur': 0.3 },
    },
  ];
}

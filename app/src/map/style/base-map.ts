// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The vector base map: land use, water, roads, boundaries and labels, drawn
// from the base map archive. The archive uses the Protomaps tile layout,
// version 4: source layers earth, landcover, landuse, water, roads,
// boundaries, buildings, places and pois, each with a "kind" field and often a
// "kind_detail" field. The values used below were read from the real tiles.
//
// A first plain style written for MapApp, to be replaced by the designer.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { fonts } from './fonts';
import { basePalette as c, imageryPalette as img } from './palette';

const kindIn = (...kinds: string[]): ExpressionSpecification => ['in', ['get', 'kind'], ['literal', kinds]];

/** Line width that grows with zoom, given the width at zoom 10 and zoom 16. */
function width(at10: number, at16: number, from = 10): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], from, at10, 16, at16, 18, at16 * 2];
}

/** Shows a feature only from the zoom the tile layout says it belongs at. */
const reachedMinZoom: ExpressionSpecification = ['>=', ['zoom'], ['coalesce', ['get', 'min_zoom'], 0]];

/** United States English names: the English name if tagged, else the local name. */
export const labelName: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']];

const landuseFills: Array<{ id: string; color: string; kinds: string[]; minzoom?: number }> = [
  { id: 'farmland', color: c.farmland, kinds: ['farmland', 'farmyard', 'orchard', 'vineyard'] },
  { id: 'residential', color: c.residential, kinds: ['residential'] },
  { id: 'built', color: c.built, kinds: ['commercial', 'industrial', 'retail', 'railway', 'pedestrian'] },
  { id: 'institution', color: c.institution, kinds: ['university', 'college', 'school', 'kindergarten', 'hospital'] },
  { id: 'special', color: c.special, kinds: ['aerodrome', 'military', 'naval_base'] },
  { id: 'grass', color: c.grass, kinds: ['grass', 'grassland', 'meadow', 'scrub'] },
  { id: 'park', color: c.park, kinds: ['park', 'golf_course', 'recreation_ground', 'garden', 'dog_park', 'pitch', 'playground', 'cemetery', 'allotments'] },
  { id: 'wetland', color: c.wetland, kinds: ['wetland'] },
  { id: 'wood', color: c.wood, kinds: ['wood', 'forest'] },
  { id: 'sand', color: c.sand, kinds: ['sand', 'beach'] },
];

/** Everything below the labels: ground, water, roads and boundaries. */
export function baseMapGroundLayers(source: string): LayerSpecification[] {
  const layers: LayerSpecification[] = [];

  // Broad land cover, used only at the lowest zooms before land use appears.
  layers.push({
    id: 'base-landcover-wood',
    type: 'fill',
    source,
    'source-layer': 'landcover',
    maxzoom: 8,
    filter: kindIn('forest'),
    paint: { 'fill-color': c.wood, 'fill-opacity': 0.7 },
  });

  for (const f of landuseFills) {
    layers.push({
      id: `base-landuse-${f.id}`,
      type: 'fill',
      source,
      'source-layer': 'landuse',
      filter: kindIn(...f.kinds),
      paint: { 'fill-color': f.color },
    });
  }

  // Nature reserves are areas, not a ground cover: drawn as a faint outline.
  layers.push({
    id: 'base-landuse-reserve-outline',
    type: 'line',
    source,
    'source-layer': 'landuse',
    minzoom: 11,
    filter: kindIn('nature_reserve'),
    paint: { 'line-color': c.parkText, 'line-width': 0.8, 'line-opacity': 0.5, 'line-dasharray': [3, 2] },
  });

  layers.push(
    {
      id: 'base-water-area',
      type: 'fill',
      source,
      'source-layer': 'water',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': c.water },
    },
    {
      id: 'base-water-line',
      type: 'line',
      source,
      'source-layer': 'water',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': c.waterLine,
        'line-width': [
          'interpolate',
          ['exponential', 1.5],
          ['zoom'],
          10, ['match', ['get', 'kind'], ['river', 'canal'], 1, 0.5],
          16, ['match', ['get', 'kind'], ['river', 'canal'], 4, 1.6],
        ],
      },
    },
    {
      id: 'base-buildings',
      type: 'fill',
      source,
      'source-layer': 'buildings',
      minzoom: 14,
      paint: { 'fill-color': c.building, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.9] },
    },
    {
      id: 'base-boundary-local',
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('locality'),
      paint: { 'line-color': c.boundaryLocal, 'line-width': 0.8, 'line-dasharray': [2, 2] },
    },
    {
      id: 'base-boundary-county',
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('county'),
      paint: { 'line-color': c.boundaryCounty, 'line-width': width(1, 2.2, 8), 'line-dasharray': [4, 2] },
    },
    {
      id: 'base-boundary-state',
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('region', 'country'),
      paint: { 'line-color': c.boundaryState, 'line-width': width(1.4, 3, 6) },
    },
  );

  // Roads: casings first, then the road fills from small to large, so larger
  // roads draw over smaller ones at junctions.
  const road = (kinds: ExpressionSpecification): ExpressionSpecification => ['all', ['!=', ['get', 'is_tunnel'], true], kinds];
  const isTrack: ExpressionSpecification = ['all', ['==', ['get', 'kind'], 'path'], ['==', ['get', 'kind_detail'], 'track']];
  const isPath: ExpressionSpecification = ['all', ['==', ['get', 'kind'], 'path'], ['!=', ['get', 'kind_detail'], 'track']];

  layers.push(
    {
      id: 'base-runway',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: kindIn('aeroway'),
      paint: { 'line-color': c.runway, 'line-width': width(2, 18) },
    },
    {
      id: 'base-road-minor-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: road(kindIn('minor_road')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.minorRoadCasing, 'line-width': width(1.5, 9, 13) },
    },
    {
      id: 'base-road-major-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 9,
      filter: road(kindIn('major_road')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.majorRoadCasing, 'line-width': width(2, 13) },
    },
    {
      id: 'base-road-motorway-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 8,
      filter: road(kindIn('highway')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.motorwayCasing, 'line-width': width(3, 16) },
    },
    {
      id: 'base-path',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 14,
      filter: isPath,
      paint: { 'line-color': c.path, 'line-width': width(0.6, 1.4, 14), 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'base-track',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: isTrack,
      paint: { 'line-color': c.track, 'line-width': width(0.8, 2, 13), 'line-dasharray': [3, 1.5] },
    },
    {
      id: 'base-rail',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 10,
      filter: ['all', ['==', ['get', 'kind'], 'rail'], ['!=', ['get', 'kind_detail'], 'disused']],
      paint: { 'line-color': c.rail, 'line-width': width(1, 2.5), 'line-dasharray': [3, 2] },
    },
    {
      id: 'base-road-minor',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: road(kindIn('minor_road')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.minorRoad, 'line-width': width(0.8, 7, 12) },
    },
    {
      id: 'base-road-major',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: road(kindIn('major_road')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.majorRoad, 'line-width': width(1, 10) },
    },
    {
      id: 'base-road-motorway',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: road(kindIn('highway')),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.motorway, 'line-width': width(1.6, 12) },
    },
  );

  return layers;
}

/**
 * A plain base map drawn under the imagery in the aerial and hybrid views:
 * woods, water and roads only, no labels. It shows where and when there is no
 * imagery (beyond the imagery's area, or below its first zoom), so the screen
 * is never blank. Kept small because it is drawn under opaque imagery too.
 */
export function plainBaseMapLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'plain-wood',
      type: 'fill',
      source,
      'source-layer': 'landuse',
      filter: kindIn('wood', 'forest'),
      paint: { 'fill-color': c.wood },
    },
    {
      id: 'plain-water-area',
      type: 'fill',
      source,
      'source-layer': 'water',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': c.water },
    },
    {
      id: 'plain-water-line',
      type: 'line',
      source,
      'source-layer': 'water',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': c.waterLine, 'line-width': width(0.5, 1.6) },
    },
    {
      id: 'plain-road-minor',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: kindIn('minor_road'),
      paint: { 'line-color': c.minorRoadCasing, 'line-width': width(0.5, 2, 12) },
    },
    {
      id: 'plain-road-major',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: kindIn('highway', 'major_road'),
      paint: { 'line-color': c.majorRoadCasing, 'line-width': width(0.8, 3) },
    },
  ];
}

export interface LabelColors {
  text: string;
  halo: string;
  place: string;
  water: string;
  park: string;
}

export const labelsOnMap: LabelColors = {
  text: c.labelText,
  halo: c.labelHalo,
  place: c.placeText,
  water: c.waterText,
  park: c.parkText,
};

export const labelsOnImagery: LabelColors = {
  text: img.labelText,
  halo: img.labelHalo,
  place: img.labelText,
  water: img.waterText,
  park: img.labelText,
};

/** Place, road, water and park names. Used by the map and hybrid views. */
export function baseMapLabelLayers(source: string, colors: LabelColors): LayerSpecification[] {
  const halo = { 'text-halo-color': colors.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.3 };
  return [
    {
      id: 'label-water-line',
      type: 'symbol',
      source,
      'source-layer': 'water',
      minzoom: 12,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['has', 'name']],
      layout: {
        'symbol-placement': 'line',
        'text-field': labelName,
        'text-font': fonts.italic,
        'text-size': 12,
        'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': colors.water, ...halo },
    },
    {
      id: 'label-water-area',
      type: 'symbol',
      source,
      'source-layer': 'water',
      minzoom: 11,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'name'], reachedMinZoom],
      layout: { 'text-field': labelName, 'text-font': fonts.italic, 'text-size': 12, 'text-max-width': 8 },
      paint: { 'text-color': colors.water, ...halo },
    },
    {
      id: 'label-park',
      type: 'symbol',
      source,
      'source-layer': 'pois',
      minzoom: 12,
      filter: ['all', kindIn('park', 'nature_reserve', 'cemetery', 'golf_course', 'wood', 'forest'), reachedMinZoom],
      layout: { 'text-field': labelName, 'text-font': fonts.italic, 'text-size': 11, 'text-max-width': 8 },
      paint: { 'text-color': colors.park, ...halo },
    },
    {
      id: 'label-road',
      type: 'symbol',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: ['all', kindIn('highway', 'major_road', 'minor_road'), ['has', 'name']],
      layout: {
        'symbol-placement': 'line',
        'text-field': labelName,
        'text-font': fonts.regular,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
      },
      paint: { 'text-color': colors.text, ...halo },
    },
    {
      id: 'label-place-small',
      type: 'symbol',
      source,
      'source-layer': 'places',
      filter: ['all', kindIn('neighbourhood', 'macrohood'), reachedMinZoom],
      minzoom: 12,
      layout: { 'text-field': labelName, 'text-font': fonts.regular, 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
      paint: { 'text-color': colors.text, ...halo },
    },
    {
      id: 'label-place',
      type: 'symbol',
      source,
      'source-layer': 'places',
      filter: ['all', kindIn('locality'), reachedMinZoom],
      layout: {
        'text-field': labelName,
        'text-font': fonts.medium,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, ['match', ['get', 'kind_detail'], 'city', 13, 'town', 11, 10],
          14, ['match', ['get', 'kind_detail'], 'city', 20, 'town', 17, 14],
        ],
        'text-max-width': 8,
        'symbol-sort-key': ['coalesce', ['get', 'sort_key'], ['get', 'min_zoom'], 99],
      },
      paint: { 'text-color': colors.place, ...halo },
    },
  ];
}

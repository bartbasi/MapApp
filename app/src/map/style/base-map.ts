// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The vector base map: land use, water, roads, boundaries and labels, drawn
// from the base map archive. The archive uses the Protomaps tile layout,
// version 4: source layers earth, landcover, landuse, water, roads,
// boundaries, buildings, places and pois, each with a "kind" field and often a
// "kind_detail" field. The values used below were read from the real tiles.
//
// Written for a hunter in flat farmland: woods against open ground first,
// then water down to creeks and ditches, every road down to field lanes in a
// clear order, and the county line. Shops, restaurants and other town points
// are left out. Buildings appear only from zoom 14.

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { fonts } from './fonts';
import { IMAGE_SHIELD_COUNTY, IMAGE_SHIELD_MAJOR } from './images';
import { basePalette as c, imageryPalette as img, plainPalette as plain } from './palette';

export const kindIn = (...kinds: string[]): ExpressionSpecification => ['in', ['get', 'kind'], ['literal', kinds]];
const detailIn = (...kinds: string[]): ExpressionSpecification => ['in', ['get', 'kind_detail'], ['literal', kinds]];

/** A value that grows with zoom through the given [zoom, value] stops. */
export function zoomed(...stops: Array<[number, number]>): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.4], ['zoom'], ...stops.flat()] as unknown as ExpressionSpecification;
}

/** Each stop's value plus an edge on both sides: a casing just wider than its road, a little heavier close in. */
function wider(stops: Array<[number, number]>, extra: number): ExpressionSpecification {
  return zoomed(...stops.map(([z, w]): [number, number] => [z, w + extra * (z >= 15 ? 1.8 : 1)]));
}

/** Shows a feature only from the zoom the tile layout says it belongs at. */
const reachedMinZoom: ExpressionSpecification = ['>=', ['zoom'], ['coalesce', ['get', 'min_zoom'], 0]];

/** United States English names: the English name if tagged, else the local name. */
export const labelName: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']];

// Road classes. Tunnels are left out: none matter here and they would draw over the ground.
const notTunnel: ExpressionSpecification = ['!=', ['get', 'is_tunnel'], true];
const isMotorway: ExpressionSpecification = ['all', notTunnel, kindIn('highway')];
const isPrimary: ExpressionSpecification = ['all', notTunnel, kindIn('major_road'), detailIn('trunk', 'trunk_link', 'primary', 'primary_link')];
const isMajor: ExpressionSpecification = ['all', notTunnel, kindIn('major_road'), ['!', detailIn('trunk', 'trunk_link', 'primary', 'primary_link')]];
const isMinor: ExpressionSpecification = ['all', notTunnel, kindIn('minor_road'), ['!=', ['get', 'kind_detail'], 'service']];
const isService: ExpressionSpecification = ['all', notTunnel, kindIn('minor_road'), ['==', ['get', 'kind_detail'], 'service']];
const isTrack: ExpressionSpecification = ['all', kindIn('path'), ['==', ['get', 'kind_detail'], 'track']];
/** Footpaths and trails. Sidewalks and crossings are town clutter and are left out. */
const isPath: ExpressionSpecification = ['all', kindIn('path'), ['!', detailIn('track', 'sidewalk', 'crossing', 'corridor', 'steps')]];

// Road widths in screen pixels at each zoom.
const W = {
  motorway: [[7, 0.8], [10, 2], [13, 4.5], [16, 12], [18, 26]] as Array<[number, number]>,
  primary: [[7, 0.6], [10, 1.6], [13, 3.5], [16, 10], [18, 22]] as Array<[number, number]>,
  major: [[9, 0.7], [11, 1.4], [13, 3.4], [16, 9], [18, 20]] as Array<[number, number]>,
  minor: [[12, 1], [13, 2.2], [14, 3], [16, 7], [18, 16]] as Array<[number, number]>,
  service: [[14, 1], [16, 4], [18, 9]] as Array<[number, number]>,
  track: [[12, 0.9], [14, 1.6], [16, 2.6], [18, 4]] as Array<[number, number]>,
  path: [[14, 1], [16, 1.6], [18, 2.4]] as Array<[number, number]>,
};

const round = { 'line-cap': 'round', 'line-join': 'round' } as const;

const landuseFills: Array<{ id: string; color: string; kinds: string[]; minzoom?: number }> = [
  { id: 'farmland', color: c.farmland, kinds: ['farmland', 'farmyard', 'orchard', 'vineyard'] },
  { id: 'residential', color: c.residential, kinds: ['residential'] },
  { id: 'built', color: c.built, kinds: ['commercial', 'industrial', 'retail', 'railway', 'pedestrian', 'platform'] },
  { id: 'institution', color: c.institution, kinds: ['university', 'college', 'school', 'kindergarten', 'hospital'] },
  { id: 'special', color: c.special, kinds: ['aerodrome', 'military', 'naval_base'] },
  { id: 'grass', color: c.grass, kinds: ['grass', 'grassland', 'meadow', 'scrub', 'heath'] },
  { id: 'park', color: c.park, kinds: ['park', 'golf_course', 'recreation_ground', 'garden', 'dog_park', 'pitch', 'playground', 'cemetery', 'allotments'] },
  { id: 'wetland', color: c.wetland, kinds: ['wetland'] },
  { id: 'wood', color: c.wood, kinds: ['wood', 'forest'] },
  { id: 'sand', color: c.sand, kinds: ['sand', 'beach'] },
];

/** Water line width: rivers widest, canals and ditches next, creeks thinnest. */
const waterLineWidth: ExpressionSpecification = [
  'interpolate',
  ['exponential', 1.4],
  ['zoom'],
  9, ['match', ['get', 'kind'], 'river', 1, 0.5],
  12, ['match', ['get', 'kind'], 'river', 1.8, ['canal', 'drain', 'ditch'], 1.1, 0.9],
  16, ['match', ['get', 'kind'], 'river', 5, ['canal', 'drain', 'ditch'], 2.6, 2.2],
  18, ['match', ['get', 'kind'], 'river', 9, ['canal', 'drain', 'ditch'], 4, 3.5],
];

/** Rivers from zoom 9, canals and ditches from 11, creeks from 12 (the tiles carry them from 14). */
const waterLineShown: ExpressionSpecification = [
  'all',
  ['==', ['geometry-type'], 'LineString'],
  ['>=', ['zoom'], ['match', ['get', 'kind'], 'river', 9, ['canal', 'drain', 'ditch'], 11, 12]],
];

/** The county line as two layers: a wide soft band and a dash-dot core. */
function countyLine(source: string, idPrefix: string, core: string, band: string, bandOpacity: number): LayerSpecification[] {
  return [
    {
      id: `${idPrefix}-boundary-county-band`,
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('county'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': band, 'line-opacity': bandOpacity, 'line-width': zoomed([7, 3], [10, 6], [13, 10], [16, 16]) },
    },
    {
      id: `${idPrefix}-boundary-county`,
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('county'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': core, 'line-width': zoomed([7, 1], [10, 1.5], [14, 2.2], [16, 2.8]), 'line-dasharray': [5, 2, 1, 2] },
    },
  ];
}

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

  // The edge of the timber matters to a hunter: a fine darker line from zoom 12.
  layers.push(
    {
      id: 'base-wood-edge',
      type: 'line',
      source,
      'source-layer': 'landuse',
      minzoom: 12,
      filter: kindIn('wood', 'forest'),
      paint: { 'line-color': c.woodEdge, 'line-width': zoomed([12, 0.5], [16, 1.2]), 'line-opacity': 0.8 },
    },
    {
      id: 'base-wetland-edge',
      type: 'line',
      source,
      'source-layer': 'landuse',
      minzoom: 13,
      filter: kindIn('wetland'),
      paint: { 'line-color': c.wetlandEdge, 'line-width': 0.8, 'line-dasharray': [2, 2] },
    },
  );

  layers.push(
    {
      id: 'base-water-area',
      type: 'fill',
      source,
      'source-layer': 'water',
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!', kindIn('swimming_pool', 'fountain')]],
      paint: { 'fill-color': c.water, 'fill-outline-color': c.waterLine },
    },
    {
      id: 'base-water-line',
      type: 'line',
      source,
      'source-layer': 'water',
      filter: waterLineShown,
      layout: round,
      paint: { 'line-color': c.waterLine, 'line-width': waterLineWidth },
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
      minzoom: 11,
      filter: kindIn('locality'),
      paint: { 'line-color': c.boundaryLocal, 'line-width': 1, 'line-dasharray': [3, 2] },
    },
    ...countyLine(source, 'base', c.boundaryCounty, c.boundaryCountyBand, 0.5),
    {
      id: 'base-boundary-state',
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('region', 'country'),
      paint: { 'line-color': c.boundaryState, 'line-width': zoomed([6, 1.4], [16, 3.5]) },
    },
  );

  // Roads: casings first, then fills from small to large, so larger roads
  // draw over smaller ones at junctions. Below the zoom where a road gets its
  // casing, its fill is drawn in the casing color so it still shows.
  layers.push(
    {
      id: 'base-runway',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: kindIn('aeroway'),
      paint: { 'line-color': c.runway, 'line-width': zoomed([10, 2], [16, 18]) },
    },
    {
      id: 'base-path',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 14,
      filter: isPath,
      layout: round,
      paint: { 'line-color': c.path, 'line-width': zoomed(...W.path), 'line-dasharray': [0.1, 2] },
    },
    {
      id: 'base-track',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: isTrack,
      paint: { 'line-color': c.track, 'line-width': zoomed(...W.track), 'line-dasharray': [3, 1.5] },
    },
    {
      id: 'base-road-service-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 14,
      filter: isService,
      layout: round,
      paint: { 'line-color': c.minorRoadCasing, 'line-width': wider(W.service, 1.4) },
    },
    {
      id: 'base-road-minor-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: isMinor,
      layout: round,
      paint: { 'line-color': c.minorRoadCasing, 'line-width': wider(W.minor, 1.6) },
    },
    {
      id: 'base-road-major-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 11,
      filter: isMajor,
      layout: round,
      paint: { 'line-color': c.majorRoadCasing, 'line-width': wider(W.major, 1.8) },
    },
    {
      id: 'base-road-primary-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 9,
      filter: isPrimary,
      layout: round,
      paint: { 'line-color': c.primaryRoadCasing, 'line-width': wider(W.primary, 1.8) },
    },
    {
      id: 'base-road-motorway-casing',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 8,
      filter: isMotorway,
      layout: round,
      paint: { 'line-color': c.motorwayCasing, 'line-width': wider(W.motorway, 2) },
    },
    {
      id: 'base-rail',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 9,
      filter: ['all', kindIn('rail'), ['!', detailIn('disused', 'abandoned', 'razed')]],
      paint: { 'line-color': c.rail, 'line-width': zoomed([9, 0.8], [13, 1.4], [16, 2.2]) },
    },
    {
      id: 'base-rail-ties',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: ['all', kindIn('rail'), ['!', detailIn('disused', 'abandoned', 'razed')]],
      paint: { 'line-color': c.rail, 'line-width': zoomed([13, 5], [16, 8]), 'line-dasharray': [0.25, 2.5] },
    },
    {
      id: 'base-road-service',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 14,
      filter: isService,
      layout: round,
      paint: { 'line-color': c.minorRoad, 'line-width': zoomed(...W.service) },
    },
    {
      id: 'base-road-minor',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: isMinor,
      layout: round,
      paint: { 'line-color': ['step', ['zoom'], c.minorRoadCasing, 13, c.minorRoad], 'line-width': zoomed(...W.minor) },
    },
    {
      id: 'base-road-major',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 9,
      filter: isMajor,
      layout: round,
      paint: { 'line-color': ['step', ['zoom'], c.majorRoadCasing, 11, c.majorRoad], 'line-width': zoomed(...W.major) },
    },
    {
      id: 'base-road-primary',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: isPrimary,
      layout: round,
      paint: { 'line-color': c.primaryRoad, 'line-width': zoomed(...W.primary) },
    },
    {
      id: 'base-road-motorway',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: isMotorway,
      layout: round,
      paint: { 'line-color': c.motorway, 'line-width': zoomed(...W.motorway) },
    },
  );

  return layers;
}

/**
 * A plain, muted base map drawn under the imagery in the aerial and hybrid
 * views: land, woods, water and roads only, no labels. It shows where and
 * when there is no imagery (beyond the imagery's area, or below its first
 * zoom), so the screen is never blank. Kept small because it is drawn under
 * opaque imagery too.
 */
export function plainBaseMapLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'plain-land',
      type: 'fill',
      source,
      'source-layer': 'earth',
      paint: { 'fill-color': plain.land },
    },
    {
      id: 'plain-wood',
      type: 'fill',
      source,
      'source-layer': 'landuse',
      filter: kindIn('wood', 'forest'),
      paint: { 'fill-color': plain.wood },
    },
    {
      id: 'plain-water-area',
      type: 'fill',
      source,
      'source-layer': 'water',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': plain.water },
    },
    {
      id: 'plain-water-line',
      type: 'line',
      source,
      'source-layer': 'water',
      filter: waterLineShown,
      paint: { 'line-color': plain.waterLine, 'line-width': waterLineWidth },
    },
    {
      id: 'plain-road-minor',
      type: 'line',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: ['any', isMinor, isMajor],
      paint: { 'line-color': plain.road, 'line-width': zoomed([12, 0.6], [16, 2.5]) },
    },
    {
      id: 'plain-road-major',
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: ['any', isMotorway, isPrimary],
      paint: { 'line-color': plain.majorRoad, 'line-width': zoomed([7, 0.6], [10, 1.2], [16, 4]) },
    },
  ];
}

export interface LabelColors {
  text: string;
  halo: string;
  haloWidth: number;
  place: string;
  road: string;
  water: string;
  park: string;
}

export const labelsOnMap: LabelColors = {
  text: c.labelText,
  halo: c.labelHalo,
  haloWidth: 1.5,
  place: c.placeText,
  road: c.roadText,
  water: c.waterText,
  park: c.parkText,
};

export const labelsOnImagery: LabelColors = {
  text: img.labelText,
  halo: img.labelHalo,
  haloWidth: 1.8,
  place: img.labelText,
  road: img.labelText,
  water: img.waterText,
  park: img.labelText,
};

/** The first route of a road that carries several ("US 150;IL 49" gives "US 150"). */
const firstRef: ExpressionSpecification = [
  'let',
  'r',
  ['coalesce', ['get', 'ref'], ''],
  ['case', ['>=', ['index-of', ';', ['var', 'r']], 0], ['slice', ['var', 'r'], 0, ['index-of', ';', ['var', 'r']]], ['var', 'r']],
];

/** Interstate, US and state routes: the network is "US:I", "US:US" or a two-letter state ("US:IL"). */
const isNumberedRoute: ExpressionSpecification = ['all', ['has', 'network'], ['has', 'shield_text'], ['<=', ['length', ['get', 'network']], 5]];

/** "I 74", "US 150", "IL 47", built from the network and the route number. */
const routeText: ExpressionSpecification = [
  'concat',
  ['match', ['get', 'network'], 'US:I', 'I', 'US:US', 'US', ['slice', ['get', 'network'], 3]],
  ' ',
  ['get', 'shield_text'],
];

/** Place, road, water and park names and route numbers. Used by the map and hybrid views. */
export function baseMapLabelLayers(source: string, colors: LabelColors): LayerSpecification[] {
  const halo = { 'text-halo-color': colors.halo, 'text-halo-width': colors.haloWidth, 'text-halo-blur': 0.4 };
  const shieldLayout = {
    'symbol-placement': 'line' as const,
    'symbol-spacing': 360,
    'text-font': fonts.medium,
    'text-size': zoomed([9, 10], [14, 11.5]),
    'text-rotation-alignment': 'viewport' as const,
    'icon-rotation-alignment': 'viewport' as const,
    'icon-text-fit': 'both' as const,
    'icon-text-fit-padding': [1, 3, 1, 3] as [number, number, number, number],
    'text-padding': 6,
  };
  return [
    {
      id: 'label-road',
      type: 'symbol',
      source,
      'source-layer': 'roads',
      minzoom: 13,
      filter: [
        'all',
        ['has', 'name'],
        ['any', kindIn('highway', 'major_road', 'minor_road'), isTrack],
        ['any', ['!=', ['get', 'kind_detail'], 'service'], ['>=', ['zoom'], 15]],
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': labelName,
        'text-font': fonts.regular,
        'text-size': zoomed([13, 11], [16, 13.5]),
        'text-letter-spacing': 0.02,
        'symbol-spacing': 320,
      },
      paint: { 'text-color': colors.road, ...halo },
    },
    // Park and nature reserve names are left out: the public land overlay
    // names public sites from its own data, and a second, different name
    // for the same woods would confuse.
    {
      id: 'label-cemetery',
      type: 'symbol',
      source,
      'source-layer': 'pois',
      minzoom: 14,
      filter: kindIn('cemetery'),
      layout: { 'text-field': labelName, 'text-font': fonts.italic, 'text-size': 11, 'text-max-width': 8 },
      paint: { 'text-color': colors.text, ...halo },
    },
    {
      id: 'label-water-line',
      type: 'symbol',
      source,
      'source-layer': 'water',
      minzoom: 11,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['has', 'name'], ['>=', ['zoom'], ['match', ['get', 'kind'], 'river', 11, 13]]],
      layout: {
        'symbol-placement': 'line',
        'text-field': labelName,
        'text-font': fonts.italic,
        'text-size': zoomed([11, 11.5], [16, 14]),
        'text-letter-spacing': 0.06,
        'symbol-spacing': 400,
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
      layout: { 'text-field': labelName, 'text-font': fonts.italic, 'text-size': 12.5, 'text-max-width': 8, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': colors.water, ...halo },
    },
    {
      id: 'label-shield-county',
      type: 'symbol',
      source,
      'source-layer': 'roads',
      minzoom: 12,
      filter: ['all', kindIn('major_road', 'minor_road'), ['has', 'ref'], ['!', isNumberedRoute], ['<=', ['length', firstRef], 9]],
      layout: { ...shieldLayout, 'text-field': firstRef, 'icon-image': IMAGE_SHIELD_COUNTY },
      paint: { 'text-color': c.shieldCountyText },
    },
    {
      id: 'label-shield-route',
      type: 'symbol',
      source,
      'source-layer': 'roads',
      minzoom: 8,
      filter: ['all', kindIn('highway', 'major_road'), isNumberedRoute],
      layout: { ...shieldLayout, 'text-field': routeText, 'icon-image': IMAGE_SHIELD_MAJOR },
      paint: { 'text-color': c.shieldText },
    },
    {
      id: 'label-place-small',
      type: 'symbol',
      source,
      'source-layer': 'places',
      filter: ['all', kindIn('neighbourhood', 'macrohood'), reachedMinZoom],
      minzoom: 13,
      layout: { 'text-field': labelName, 'text-font': fonts.regular, 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1, 'text-max-width': 7 },
      paint: { 'text-color': colors.text, ...halo },
    },
    {
      id: 'label-place',
      type: 'symbol',
      source,
      'source-layer': 'places',
      filter: [
        'all',
        kindIn('locality'),
        reachedMinZoom,
        // Hamlets (a crossroads with a name) from zoom 12.
        ['any', ['!=', ['get', 'kind_detail'], 'hamlet'], ['>=', ['zoom'], 12]],
      ],
      layout: {
        'text-field': labelName,
        'text-font': fonts.medium,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, ['match', ['get', 'kind_detail'], 'city', 14, 'town', 12.5, 11],
          14, ['match', ['get', 'kind_detail'], 'city', 21, 'town', 18, 'village', 15, 13],
        ],
        'text-max-width': 8,
        'text-letter-spacing': 0.02,
        'symbol-sort-key': ['coalesce', ['get', 'sort_key'], ['get', 'min_zoom'], 99],
      },
      paint: { 'text-color': colors.place, ...halo, 'text-halo-width': colors.haloWidth + 0.3 },
    },
  ];
}

/** The county line over imagery: a light band and a white dash-dot core on a dark casing. */
export function countyLineOnImagery(source: string): LayerSpecification[] {
  const [band, core] = countyLine(source, 'hybrid', img.boundaryCounty, img.boundaryCountyBand, 0.28);
  return [
    band!,
    {
      id: 'hybrid-boundary-county-casing',
      type: 'line',
      source,
      'source-layer': 'boundaries',
      filter: kindIn('county'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': img.casing, 'line-opacity': 0.8, 'line-width': zoomed([7, 2.6], [10, 3.3], [14, 4.2], [16, 5]) },
    },
    core!,
  ];
}

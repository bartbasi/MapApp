// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The property lines (parcel outlines) and the phone's relation to them.
//
// - One map source per county parcel archive (D27), like imagery: a county's
//   parcel tile holds only that county's parcels, so where two counties share
//   a tile both must be drawn. Each archive gets a casing and a core layer.
// - The tapped parcel: its outline, read by StoredParcelSource.outline, in a
//   GeoJSON source that the map updates in place.
// - The relation layers: the soft highlight on the parcel the phone is in,
//   the connector from the marker to the nearest line with its tick, and in
//   the caution state the stretch of line the phone may be on. Also a GeoJSON
//   source updated in place (parcels/relation-features.ts makes the data).
// No fill: the ground under a parcel shows as it is.

import type { ExpressionSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl';
import type { ArchiveEntry } from '../../platform/archive-meta';
import { tileUrlTemplate } from '../tile-protocol';
import { IMAGE_PARCEL_TICK } from './images';
import { parcelPalette as pp, relationPalette as rp, selectionPalette as sel } from './palette';

/** The tile layer inside a parcel archive (D27). */
export const PARCEL_TILE_LAYER = 'parcels';
export const PARCEL_SELECTED_SOURCE = 'parcel-selected';
export const PARCEL_RELATION_SOURCE = 'parcel-relation';

/** The zoom from which the connector and its tick are drawn. */
export const CONNECTOR_MINZOOM = 15;

/** The map source ID of one county's parcel archive. Made from the installed list, never written in code. */
export function parcelSourceId(entry: ArchiveEntry): string {
  return `${entry.layer}:${entry.county}`;
}

/** One county archive's map source. Parcel data is credited in the layers panel, the details panel and the sources screen. */
export function parcelSource(entry: ArchiveEntry): SourceSpecification {
  return {
    type: 'vector',
    tiles: [tileUrlTemplate(entry.layer, entry.county)],
    minzoom: entry.meta.minzoom,
    maxzoom: entry.meta.maxzoom,
    bounds: entry.meta.bounds,
  };
}

function interpolate(stops: ReadonlyArray<readonly [number, number]>): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], ...stops.flat()] as unknown as ExpressionSpecification;
}

const coreWidth = interpolate(pp.coreWidth);
const casingWidth = interpolate(pp.coreWidth.map(([z, w]): [number, number] => [z, w + (z >= 15 ? pp.casingExtraHigh : pp.casingExtraLow)]));
const opacity = interpolate([
  [13, pp.opacityLow],
  [14, pp.opacityLow + (pp.opacityHigh - pp.opacityLow) * 0.4],
  [15, pp.opacityHigh],
]);

/** The outline layers of one county's archive: a dark casing under a bright core. */
export function parcelLineLayers(sourceId: string, minzoom: number): LayerSpecification[] {
  const base = { source: sourceId, 'source-layer': PARCEL_TILE_LAYER, minzoom } as const;
  return [
    {
      id: `parcels-casing:${sourceId}`,
      type: 'line',
      ...base,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': pp.casing, 'line-width': casingWidth, 'line-opacity': opacity },
    },
    {
      id: `parcels-line:${sourceId}`,
      type: 'line',
      ...base,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': pp.core, 'line-width': coreWidth, 'line-opacity': opacity },
    },
  ];
}

/** The tapped parcel's outline: yellow on black, as for a tapped public land site, a little wider than the parcel lines. */
export function parcelSelectedLayers(source: string): LayerSpecification[] {
  const extra = (add: number) => interpolate(pp.coreWidth.map(([z, w]): [number, number] => [z, w + add]));
  return [
    {
      id: 'parcel-selected-casing',
      type: 'line',
      source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': sel.casing, 'line-width': extra(sel.casingWidth) },
    },
    {
      id: 'parcel-selected',
      type: 'line',
      source,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': sel.core, 'line-width': extra(sel.coreWidth) },
    },
  ];
}

const part = (name: string): ExpressionSpecification => ['==', ['get', 'part'], name];

/**
 * The soft highlight on the parcel the phone is in: a wide glow drawn under
 * the property lines, so it surrounds the line without tinting its core.
 */
export function parcelHereLayers(source: string, onImagery: boolean): LayerSpecification[] {
  return [
    {
      id: 'parcel-here',
      type: 'line',
      source,
      filter: part('here'),
      // Flat ends: the outline comes in runs that meet at tile edges, and round ends would overlap there as dots.
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': onImagery ? rp.hereGlowOnImagery : rp.hereGlow,
        'line-opacity': onImagery ? rp.hereGlowOpacityOnImagery : rp.hereGlowOpacity,
        'line-width': rp.hereGlowWidth,
        'line-blur': 2,
      },
    },
  ];
}

/** The phone against the property lines: drawn above the outlines and labels, below the position marker. */
export function parcelRelationLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'parcel-near-casing',
      type: 'line',
      source,
      filter: part('near'),
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': rp.nearDark, 'line-width': rp.nearCasingWidth },
    },
    {
      id: 'parcel-near',
      type: 'line',
      source,
      filter: part('near'),
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': rp.nearStripe, 'line-width': rp.nearWidth },
    },
    {
      id: 'parcel-near-stripes',
      type: 'line',
      source,
      filter: part('near'),
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': rp.nearDark, 'line-width': rp.nearWidth, 'line-dasharray': [...rp.nearDash] },
    },
    {
      id: 'parcel-connector-casing',
      type: 'line',
      source,
      minzoom: CONNECTOR_MINZOOM,
      filter: part('connector'),
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': rp.connectorCasing, 'line-width': rp.connectorCasingWidth, 'line-opacity': 0.9 },
    },
    {
      id: 'parcel-connector',
      type: 'line',
      source,
      minzoom: CONNECTOR_MINZOOM,
      filter: part('connector'),
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': rp.connector, 'line-width': rp.connectorWidth, 'line-dasharray': [...rp.connectorDash] },
    },
    {
      id: 'parcel-tick',
      type: 'symbol',
      source,
      minzoom: CONNECTOR_MINZOOM,
      filter: part('tick'),
      layout: {
        'icon-image': IMAGE_PARCEL_TICK,
        'icon-rotate': ['get', 'rotate'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ];
}

/** Every relation layer ID drawn above the labels, in drawing order. */
export const PARCEL_RELATION_LAYER_IDS = [
  'parcel-near-casing',
  'parcel-near',
  'parcel-near-stripes',
  'parcel-connector-casing',
  'parcel-connector',
  'parcel-tick',
] as const;

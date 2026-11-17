// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Builds the MapLibre style from what the user chose and what is installed.
// A pure function: same input, same style.
//
// This file is the style's mechanics: which sources exist, which layers draw
// from them, and in what order. What the layers look like (colors, widths,
// fonts) is in the other files of this folder.
//
// Sources:
// - A vector layer is one source however many counties are installed. The tile
//   protocol answers each tile from whichever county's archive has it, which is
//   right because vector tiles are whole (they are not clipped at the county).
// - A raster layer is one source per installed archive, generated from the
//   installed list. A county's imagery is transparent beyond the county, and a
//   low zoom tile can span two counties, so every county's tile must be drawn.
// - Every source takes its zoom range and bounds from the metadata. Below a
//   source's minimum zoom it is not drawn; above its maximum MapLibre overzooms.
// - In the aerial and hybrid views a plain base map is drawn under the imagery,
//   so the screen is not blank where or when there is no imagery.
// - Parcels (property lines) are one source per county archive, like imagery
//   (D27): a county's parcel tile holds only that county's parcels.
//
// The order, bottom to top: background, base view, public land areas, the
// glow on the parcel the phone is in, property lines, the tapped parcel,
// labels, public land names, the phone's relation to the property lines
// (connector, tick, the caution stretch of line), the position marker (D26).

import type { FeatureCollection, Point } from 'geojson';
import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import { DEFAULT_RASTER_TILE_SIZE, type ArchiveEntry } from '../../platform/archive-meta';
import { attributionHtml, type InstalledLayer, type InstalledLayers } from '../installed';
import { PUBLIC_LAND_LAYER } from '../public-land';
import { tileUrlTemplate } from '../tile-protocol';
import { aerialLayer } from './aerial';
import { baseMapGroundLayers, baseMapLabelLayers, labelsOnImagery, labelsOnMap, plainBaseMapLayers } from './base-map';
import { hybridLineLayers } from './hybrid';
import { basePalette, imageryPalette, plainPalette } from './palette';
import {
  PARCEL_RELATION_SOURCE,
  PARCEL_SELECTED_SOURCE,
  parcelHereLayers,
  parcelLineLayers,
  parcelRelationLayers,
  parcelSelectedLayers,
  parcelSource,
  parcelSourceId,
} from './parcels';
import { POSITION_SOURCE, positionLayers } from './position';
import { PUBLIC_LAND_LABELS_SOURCE, publicLandAreaLayers, publicLandLabelLayers, type PublicLandSelection } from './public-land';

export const BASE_VIEWS = ['map', 'aerial', 'hybrid'] as const;
export type BaseView = (typeof BASE_VIEWS)[number];

export const BASEMAP_LAYER = 'basemap';
export const AERIAL_LAYER = 'aerial';
/** The archive layer ID of parcel archives (D27). */
export const PARCELS_LAYER = 'parcels';

export interface Overlays {
  publicland: boolean;
  /** Property lines. Off when absent. */
  parcels?: boolean;
}

export interface StyleOptions {
  base: BaseView;
  overlays: Overlays;
  installed: InstalledLayers;
  /** Glyph URL template, from fonts.ts glyphsUrl(). */
  glyphs: string;
  /** The tapped public land site, outlined. */
  selection?: PublicLandSelection | null;
  /** One label point per public land site, made by public-land-labels.ts from the loaded tiles. */
  publicLandLabels?: FeatureCollection<Point> | null;
  /**
   * The phone's position marker, made by position/marker.ts. The source and
   * its layers are always in the style, empty when position is off, so a new
   * base view never drops the marker. The map updates the data in place.
   */
  position?: FeatureCollection | null;
  /** The tapped parcel's outline. Like the marker, always in the style and updated in place. */
  parcelSelected?: FeatureCollection | null;
  /** The phone's relation to the property lines (parcels/relation-features.ts). Always in the style, updated in place. */
  parcelRelation?: FeatureCollection | null;
}

/** The GeoJSON sources the map updates in place, without a style rebuild. */
export const LIVE_SOURCES = [POSITION_SOURCE, PARCEL_SELECTED_SOURCE, PARCEL_RELATION_SOURCE] as const;

const EMPTY_LABELS: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
const EMPTY_FEATURES: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** The base views that the installed layers can draw. */
export function availableBaseViews(installed: InstalledLayers): BaseView[] {
  const hasBase = installed.get(BASEMAP_LAYER)?.kind === 'vector';
  const hasAerial = installed.get(AERIAL_LAYER)?.kind === 'raster';
  const out: BaseView[] = [];
  if (hasBase || !hasAerial) out.push('map');
  if (hasAerial) out.push('aerial');
  if (hasAerial && hasBase) out.push('hybrid');
  return out;
}

/** The requested base view if it can be drawn, else the first one that can. */
export function effectiveBaseView(requested: BaseView, installed: InstalledLayers): BaseView {
  const available = availableBaseViews(installed);
  return available.includes(requested) ? requested : (available[0] ?? 'map');
}

/**
 * A vector layer's one map source, for all counties. Only base view layers
 * carry an on-map credit: the line must stay short on a 344 dp wide screen.
 * Overlays are credited in the layers panel, the details panel and the
 * sources screen.
 */
function vectorSource(layer: InstalledLayer, creditOnMap: boolean): SourceSpecification {
  return {
    type: 'vector',
    tiles: [tileUrlTemplate(layer.layer)],
    minzoom: layer.minzoom,
    maxzoom: layer.maxzoom,
    bounds: layer.bounds,
    ...(creditOnMap ? { attribution: attributionHtml(layer.archives) } : {}),
  };
}

/** The source ID of one raster archive. Made from the installed list, never written in code. */
export function rasterSourceId(entry: ArchiveEntry): string {
  return `${entry.layer}:${entry.county}`;
}

/** One map source for one raster archive, with that archive's own bounds and zoom range. */
function rasterSource(entry: ArchiveEntry): SourceSpecification {
  return {
    type: 'raster',
    tiles: [tileUrlTemplate(entry.layer, entry.county)],
    tileSize: entry.meta.tileSize ?? DEFAULT_RASTER_TILE_SIZE,
    minzoom: entry.meta.minzoom,
    maxzoom: entry.meta.maxzoom,
    bounds: entry.meta.bounds,
    attribution: attributionHtml([entry]),
  };
}

export function buildStyle(opts: StyleOptions): StyleSpecification {
  const base = effectiveBaseView(opts.base, opts.installed);
  const basemap = opts.installed.get(BASEMAP_LAYER);
  const aerial = opts.installed.get(AERIAL_LAYER);
  const publicland = opts.installed.get(PUBLIC_LAND_LAYER);
  const onImagery = base !== 'map';
  const hasBase = basemap?.kind === 'vector';

  const sources: Record<string, SourceSpecification> = {};
  const ground: LayerSpecification[] = [];
  const labels: LayerSpecification[] = [];

  if (hasBase) sources[BASEMAP_LAYER] = vectorSource(basemap, true);

  if (base === 'map' && hasBase) {
    ground.push(...baseMapGroundLayers(BASEMAP_LAYER));
    labels.push(...baseMapLabelLayers(BASEMAP_LAYER, labelsOnMap));
  }
  if (onImagery) {
    // The plain base map goes first, under the imagery.
    if (hasBase) ground.push(...plainBaseMapLayers(BASEMAP_LAYER));
    if (aerial?.kind === 'raster') {
      for (const entry of aerial.archives) {
        const id = rasterSourceId(entry);
        sources[id] = rasterSource(entry);
        ground.push(aerialLayer(id));
      }
    }
  }
  if (base === 'hybrid' && hasBase) {
    ground.push(...hybridLineLayers(BASEMAP_LAYER));
    labels.push(...baseMapLabelLayers(BASEMAP_LAYER, labelsOnImagery));
  }

  const overlayAreas: LayerSpecification[] = [];
  const overlayLabels: LayerSpecification[] = [];
  if (opts.overlays.publicland && publicland?.kind === 'vector') {
    sources[PUBLIC_LAND_LAYER] = vectorSource(publicland, false);
    sources[PUBLIC_LAND_LABELS_SOURCE] = { type: 'geojson', data: opts.publicLandLabels ?? EMPTY_LABELS };
    overlayAreas.push(...publicLandAreaLayers(PUBLIC_LAND_LAYER, onImagery, opts.selection ?? null));
    overlayLabels.push(...publicLandLabelLayers(PUBLIC_LAND_LABELS_SOURCE, onImagery ? labelsOnImagery : labelsOnMap, onImagery));
  }

  // Property lines: above public land, below every label (D26).
  const parcelLines: LayerSpecification[] = [];
  const relation: LayerSpecification[] = [];
  const parcels = opts.installed.get(PARCELS_LAYER);
  sources[PARCEL_SELECTED_SOURCE] = { type: 'geojson', data: opts.parcelSelected ?? EMPTY_FEATURES };
  sources[PARCEL_RELATION_SOURCE] = { type: 'geojson', data: opts.parcelRelation ?? EMPTY_FEATURES };
  if (opts.overlays.parcels && parcels?.kind === 'vector') {
    // The glow on the parcel the phone is in goes under the lines, so it never tints them.
    parcelLines.push(...parcelHereLayers(PARCEL_RELATION_SOURCE, onImagery));
    for (const entry of parcels.archives) {
      const id = parcelSourceId(entry);
      sources[id] = parcelSource(entry);
      parcelLines.push(...parcelLineLayers(id, entry.meta.minzoom));
    }
    parcelLines.push(...parcelSelectedLayers(PARCEL_SELECTED_SOURCE));
    relation.push(...parcelRelationLayers(PARCEL_RELATION_SOURCE));
  }

  // The position marker goes last, above every other layer (D26).
  sources[POSITION_SOURCE] = { type: 'geojson', data: opts.position ?? EMPTY_FEATURES };

  return {
    version: 8,
    name: `MapApp ${base}`,
    glyphs: opts.glyphs,
    sources,
    layers: [
      {
        id: 'background',
        type: 'background',
        // Under the imagery: the plain base map's land color, or a dark gray with no base map at all.
        paint: { 'background-color': onImagery ? (hasBase ? plainPalette.land : imageryPalette.background) : basePalette.land },
      },
      ...ground,
      ...overlayAreas,
      ...parcelLines,
      ...labels,
      ...overlayLabels,
      ...relation,
      ...positionLayers(POSITION_SOURCE, onImagery),
    ],
  };
}

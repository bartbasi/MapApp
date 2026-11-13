// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Builds the MapLibre style from what the user chose and what is installed.
// A pure function: same input, same style. The style names layers, never
// counties: each layer is one source, answered by the tile protocol from
// whichever county's archive has the tile.

import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import { attributionHtml, type InstalledLayer, type InstalledLayers } from '../installed';
import { PUBLIC_LAND_LAYER } from '../public-land';
import { tileUrlTemplate } from '../tile-protocol';
import { aerialLayers } from './aerial';
import { baseMapGroundLayers, baseMapLabelLayers, labelsOnImagery, labelsOnMap } from './base-map';
import { hybridLineLayers } from './hybrid';
import { basePalette, imageryPalette } from './palette';
import { publicLandAreaLayers, publicLandLabelLayers, type PublicLandSelection } from './public-land';

export const BASE_VIEWS = ['map', 'aerial', 'hybrid'] as const;
export type BaseView = (typeof BASE_VIEWS)[number];

export const BASEMAP_LAYER = 'basemap';
export const AERIAL_LAYER = 'aerial';

export interface Overlays {
  publicland: boolean;
}

export interface StyleOptions {
  base: BaseView;
  overlays: Overlays;
  installed: InstalledLayers;
  /** Glyph URL template, from fonts.ts glyphsUrl(). */
  glyphs: string;
  /** The tapped public land site, outlined. */
  selection?: PublicLandSelection | null;
}

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
 * A layer's map source. Only base view layers carry an on-map credit: the line
 * must stay short on a 344 dp wide screen. Overlays are credited in the layers
 * panel and on the sources screen.
 */
function sourceFor(layer: InstalledLayer, creditOnMap: boolean): SourceSpecification {
  const common = {
    tiles: [tileUrlTemplate(layer.layer)],
    minzoom: layer.minzoom,
    maxzoom: layer.maxzoom,
    bounds: layer.bounds,
    ...(creditOnMap ? { attribution: attributionHtml(layer) } : {}),
  };
  return layer.kind === 'raster' ? { type: 'raster', tileSize: 512, ...common } : { type: 'vector', ...common };
}

export function buildStyle(opts: StyleOptions): StyleSpecification {
  const base = effectiveBaseView(opts.base, opts.installed);
  const basemap = opts.installed.get(BASEMAP_LAYER);
  const aerial = opts.installed.get(AERIAL_LAYER);
  const publicland = opts.installed.get(PUBLIC_LAND_LAYER);
  const onImagery = base !== 'map';

  const sources: Record<string, SourceSpecification> = {};
  const ground: LayerSpecification[] = [];
  const labels: LayerSpecification[] = [];

  if (base === 'map' && basemap?.kind === 'vector') {
    sources[BASEMAP_LAYER] = sourceFor(basemap, true);
    ground.push(...baseMapGroundLayers(BASEMAP_LAYER));
    labels.push(...baseMapLabelLayers(BASEMAP_LAYER, labelsOnMap));
  }
  if (onImagery && aerial?.kind === 'raster') {
    sources[AERIAL_LAYER] = sourceFor(aerial, true);
    ground.push(...aerialLayers(AERIAL_LAYER));
  }
  if (base === 'hybrid' && basemap?.kind === 'vector') {
    sources[BASEMAP_LAYER] = sourceFor(basemap, true);
    ground.push(...hybridLineLayers(BASEMAP_LAYER));
    labels.push(...baseMapLabelLayers(BASEMAP_LAYER, labelsOnImagery));
  }

  const overlayAreas: LayerSpecification[] = [];
  const overlayLabels: LayerSpecification[] = [];
  if (opts.overlays.publicland && publicland?.kind === 'vector') {
    sources[PUBLIC_LAND_LAYER] = sourceFor(publicland, false);
    overlayAreas.push(...publicLandAreaLayers(PUBLIC_LAND_LAYER, onImagery, opts.selection ?? null));
    overlayLabels.push(...publicLandLabelLayers(PUBLIC_LAND_LAYER, onImagery ? labelsOnImagery : labelsOnMap));
  }

  return {
    version: 8,
    name: `MapApp ${base}`,
    glyphs: opts.glyphs,
    sources,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': onImagery ? imageryPalette.background : basePalette.land },
      },
      ...ground,
      ...overlayAreas,
      ...labels,
      ...overlayLabels,
    ],
  };
}

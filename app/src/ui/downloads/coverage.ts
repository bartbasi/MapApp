// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Whether the map has anything to draw up close at a place. The app carries
// an overview map of zoom 0 to 11 (D33); past that, only a downloaded county
// or area, or map data built into the app, has detail.

import type { AreaView } from '../../downloads/contract';
import type { InstalledLayers } from '../../map/installed';
import type { Bounds } from '../../map/tile-math';
import { contains } from './frame';

/** The overview map stops at zoom 11. From zoom 12 the map needs data of the place itself. */
export const DETAIL_FROM_ZOOM = 12;

/** Layers that give the map its ground: without one of them, nothing much is drawn. */
const GROUND_LAYERS = ['basemap', 'aerial'];

/** Rectangles that have detail past the overview: installed base map or imagery with closer zooms, and complete downloads. */
export function detailedAreas(installed: InstalledLayers, areas: readonly AreaView[]): Bounds[] {
  const out: Bounds[] = [];
  for (const layer of GROUND_LAYERS) {
    for (const a of installed.get(layer)?.archives ?? []) {
      if (a.meta.maxzoom >= DETAIL_FROM_ZOOM) out.push(a.meta.bounds);
    }
  }
  for (const a of areas) if (a.status === 'complete' && a.record.layers.length > 0) out.push(a.record.bounds);
  return out;
}

/** True when the map is close in on a place that has no detail: the time to invite a download. */
export function needsDownload(zoom: number, center: { lng: number; lat: number }, detailed: readonly Bounds[]): boolean {
  if (zoom < DETAIL_FROM_ZOOM) return false;
  return !detailed.some((b) => contains(b, center));
}

/** Imagery has no overview: outside downloaded imagery the Aerial and Hybrid views are bare from this zoom on. */
export const IMAGERY_FROM_ZOOM = 11;

/** Rectangles with imagery on the phone: installed imagery, and complete downloads that hold it. */
export function imageryAreas(installed: InstalledLayers, areas: readonly AreaView[]): Bounds[] {
  const out: Bounds[] = (installed.get('aerial')?.archives ?? []).map((a) => a.meta.bounds);
  for (const a of areas) if (a.status === 'complete' && a.record.layers.includes('aerial')) out.push(a.record.bounds);
  return out;
}

export interface Invite {
  /** 'imagery': the Aerial or Hybrid view has no imagery here. 'map': only the overview map is here. */
  kind: 'imagery' | 'map';
  /** False when no county on offer covers the place, so there is nothing to download for it. */
  offered: boolean;
}

/**
 * Which card, if any, the map shows to explain a bare map: imagery first in
 * the Aerial and Hybrid views, then the map itself. `offered` is the
 * counties on offer, or null before the list has been fetched (then a
 * download is assumed possible).
 */
export function inviteFor(o: {
  zoom: number;
  center: { lng: number; lat: number };
  view: 'map' | 'aerial' | 'hybrid';
  detailed: readonly Bounds[];
  imagery: readonly Bounds[];
  offered: readonly Bounds[] | null;
}): Invite | null {
  const offered = o.offered === null || o.offered.some((b) => contains(b, o.center));
  if (o.view !== 'map' && o.zoom >= IMAGERY_FROM_ZOOM && !o.imagery.some((b) => contains(b, o.center))) return { kind: 'imagery', offered };
  if (needsDownload(o.zoom, o.center, o.detailed)) return { kind: 'map', offered };
  return null;
}

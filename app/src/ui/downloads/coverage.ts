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

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Bigger area and Smaller area: each tap doubles or halves the width of the
// ground in the picker's frame, zooming about the frame's middle (which is
// not the map's middle when a sheet covers the bottom of the map).

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { DownloadsUi } from './downloads-ui.svelte';
import { steppedZoom } from './frame';

const pending = new WeakMap<MapLibreMap, number>();

export function zoomFrame(map: MapLibreMap, ui: DownloadsUi, direction: 1 | -1): void {
  const target = steppedZoom(map.getZoom(), pending.get(map) ?? null, direction);
  pending.set(map, target);
  const c = ui.frameCenter;
  map.easeTo({ zoom: target, ...(c ? { around: map.unproject([c.x, c.y]) } : {}), duration: 350 });
  map.once('moveend', () => {
    if (pending.get(map) === target) pending.delete(map);
  });
}

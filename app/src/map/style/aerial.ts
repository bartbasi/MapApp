// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The aerial imagery layer, used by the aerial and hybrid views. There is one
// per installed aerial archive; build-style.ts decides how many and in what order.

import type { LayerSpecification } from 'maplibre-gl';

/** The imagery layer for one aerial archive's source. */
export function aerialLayer(source: string): LayerSpecification {
  return {
    id: `imagery:${source}`,
    type: 'raster',
    source,
    paint: {
      // Blend between tiles of two zooms while zooming, to hide the switch.
      'raster-fade-duration': 150,
      'raster-resampling': 'linear',
    },
  };
}

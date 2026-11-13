// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The aerial imagery layer, used by the aerial and hybrid views.

import type { LayerSpecification } from 'maplibre-gl';

export function aerialLayers(source: string): LayerSpecification[] {
  return [
    {
      id: 'aerial-imagery',
      type: 'raster',
      source,
      paint: {
        // Blend between tiles of two zooms while zooming, to hide the switch.
        'raster-fade-duration': 150,
        'raster-resampling': 'linear',
      },
    },
  ];
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaView } from '../../downloads/contract';
import { outlineFeatures } from './outline-features';

const view = (id: string, name: string, bounds: [number, number, number, number], layers = ['basemap']): AreaView => ({
  record: { id, name, bounds, layers, aerialMaxzoom: 16, created: '', release: '', dataDate: '', bytes: 1 },
  status: 'complete',
  bytesDone: 1,
  bytesTotal: 1,
});

describe('outlineFeatures', () => {
  it('draws one closed rectangle per download, and names the one looked at at its north west corner', () => {
    const fc = outlineFeatures([view('a', 'North timber', [-89.1, 39.9, -89, 40]), view('b', 'Creek bottom', [-89, 39.8, -88.9, 39.9])], 'a');
    const polys = fc.features.filter((f) => f.geometry.type === 'Polygon');
    expect(polys).toHaveLength(2);
    // The one looked at is last, so its heavier line is on top.
    expect(polys[1]!.properties).toEqual({ id: 'a', shown: true });
    expect(polys[1]!.geometry).toEqual({ type: 'Polygon', coordinates: [[[-89.1, 39.9], [-89, 39.9], [-89, 40], [-89.1, 40], [-89.1, 39.9]]] });
    const label = fc.features.find((f) => f.geometry.type === 'Point');
    expect(label).toEqual({ type: 'Feature', geometry: { type: 'Point', coordinates: [-89.1, 40] }, properties: { name: 'North timber' } });
  });

  it('leaves out a record the phone could not read, and names nothing when none is looked at', () => {
    const fc = outlineFeatures([view('x', '', [0, 0, 0, 0], []), view('b', 'B', [-89, 39.8, -88.9, 39.9])], null);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toEqual({ id: 'b', shown: false });
  });
});

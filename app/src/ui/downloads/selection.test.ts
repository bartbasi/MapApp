// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaView } from '../../downloads/contract';
import { FAKE_OFFERS } from '../../downloads/fake-service';
import { chosenLayers, countyAlreadyHas, countyBytes, countyImageryMaxzoom, layerChoices, offeredLayers } from './selection';

const macon = FAKE_OFFERS[1]!;

describe('layerChoices', () => {
  it('always includes the map, and the layers that are on', () => {
    const c = layerChoices(['aerial', 'publicland', 'basemap'], ['basemap', 'publicland']);
    expect(c).toEqual([
      { layer: 'basemap', rule: 'always', chosen: true },
      { layer: 'publicland', rule: 'on', chosen: true },
      { layer: 'aerial', rule: 'optional', chosen: false },
    ]);
  });

  it('starts with imagery chosen when the base view shows it, and lets it be left out', () => {
    const c = layerChoices(['basemap', 'aerial'], ['basemap', 'aerial']);
    expect(c[1]).toEqual({ layer: 'aerial', rule: 'optional', chosen: true });
    expect(chosenLayers(c, new Set())).toEqual(['basemap']);
    expect(chosenLayers(c, new Set(['aerial']))).toEqual(['basemap', 'aerial']);
  });

  it('offers a layer that is off without choosing it', () => {
    const c = layerChoices(['basemap', 'publicland'], ['basemap']);
    expect(c[1]).toEqual({ layer: 'publicland', rule: 'optional', chosen: false });
  });
});

describe('county sizes', () => {
  it('adds up the whole files of the chosen layers', () => {
    expect(countyBytes(macon, ['basemap', 'publicland'])).toBe(4271625 + 99815);
    expect(countyBytes(macon, ['basemap', 'publicland', 'aerial'])).toBe(4271625 + 99815 + 140565035);
    expect(countyImageryMaxzoom(macon)).toBe(16);
    expect(offeredLayers(FAKE_OFFERS)).toEqual(['basemap', 'publicland', 'aerial']);
  });

  it('knows a county already on the phone with every layer asked for', () => {
    const view = (layers: string[], status: AreaView['status']): AreaView => ({
      record: { id: 'a', name: 'Macon County', bounds: macon.bounds, county: 'il-macon', layers, aerialMaxzoom: 16, created: '', release: '', dataDate: '', bytes: 1 },
      status,
      bytesDone: 0,
      bytesTotal: 1,
    });
    expect(countyAlreadyHas([view(['basemap', 'publicland'], 'complete')], 'il-macon', ['basemap'])).not.toBeNull();
    expect(countyAlreadyHas([view(['basemap', 'publicland'], 'complete')], 'il-macon', ['basemap', 'aerial'])).toBeNull();
    expect(countyAlreadyHas([view(['basemap'], 'failed')], 'il-macon', ['basemap'])).toBeNull();
    expect(countyAlreadyHas([view(['basemap'], 'complete')], 'il-champaign', ['basemap'])).toBeNull();
  });
});

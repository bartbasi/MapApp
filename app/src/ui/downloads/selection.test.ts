// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaView } from '../../downloads/contract';
import { FAKE_OFFERS } from '../../downloads/fake-service';
import { chosenLayers, countyBytes, countyDownloadName, countyHoldings, countyImageryMaxzoom, layerChoices, missingLayers, offeredLayers } from './selection';

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
    // A map-only download, then imagery wanted: only imagery is missing (tester's F4).
    const mapOnly = countyHoldings([view(['basemap', 'publicland'], 'complete')], 'il-macon');
    expect([...mapOnly]).toEqual([['basemap', 'on-phone'], ['publicland', 'on-phone']]);
    expect(missingLayers(['basemap', 'publicland', 'aerial'], mapOnly)).toEqual(['aerial']);
    expect(countyDownloadName('Macon County', ['aerial'], mapOnly)).toBe('Macon County, aerial imagery');
    // Imagery first, then public land turned on.
    const withImagery = countyHoldings([view(['basemap', 'aerial'], 'complete')], 'il-macon');
    expect(missingLayers(['basemap', 'publicland', 'aerial'], withImagery)).toEqual(['publicland']);
    // Nothing yet: the plain county name.
    expect(countyDownloadName('Macon County', ['basemap'], new Map())).toBe('Macon County');
    // A download on its way counts; a stopped one does not; another county does not.
    expect(countyHoldings([view(['basemap'], 'downloading')], 'il-macon').get('basemap')).toBe('coming');
    expect(countyHoldings([view(['basemap'], 'failed')], 'il-macon').size).toBe(0);
    expect(countyHoldings([view(['basemap'], 'complete')], 'il-champaign').size).toBe(0);
    // On the phone wins over on its way.
    expect(countyHoldings([view(['basemap'], 'queued'), { ...view(['basemap'], 'complete') }], 'il-macon').get('basemap')).toBe('on-phone');
  });
});

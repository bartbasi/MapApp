// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { archivePath, parseArchiveMeta, parseArchivePath } from './archive-meta';

describe('archive paths', () => {
  it('round-trips a valid path', () => {
    expect(parseArchivePath(archivePath('il-champaign', 'basemap'))).toEqual({ county: 'il-champaign', layer: 'basemap' });
  });

  it('refuses anything that is not a plain county and layer', () => {
    for (const p of [
      '/_tiles/../basemap.pmtiles',
      '/_tiles/il-champaign/../../x.pmtiles',
      '/_tiles/il-champaign/sub/basemap.pmtiles',
      '/_tiles/IL-Champaign/basemap.pmtiles',
      '/_tiles/il-champaign/basemap.meta.json',
      '/_tiles/il-champaign/.pmtiles',
      '/_tiles/il champaign/basemap.pmtiles',
    ]) {
      expect(parseArchivePath(p), p).toBeNull();
    }
  });
});

describe('parseArchiveMeta', () => {
  const good = {
    schema: 1,
    layer: 'publicland',
    county: 'il-champaign',
    countyName: 'Champaign County, Illinois',
    kind: 'vector',
    title: 'Public land',
    minzoom: 6,
    maxzoom: 14,
    bounds: [-88.47, 39.87, -87.92, 40.41],
    bytes: 123456,
    buildDate: '2026-11-12',
    sources: [{ name: 'USGS PAD-US 4.1', license: 'Public domain', credit: 'USGS', url: 'https://doi.org/x', dataDate: '2025-03-31' }],
    notes: 'n',
  };

  it('reads the example from the contract', () => {
    expect(parseArchiveMeta(good)).toEqual(good);
  });

  it('refuses a file missing its bounds, kind or sources', () => {
    expect(() => parseArchiveMeta({ ...good, bounds: [1, 2, 3] })).toThrow();
    expect(() => parseArchiveMeta({ ...good, kind: 'mesh' })).toThrow();
    expect(() => parseArchiveMeta({ ...good, sources: undefined })).toThrow();
    expect(() => parseArchiveMeta({ ...good, layer: '../x' })).toThrow();
  });

  it('reads the coverage outline, and leaves out one that is not a polygon', () => {
    const ring: [number, number][] = [
      [-89, 39.7],
      [-88.8, 39.7],
      [-88.8, 40],
      [-89, 39.7],
    ];
    expect(parseArchiveMeta({ ...good, coverage: { type: 'Polygon', coordinates: [ring] } }).coverage).toEqual({ type: 'Polygon', coordinates: [ring] });
    expect(parseArchiveMeta({ ...good, coverage: { type: 'MultiPolygon', coordinates: [[ring], [ring]] } }).coverage?.type).toBe('MultiPolygon');
    expect(parseArchiveMeta(good).coverage).toBeUndefined();
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(parseArchiveMeta({ ...good, coverage: { type: 'Point', coordinates: [-89, 39.7] } }).coverage).toBeUndefined();
      expect(parseArchiveMeta({ ...good, coverage: { type: 'Polygon', coordinates: [ring.slice(0, 2)] } }).coverage).toBeUndefined();
      expect(parseArchiveMeta({ ...good, coverage: { type: 'Polygon', coordinates: [[[39.7, -200], ...ring]] } }).coverage).toBeUndefined();
    } finally {
      console.warn = warn;
    }
  });
});

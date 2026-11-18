// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { ArchiveEntry, ArchiveMeta, ArchiveSource } from '../platform/archive-meta';
import { groupSources } from './sources-groups';

const osm: ArchiveSource = { name: 'OpenStreetMap', license: 'ODbL 1.0', credit: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', dataDate: '2026-11-12' };

function entry(county: string, countyName: string, layer: string, area?: string, sources: ArchiveSource[] = [osm]): ArchiveEntry {
  const meta = { schema: 1, layer, county, countyName, kind: 'vector', title: layer === 'basemap' ? 'Base map' : 'Public land', minzoom: 0, maxzoom: 15, bounds: [0, 0, 1, 1], bytes: 1024, buildDate: '2026-11-17', sources, notes: '' } as ArchiveMeta;
  return { county, layer, meta, ...(area !== undefined ? { area } : {}) };
}

describe('groupSources', () => {
  it('lists a layer once, with every place it covers and each source once', () => {
    const entries = [
      entry('il-macon', 'Macon County, Illinois', 'basemap', 'a1'),
      entry('il-macon', 'Macon County, Illinois', 'basemap', 'a2'),
      entry('il-macon', 'Macon County, Illinois', 'publicland'),
      entry('overview', 'Overview map', 'basemap'),
    ];
    const groups = groupSources(entries, new Map([['a1', 'North timber'], ['a2', 'Macon County']]));
    expect(groups.map((g) => g.layer)).toEqual(['basemap', 'publicland']);
    const base = groups[0]!;
    expect(base.places.map((p) => p.where)).toEqual([
      'Macon County, downloaded as North timber',
      'Macon County, downloaded',
      'Overview map of the whole region, with the app',
    ]);
    expect(new Set(base.places.map((p) => p.key)).size).toBe(3);
    expect(base.sources).toHaveLength(1);
    expect(groups[1]!.places[0]!.where).toBe('Macon County, with the app');
  });

  it('keeps sources that differ in any part', () => {
    const older = { ...osm, dataDate: '2026-10-01' };
    const groups = groupSources([entry('il-macon', 'Macon County', 'basemap', 'a1'), entry('il-macon', 'Macon County', 'basemap', 'a2', [older])]);
    expect(groups[0]!.sources).toHaveLength(2);
  });

  it('does not repeat the same archive', () => {
    const e = entry('il-macon', 'Macon County', 'basemap');
    expect(groupSources([e, e])[0]!.places).toHaveLength(1);
  });
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { AreaView } from '../../downloads/contract';
import { summarizeInstalled } from '../../map/installed';
import type { ArchiveEntry, ArchiveMeta } from '../../platform/archive-meta';
import type { Bounds } from '../../map/tile-math';
import { detailedAreas, imageryAreas, inviteFor, needsDownload } from './coverage';

function entry(county: string, layer: string, maxzoom: number, bounds: Bounds): ArchiveEntry {
  const meta = { schema: 1, layer, county, countyName: county, kind: layer === 'aerial' ? 'raster' : 'vector', title: layer, minzoom: 0, maxzoom, bounds, bytes: 1, buildDate: '2026-11-17', sources: [] } as unknown as ArchiveMeta;
  return { county, layer, meta };
}

const overview = entry('overview', 'basemap', 11, [-89.7, 39.15, -87.4, 40.9]);
const macon = entry('il-macon', 'basemap', 15, [-89.2179, 39.6526, -88.745, 40.0554]);
const parcels = entry('il-macon', 'parcels', 16, [-89.2179, 39.6526, -88.745, 40.0554]);
const decatur = { lng: -88.95, lat: 39.84 };

describe('needsDownload', () => {
  it('invites a download close in, where only the overview map is', () => {
    const detailed = detailedAreas(summarizeInstalled([overview, parcels]), []);
    expect(detailed).toEqual([]);
    expect(needsDownload(11.9, decatur, detailed)).toBe(false);
    expect(needsDownload(12, decatur, detailed)).toBe(true);
  });

  it('does not where a county is installed or a download is complete', () => {
    expect(needsDownload(15, decatur, detailedAreas(summarizeInstalled([overview, macon]), []))).toBe(false);
    const area: AreaView = {
      record: { id: 'a', name: 'x', bounds: [-89, 39.8, -88.9, 39.9], layers: ['basemap'], aerialMaxzoom: 14, created: '', release: '', dataDate: '', bytes: 1 },
      status: 'complete',
      allowMetered: false,
      bytesDone: 1,
      bytesTotal: 1,
    };
    const installed = summarizeInstalled([overview]);
    expect(needsDownload(15, decatur, detailedAreas(installed, [area]))).toBe(false);
    expect(needsDownload(15, decatur, detailedAreas(installed, [{ ...area, status: 'downloading' }]))).toBe(true);
    expect(needsDownload(15, { lng: -88.5, lat: 40.2 }, detailedAreas(installed, [area]))).toBe(true);
  });
});

describe('inviteFor', () => {
  const macon: Bounds = [-89.2179, 39.6526, -88.745, 40.0554];
  const area: Bounds = [-89, 39.8, -88.9, 39.9];
  const base = { zoom: 15, center: decatur, detailed: [macon], imagery: [] as Bounds[], offered: [macon] };

  it('says when the Aerial or Hybrid view has no imagery here (tester F3)', () => {
    expect(inviteFor({ ...base, view: 'hybrid' })).toEqual({ kind: 'imagery', offered: true });
    expect(inviteFor({ ...base, view: 'aerial' })).toEqual({ kind: 'imagery', offered: true });
    expect(inviteFor({ ...base, view: 'map' })).toBeNull();
    expect(inviteFor({ ...base, view: 'hybrid', imagery: [area] })).toBeNull();
    expect(inviteFor({ ...base, view: 'hybrid', zoom: 10 })).toBeNull();
  });

  it('falls back to the map card, and knows when nothing is offered for the place', () => {
    expect(inviteFor({ ...base, view: 'map', detailed: [] })).toEqual({ kind: 'map', offered: true });
    expect(inviteFor({ ...base, view: 'map', detailed: [], center: { lng: -90.5, lat: 41 } })).toEqual({ kind: 'map', offered: false });
    expect(inviteFor({ ...base, view: 'map', detailed: [], offered: null })).toEqual({ kind: 'map', offered: true });
  });

  it('counts imagery from installed archives and complete downloads that hold it', () => {
    const v = (layers: string[], status: AreaView['status']): AreaView => ({
      record: { id: 'a', name: 'x', bounds: area, layers, aerialMaxzoom: 16, created: '', release: '', dataDate: '', bytes: 1 },
      status,
      allowMetered: false,
      bytesDone: 1,
      bytesTotal: 1,
    });
    const none = summarizeInstalled([overview]);
    expect(imageryAreas(none, [v(['basemap', 'aerial'], 'complete')])).toEqual([area]);
    expect(imageryAreas(none, [v(['basemap'], 'complete'), v(['aerial'], 'paused')])).toEqual([]);
  });
});

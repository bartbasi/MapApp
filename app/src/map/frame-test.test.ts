// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import type { ArchiveEntry } from '../platform/archive-meta';
import { buildTour, summarizeFrames, tourArea } from './frame-test';
import { summarizeInstalled } from './installed';

function entry(county: string, layer: string, bounds: [number, number, number, number]): ArchiveEntry {
  return {
    county,
    layer,
    meta: { schema: 1, layer, county, countyName: county, kind: 'vector', title: layer, minzoom: 0, maxzoom: 15, bounds, bytes: 1, buildDate: '', sources: [], notes: '' },
  };
}

describe('frame test', () => {
  it('tours inside one archive, not the gap between two counties', () => {
    const installed = summarizeInstalled([
      entry('il-champaign', 'basemap', [-88.46, 39.88, -87.93, 40.4]),
      entry('il-macon', 'basemap', [-89.22, 39.65, -88.74, 40.06]),
    ]);
    const area = tourArea(installed);
    expect(area?.bounds).toEqual([-88.46, 39.88, -87.93, 40.4]);
    const tour = buildTour(area!.bounds, area!.minzoom, area!.maxzoom);
    expect(tour).toHaveLength(7); // a start and six 2.5 s legs: 15 s
    for (const s of tour) {
      expect(s.center[0]).toBeGreaterThan(-88.46);
      expect(s.center[0]).toBeLessThan(-87.93);
      expect(s.zoom).toBeLessThanOrEqual(15.5);
    }
  });

  it('has nothing to tour when nothing is installed', () => {
    expect(tourArea(summarizeInstalled([]))).toBeNull();
  });

  it('summarizes frame times', () => {
    const r = summarizeFrames([...Array(99).fill(16), 50], 120.4);
    expect(r.frames).toBe(100);
    expect(r.framesOver33ms).toBe(1);
    expect(r.worst1pctFps).toBe(20);
    expect(r.settleMs).toBe(120);
  });
});

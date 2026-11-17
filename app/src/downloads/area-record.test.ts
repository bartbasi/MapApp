// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { ARCHIVE_ID_PATTERN } from '../platform/archive-meta';
import { compareAreaIdsNewestFirst, makeAreaId, parseAreaRecord } from './area-record';

describe('area IDs', () => {
  it('are valid archive IDs', () => {
    for (let i = 0; i < 50; i++) expect(makeAreaId()).toMatch(ARCHIVE_ID_PATTERN);
    expect(makeAreaId(0, () => 0)).toBe('a000000000-00000000');
    expect(makeAreaId(Date.UTC(2026, 10, 17), () => 0.999)).toMatch(/^a[0-9a-z]{9}-z{8}$/);
  });

  it('differ when made in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeAreaId(1_800_000_000_000)));
    expect(ids.size).toBe(200);
  });

  it('sort newest first, those not made here last', () => {
    const old = makeAreaId(Date.UTC(2026, 0, 1));
    const later = makeAreaId(Date.UTC(2026, 10, 17));
    const muchLater = makeAreaId(Date.UTC(2090, 0, 1));
    expect(['odd-one', old, muchLater, later].sort(compareAreaIdsNewestFirst)).toEqual([muchLater, later, old, 'odd-one']);
  });
});

describe('area records', () => {
  it('parse back as written', () => {
    const rec = { id: 'x', name: 'Creek', bounds: [1, 2, 3, 4], layers: ['basemap'], aerialMaxzoom: 14, created: '2026-11-17T10:00:00.000Z', release: 'r', dataDate: '2025', bytes: 9, county: 'il-macon' };
    const { record, valid } = parseAreaRecord(JSON.stringify(rec), 'a1');
    expect(valid).toBe(true);
    expect(record).toEqual({ ...rec, id: 'a1' });
  });

  it('give a stand-in for a record that does not parse, so the area can still be removed', () => {
    for (const text of ['', 'not json', '[]', '{"name":1}']) {
      const { record, valid } = parseAreaRecord(text, 'a2');
      expect(valid).toBe(false);
      expect(record.id).toBe('a2');
      expect(record.layers).toEqual([]);
    }
  });
});

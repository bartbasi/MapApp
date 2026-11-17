// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { describe, expect, it } from 'vitest';
import { PARCEL_RECORD_FIELDS, toParcelRecord } from './parcel-record';
import { decodeParcelTile, decompressTile } from './parcel-tile';
import { encodeTile } from './test-tiles';

const tile = { z: 16, x: 16576, y: 24690 };
const box: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe('toParcelRecord', () => {
  it('keeps the four allowed fields and nothing else', () => {
    const r = toParcelRecord({ pid: 'X1', owner: ' OWNER X ', acres: 3.25, county: 'il-test', mailing: 'A ROAD', phone: '555-0100' }, 'il-archive');
    expect(Object.keys(r)).toEqual([...PARCEL_RECORD_FIELDS]);
    expect(r).toEqual({ pid: 'X1', owner: 'OWNER X', acres: 3.25, county: 'il-test' });
  });

  it('turns numbers into text and text into numbers where the field needs it', () => {
    expect(toParcelRecord({ pid: 1234, owner: 5, acres: '12.5' }, 'il-a')).toEqual({ pid: '1234', owner: '5', acres: 12.5, county: 'il-a' });
    expect(toParcelRecord({ acres: 'n/a' }, 'il-a')).toEqual({ pid: '', owner: '', acres: null, county: 'il-a' });
  });
});

describe('decodeParcelTile', () => {
  it('reads polygons from the parcels layer, skips everything else, and drops extra fields', () => {
    const bytes = encodeTile([
      {
        name: 'parcels',
        features: [
          { properties: { pid: 'A', owner: 'OWNER A', acres: 1.5, county: 'il-test', mail_addr: 'A ROAD' }, rings: [box] },
          { properties: { pid: 'LINE' }, rings: [box], type: 2 },
          { properties: { owner: 'NO ID' }, rings: [box] },
        ],
      },
      { name: 'other', features: [{ properties: { pid: 'OTHER' }, rings: [box] }] },
    ]);
    const d = decodeParcelTile(bytes, tile, 'il-test');
    expect(d.extent).toBe(4096);
    expect(d.parcels.map((p) => p.record.pid)).toEqual(['A', '']);
    const a = d.parcels[0]!;
    expect(Object.keys(a.record)).toEqual([...PARCEL_RECORD_FIELDS]);
    expect(a.rings).toEqual([[0, 0, 100, 0, 100, 100, 0, 100]]);
    expect(a.bbox).toEqual([0, 0, 100, 100]);
    expect(a.key).toBe('il-test|A');
    // A parcel without an ID never shares a key with another.
    expect(d.parcels[1]!.key).not.toBe('il-test|');
  });

  it('returns no parcels from a tile without the parcels layer', () => {
    expect(decodeParcelTile(encodeTile([{ name: 'other', features: [] }]), tile, 'il-test').parcels).toEqual([]);
  });
});

describe('decompressTile', () => {
  it('passes plain bytes through and ungzips gzipped ones', async () => {
    const plain = new Uint8Array([1, 2, 3, 4]);
    expect(await decompressTile(plain)).toBe(plain);
    const gz = new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect([...(await decompressTile(gz.buffer))]).toEqual([1, 2, 3, 4]);
  });
});

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { Compression, PMTiles, TileType, bytesToHeader } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import { HEADER_BYTES, readHeader, writeHeader, type Header } from './archive-header';
import { parseDirectory, serializeDirectory, type Entry } from './directory';
import { MAX_ROOT_BYTES, layoutDirectories } from './directory-layout';
import { compressInternal, decompressInternal } from './internal-compression';
import { memorySource, writeTestArchive } from './test-archive';
import { readVarint, writeVarint } from './varint';

describe('varints', () => {
  it('round-trip small and very large values', () => {
    const values = [0, 1, 127, 128, 300, 16383, 16384, 2 ** 31, 2 ** 32 + 5, 2 ** 40, Number.MAX_SAFE_INTEGER];
    const out: number[] = [];
    for (const v of values) writeVarint(out, v);
    const p = { buf: Uint8Array.from(out), pos: 0 };
    expect(values.map(() => readVarint(p))).toEqual(values);
    expect(p.pos).toBe(out.length);
  });

  it('writes the spec bytes', () => {
    const out: number[] = [];
    writeVarint(out, 300);
    expect(out).toEqual([0xac, 0x02]);
  });

  it('refuses negative and fractional values', () => {
    expect(() => writeVarint([], -1)).toThrow();
    expect(() => writeVarint([], 1.5)).toThrow();
  });
});

describe('directories', () => {
  const entries: Entry[] = [
    { tileId: 0, offset: 0, length: 10, runLength: 1 },
    { tileId: 1, offset: 10, length: 5, runLength: 3 },
    { tileId: 9, offset: 0, length: 10, runLength: 1 },
    { tileId: 10, offset: 10, length: 5, runLength: 1 },
    { tileId: 2 ** 40, offset: 2 ** 33, length: 70000, runLength: 0 },
  ];

  it('round-trip', () => {
    expect(parseDirectory(serializeDirectory(entries))).toEqual(entries);
  });

  it('store a contiguous offset as 0 and any other as offset + 1', () => {
    const bytes = serializeDirectory(entries.slice(0, 3));
    // count, 3 ID deltas, 3 run lengths, 3 lengths, then the offsets.
    expect(Array.from(bytes.slice(10))).toEqual([1, 0, 1]);
  });

  it('refuse entries out of order', () => {
    expect(() => serializeDirectory([entries[1]!, entries[0]!])).toThrow();
  });

  it('gzip and back', async () => {
    const raw = serializeDirectory(entries);
    const gz = await compressInternal(raw, Compression.Gzip);
    expect(gz[0]).toBe(0x1f);
    expect(gz[1]).toBe(0x8b);
    expect(await decompressInternal(gz, Compression.Gzip)).toEqual(raw);
    expect(await compressInternal(raw, Compression.None)).toBe(raw);
    await expect(compressInternal(raw, Compression.Brotli)).rejects.toThrow();
  });
});

describe('header', () => {
  const h: Header = {
    specVersion: 3,
    rootDirectoryOffset: 127,
    rootDirectoryLength: 1000,
    jsonMetadataOffset: 1127,
    jsonMetadataLength: 50,
    leafDirectoryOffset: 1177,
    leafDirectoryLength: 3,
    tileDataOffset: 1180,
    tileDataLength: 2 ** 33 + 7,
    numAddressedTiles: 123456,
    numTileEntries: 100000,
    numTileContents: 99999,
    clustered: true,
    internalCompression: Compression.Gzip,
    tileCompression: Compression.Gzip,
    tileType: TileType.Mvt,
    minZoom: 0,
    maxZoom: 15,
    minLon: -89.2178739,
    minLat: 39.652678,
    maxLon: -88.745057,
    maxLat: 40.0553439,
    centerZoom: 7,
    centerLon: -88.9814655,
    centerLat: 39.854011,
  };

  it('is written so the pmtiles library reads every field back', () => {
    const bytes = writeHeader(h);
    expect(bytes.length).toBe(HEADER_BYTES);
    expect(new TextDecoder().decode(bytes.slice(0, 7))).toBe('PMTiles');
    expect({ ...bytesToHeader(bytes.buffer as ArrayBuffer), etag: undefined }).toEqual({ ...h, etag: undefined });
    expect(readHeader(bytes).tileDataLength).toBe(2 ** 33 + 7);
  });

  it('refuses a file that is not PMTiles v3', () => {
    const bytes = writeHeader(h);
    bytes[7] = 2;
    expect(() => readHeader(bytes)).toThrow();
    bytes[0] = 0;
    expect(() => readHeader(bytes)).toThrow();
  });
});

describe('layoutDirectories', () => {
  /** Many entries with irregular lengths and gaps, so the root compresses badly. */
  function manyEntries(n: number): Entry[] {
    let s = 1;
    const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const out: Entry[] = [];
    let id = 0;
    let offset = 0;
    for (let i = 0; i < n; i++) {
      id += 1 + Math.floor(rand() * 200);
      const length = 1 + Math.floor(rand() * 60000);
      out.push({ tileId: id, offset, length, runLength: 1 + Math.floor(rand() * 2) });
      offset += length;
    }
    return out;
  }

  it('keeps a small directory in the root', async () => {
    const entries = manyEntries(100);
    const d = await layoutDirectories(entries, Compression.Gzip);
    expect(d.leafCount).toBe(0);
    expect(d.leaves.length).toBe(0);
    expect(parseDirectory(await decompressInternal(d.root, Compression.Gzip))).toEqual(entries);
  });

  it('splits a large directory into leaves so the root fits beside the header', async () => {
    const entries = manyEntries(30000);
    expect((await compressInternal(serializeDirectory(entries), Compression.Gzip)).length).toBeGreaterThan(MAX_ROOT_BYTES);
    const d = await layoutDirectories(entries, Compression.Gzip);
    expect(d.leafCount).toBeGreaterThan(1);
    expect(d.root.length).toBeLessThanOrEqual(MAX_ROOT_BYTES);
    const root = parseDirectory(await decompressInternal(d.root, Compression.Gzip));
    expect(root.every((e) => e.runLength === 0)).toBe(true);
    const back: Entry[] = [];
    for (const r of root) back.push(...parseDirectory(await decompressInternal(d.leaves.subarray(r.offset, r.offset + r.length), Compression.Gzip)));
    expect(back).toEqual(entries);
  });
});

describe('test archive writer', () => {
  it('writes an archive the pmtiles library reads, with leaves and without', async () => {
    const tiles = [];
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) tiles.push({ z: 3, x, y, data: Uint8Array.of(3, x, y) });
    tiles.push({ z: 0, x: 0, y: 0, data: Uint8Array.of(9) });
    for (const leafSize of [undefined, 5]) {
      const bytes = await writeTestArchive(tiles, leafSize ? { leafSize } : {});
      const pm = new PMTiles(memorySource(bytes));
      const h = await pm.getHeader();
      expect(h.numAddressedTiles).toBe(65);
      expect(h.leafDirectoryLength! > 0).toBe(!!leafSize);
      for (const t of tiles) expect(new Uint8Array((await pm.getZxy(t.z, t.x, t.y))!.data)).toEqual(t.data);
      expect(await pm.getZxy(1, 0, 0)).toBeUndefined();
    }
  });
});

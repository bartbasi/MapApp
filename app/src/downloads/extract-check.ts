// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test helper: checks an assembled extract against the archive it was cut
// from. Every wanted tile must match the source byte for byte, no other tile
// may be addressed, and the header counts must be right.

import { PMTiles, tileIdToZxy, type Source } from 'pmtiles';
import { expect } from 'vitest';
import { HEADER_BYTES, HEAD_READ_BYTES, readHeader } from './archive-header';
import type { ExtractPlan } from './download-plan';
import type { ExtractRequest } from './extract-planner';
import { allTileEntries } from './test-archive';
import { rectHas, tileRect } from './tile-cover';

export interface ExtractCheckResult {
  /** Tiles inside the area and zoom range, whether or not the source has them. */
  wantedTiles: number;
  /** Of those, the tiles the source has (and the extract must have). */
  presentTiles: number;
}

function same(a: ArrayBuffer | undefined, b: ArrayBuffer | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

export async function checkExtract(source: Source, extract: Source, plan: ExtractPlan, request: ExtractRequest): Promise<ExtractCheckResult> {
  const { header, entries } = await allTileEntries(extract);
  expect(header.rootDirectoryOffset + header.rootDirectoryLength).toBeLessThanOrEqual(HEAD_READ_BYTES);
  expect(header.tileDataOffset).toBe(plan.head.length);
  expect(header.tileDataLength).toBe(plan.tileDataBytes);
  expect(header.numAddressedTiles).toBe(plan.addressedTiles);
  expect(header.numTileEntries).toBe(plan.tileEntries);
  expect(header.numTileContents).toBe(plan.tileContents);
  expect(header.minZoom).toBe(plan.minzoom);
  expect(header.maxZoom).toBe(plan.maxzoom);
  expect(header.clustered).toBe(plan.clustered);

  // The metadata is the source's, byte for byte.
  const bytesAt = async (s: Source, offset: number, length: number) => new Uint8Array((await s.getBytes(offset, length)).data, 0, length);
  const sourceHeader = readHeader(await bytesAt(source, 0, HEADER_BYTES));
  expect(await bytesAt(extract, header.jsonMetadataOffset, header.jsonMetadataLength)).toEqual(
    await bytesAt(source, sourceHeader.jsonMetadataOffset, sourceHeader.jsonMetadataLength),
  );
  expect(header.tileType).toBe(sourceHeader.tileType);
  expect(header.tileCompression).toBe(sourceHeader.tileCompression);
  expect(header.internalCompression).toBe(sourceHeader.internalCompression);

  // The directories address only wanted tiles, and their counts agree with the header.
  let addressed = 0;
  const offsets = new Set<number>();
  for (const e of entries) {
    addressed += e.runLength;
    offsets.add(e.offset);
    expect(e.offset + e.length).toBeLessThanOrEqual(plan.tileDataBytes);
    for (const id of [e.tileId, e.tileId + e.runLength - 1]) {
      const [z, x, y] = tileIdToZxy(id);
      expect(z).toBeGreaterThanOrEqual(plan.minzoom);
      expect(z).toBeLessThanOrEqual(plan.maxzoom);
      if (!rectHas(tileRect(request.bounds, z), x, y)) throw new Error(`tile ${z}/${x}/${y} is addressed but outside the area`);
    }
  }
  expect(addressed).toBe(plan.addressedTiles);
  expect(entries.length).toBe(plan.tileEntries);
  expect(offsets.size).toBe(plan.tileContents);

  // Every tile of the area: present in both with the same stored bytes, or in
  // neither. Tiles are read raw (the library's tile decompression is replaced
  // by a pass-through); directories are still read by the library itself.
  // Together with the count above, this proves no tile outside the area is
  // addressed.
  const raw = async (buf: ArrayBuffer) => buf;
  const src = new PMTiles(source, undefined, raw);
  const out = new PMTiles(extract, undefined, raw);
  let wantedTiles = 0;
  let presentTiles = 0;
  for (let z = plan.minzoom; z <= plan.maxzoom; z++) {
    const r = tileRect(request.bounds, z);
    for (let x = r.minX; x <= r.maxX; x++) {
      for (let y = r.minY; y <= r.maxY; y++) {
        wantedTiles++;
        const a = (await src.getZxy(z, x, y))?.data;
        const b = (await out.getZxy(z, x, y))?.data;
        if (!same(a, b)) throw new Error(`tile ${z}/${x}/${y} differs: source ${a?.byteLength ?? 'none'} bytes, extract ${b?.byteLength ?? 'none'} bytes`);
        if (a) presentTiles++;
      }
    }
  }
  expect(presentTiles).toBe(plan.addressedTiles);
  return { wantedTiles, presentTiles };
}

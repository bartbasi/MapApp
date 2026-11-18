// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

import { Compression, PMTiles } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import type { Bounds } from '../map/tile-math';
import { HEAD_READ_BYTES, readHeader } from './archive-header';
import { assemble } from './assemble';
import { planWholeArchive, rangeReport, type ExtractPlan } from './download-plan';
import { checkExtract } from './extract-check';
import { planExtract, type ExtractOptions, type ExtractRequest } from './extract-planner';
import { allTileEntries, memorySource, writeTestArchive, type TestArchiveOptions, type TestTile } from './test-archive';
import { pmtilesTool, verifyBytes } from './test-node';
import { rectTileCount, tileRect } from './tile-cover';

/** Every tile of zooms `minzoom` to `maxzoom` inside `bounds`, with contents from `content`. */
function grid(bounds: Bounds, minzoom: number, maxzoom: number, content: (z: number, x: number, y: number) => Uint8Array): TestTile[] {
  const tiles: TestTile[] = [];
  for (let z = minzoom; z <= maxzoom; z++) {
    const r = tileRect(bounds, z);
    for (let x = r.minX; x <= r.maxX; x++) for (let y = r.minY; y <= r.maxY; y++) tiles.push({ z, x, y, data: content(z, x, y) });
  }
  return tiles;
}

/** A content unique to each tile, of varying length. */
const unique = (z: number, x: number, y: number) => {
  const b = new Uint8Array(4 + ((x * 7 + y * 13 + z) % 23));
  b.set([z, x & 255, y & 255, (x >> 8) * 16 + (y >> 8)]);
  return b;
};

/** Text that compresses badly. */
function noise(n: number): string {
  let s = 12345;
  let out = '';
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out += (s >>> 26).toString(36);
  }
  return out;
}

const WORLD: Bounds = [-180, -85, 180, 85];

interface Extracted {
  plan: ExtractPlan;
  extract: Uint8Array;
  source: ReturnType<typeof memorySource>;
}

async function extractAndCheck(
  tiles: TestTile[],
  request: ExtractRequest,
  archive: TestArchiveOptions = {},
  options: ExtractOptions = {},
): Promise<Extracted & { wantedTiles: number; planReads: { offset: number; length: number }[] }> {
  const bytes = await writeTestArchive(tiles, archive);
  const source = memorySource(bytes, 'source');
  const plan = await planExtract(source, request, options);
  const planReads = [...source.reads];
  expect(plan.sourceReads).toBe(planReads.length);
  const extract = await assemble(plan, source);
  expect(extract.length).toBe(plan.bytes);
  expect(plan.bytes).toBe(plan.head.length + plan.ranges.reduce((n, r) => n + r.length, 0));
  const result = await checkExtract(memorySource(bytes, 'check-source'), memorySource(extract, 'extract'), plan, request);
  return { plan, extract, source, planReads, wantedTiles: result.wantedTiles };
}

describe('planExtract', () => {
  it('keeps exactly the tiles of the area, from one read of the head', async () => {
    const tiles = [...grid(WORLD, 0, 3, unique), ...grid([-30, -30, 60, 40], 4, 6, unique)];
    const request: ExtractRequest = { bounds: [5, 5, 25, 20] };
    const { plan, planReads } = await extractAndCheck(tiles, request);
    expect(plan.minzoom).toBe(0);
    expect(plan.maxzoom).toBe(6);
    let expected = 0;
    for (let z = 0; z <= 6; z++) expected += rectTileCount(tileRect(request.bounds, z));
    expect(plan.addressedTiles).toBe(expected);
    expect(plan.tileContents).toBe(expected);
    expect(planReads).toEqual([{ offset: 0, length: HEAD_READ_BYTES }]);
    expect(plan.bounds).toEqual([5, 5, 25, 20]);
    expect(plan.clustered).toBe(true);
    const h = readHeader(plan.head);
    expect(h.centerLon).toBeCloseTo(15, 5);
    expect(h.centerLat).toBeCloseTo(12.5, 5);
  });

  it('splits a run that is only partly inside the area, and keeps one copy of its content', async () => {
    // Zoom 6 is one long run of the same content, with a few distinct tiles.
    const blank = new Uint8Array(50).fill(7);
    const tiles = [...grid(WORLD, 0, 5, unique), ...grid(WORLD, 6, 6, (z, x, y) => (x === 33 && y === 30 ? unique(z, x, y) : blank))];
    const source = await allTileEntries(memorySource(await writeTestArchive(tiles)));
    expect(source.entries.filter((e) => e.runLength > 100).length).toBeGreaterThan(0);

    const request: ExtractRequest = { bounds: [1, 1, 30, 25] };
    const { plan, extract } = await extractAndCheck(tiles, request);
    const z6 = rectTileCount(tileRect(request.bounds, 6));
    const { entries } = await allTileEntries(memorySource(extract));
    const blankEntries = entries.filter((e) => e.length === blank.length);
    // The area cuts the run into several pieces, each kept as a run.
    expect(blankEntries.length).toBeGreaterThan(1);
    expect(blankEntries.some((e) => e.runLength > 1)).toBe(true);
    expect(blankEntries.reduce((n, e) => n + e.runLength, 0)).toBe(z6 - 1);
    expect(new Set(blankEntries.map((e) => e.offset)).size).toBe(1);
  });

  it('stores a content shared by scattered tiles once', async () => {
    const shades = [Uint8Array.of(10, 10, 10), Uint8Array.of(20, 20, 20, 20), Uint8Array.of(30)];
    const tiles = grid(WORLD, 0, 6, (z, x, y) => (z < 6 ? unique(z, x, y) : shades[(x + 2 * y) % 3]!));
    const request: ExtractRequest = { bounds: [-40, -20, 10, 35] };
    const { plan } = await extractAndCheck(tiles, request);
    let lowTiles = 0;
    let lowBytes = 0;
    for (let z = 0; z < 6; z++) {
      const r = tileRect(request.bounds, z);
      for (let x = r.minX; x <= r.maxX; x++) for (let y = r.minY; y <= r.maxY; y++) {
        lowTiles++;
        lowBytes += unique(z, x, y).length;
      }
    }
    expect(plan.tileContents).toBe(lowTiles + 3);
    expect(plan.tileDataBytes).toBe(lowBytes + 3 + 4 + 1);
  });

  it('splits the new root into leaves when it would not fit beside the header', async () => {
    // About 30,000 tiles with irregular lengths: too many entries for a 16 KB root.
    const tiles = grid([-120, -70, 120, 75], 0, 8, (z, x, y) => {
      const n = 1 + ((x * 2654435761 + y * 40503 + z) >>> 0) % 997;
      return new Uint8Array(n).fill((x + y) & 255).map((v, i) => (i < 3 ? [z, x, y][i]! & 255 : v));
    });
    expect(tiles.length).toBeGreaterThan(20000);
    const request: ExtractRequest = { bounds: [-110, -60, 110, 70] };
    const { plan, extract, planReads } = await extractAndCheck(tiles, request);
    expect(plan.leafDirectories).toBeGreaterThan(1);
    const h = readHeader(extract);
    expect(h.rootDirectoryOffset + h.rootDirectoryLength).toBeLessThanOrEqual(HEAD_READ_BYTES);
    expect(h.leafDirectoryLength).toBeGreaterThan(0);
    // The source has leaves too, so the planner read some of them.
    expect(planReads.length).toBeGreaterThan(1);
  }, 30000);

  it('reads only the leaves the area needs, and joins adjacent leaf reads', async () => {
    const tiles = [...grid(WORLD, 0, 3, unique), ...grid([-90, -60, 90, 60], 4, 7, unique)];
    // Large metadata pushes the leaves past the first 16 KB, so they need reads of their own.
    const archive = { leafSize: 20, metadata: { note: noise(30000) } };
    const all = await allTileEntries(memorySource(await writeTestArchive(tiles, archive)));
    const request: ExtractRequest = { bounds: [10, 10, 20, 20] };
    const apart = await extractAndCheck(tiles, request, archive);
    expect(all.leafDirectories).toBeGreaterThan(50);
    expect(apart.plan.sourceReads).toBeLessThan(all.leafDirectories / 4);
    const joined = await extractAndCheck(tiles, request, archive, { leafReadGap: 1 << 20 });
    expect(joined.plan.sourceReads).toBeLessThan(apart.plan.sourceReads);
    expect(joined.extract).toEqual(apart.extract);
  });

  it('gives an empty but valid archive for an area that touches no tile', async () => {
    const tiles = grid([10, 10, 30, 30], 5, 7, unique);
    const request: ExtractRequest = { bounds: [-100, -40, -90, -30] };
    const { plan, extract } = await extractAndCheck(tiles, request, { bounds: [10, 10, 30, 30] });
    expect(plan.addressedTiles).toBe(0);
    expect(plan.tileContents).toBe(0);
    expect(plan.ranges).toEqual([]);
    expect(plan.bytes).toBe(plan.head.length);
    expect(plan.bounds).toEqual(request.bounds);
    const pm = new PMTiles(memorySource(extract));
    expect((await pm.getHeader()).numAddressedTiles).toBe(0);
    expect(await pm.getZxy(5, 16, 15)).toBeUndefined();
  });

  it('takes the whole archive, as one range, for an area larger than it', async () => {
    const tiles = [...grid(WORLD, 0, 2, unique), ...grid([0, 0, 40, 40], 3, 7, unique)];
    const archiveBounds: Bounds = [0, 0, 40, 40];
    const bytes = await writeTestArchive(tiles, { bounds: archiveBounds });
    const sourceHeader = readHeader(bytes);
    const { plan } = await extractAndCheck(tiles, { bounds: [-170, -80, 170, 80] }, { bounds: archiveBounds });
    expect(plan.addressedTiles).toBe(tiles.length);
    expect(plan.ranges).toEqual([{ offset: sourceHeader.tileDataOffset, length: sourceHeader.tileDataLength }]);
    expect(plan.bytes).toBe(bytes.length);
    expect(plan.bounds).toEqual(archiveBounds);
  });

  it('stops at a chosen detail below the archive maximum', async () => {
    const tiles = grid([-20, -20, 20, 20], 2, 7, unique);
    const request: ExtractRequest = { bounds: [-10, -10, 10, 10], maxzoom: 5 };
    const { plan, extract } = await extractAndCheck(tiles, request);
    expect(plan.minzoom).toBe(2);
    expect(plan.maxzoom).toBe(5);
    const pm = new PMTiles(memorySource(extract));
    expect((await pm.getHeader()).maxZoom).toBe(5);
    const { entries } = await allTileEntries(memorySource(extract));
    let expected = 0;
    for (let z = 2; z <= 5; z++) expected += rectTileCount(tileRect(request.bounds, z));
    expect(entries.reduce((n, e) => n + e.runLength, 0)).toBe(expected);
    // A detail above the archive's own is the archive's own.
    const more = await extractAndCheck(tiles, { bounds: request.bounds, maxzoom: 12 });
    expect(more.plan.maxzoom).toBe(7);
  });

  it('refuses a detail below the lowest zoom and an impossible area', async () => {
    const source = memorySource(await writeTestArchive(grid(WORLD, 2, 3, unique)));
    await expect(planExtract(source, { bounds: [0, 0, 1, 1], maxzoom: 1 })).rejects.toThrow(RangeError);
    await expect(planExtract(source, { bounds: [0, 0, 1, 1], maxzoom: 2.5 })).rejects.toThrow(RangeError);
    await expect(planExtract(source, { bounds: [10, 0, 5, 1] })).rejects.toThrow(RangeError);
    await expect(planExtract(source, { bounds: [0, 0, Number.NaN, 1] })).rejects.toThrow(RangeError);
  });

  it('handles a source whose tile data is not in tile ID order', async () => {
    const tiles = grid(WORLD, 0, 5, unique);
    const { plan } = await extractAndCheck(tiles, { bounds: [-30, -30, 30, 30] }, { contentOrder: 'reverse' });
    expect(plan.clustered).toBe(false);
    expect(plan.ranges.length).toBeGreaterThan(1);
  });

  it('keeps an uncompressed source uncompressed', async () => {
    const tiles = grid(WORLD, 0, 4, unique);
    const { extract } = await extractAndCheck(tiles, { bounds: [0, 0, 90, 60] }, { internalCompression: Compression.None, leafSize: 7 });
    expect(readHeader(extract).internalCompression).toBe(Compression.None);
  });
});

/** Runs `pmtiles verify` on an extract when the tool is on this machine. */
function verifyIfTool(bytes: Uint8Array): void {
  if (!pmtilesTool) return;
  const r = verifyBytes(bytes);
  expect(r.status, r.out).toBe(0);
}

describe('planExtract on a sparse layer', () => {
  // Zooms 2 to 5 over a wide area, zoom 6 only in a smaller one: like public
  // land, where the top zoom has tiles only near the land itself.
  const wide: Bounds = [-40, -40, 40, 40];
  const dense: Bounds = [10, 10, 30, 30];
  const sparse = () => [...grid(wide, 2, 5, unique), ...grid(dense, 6, 6, unique)];

  it('ends the header at the highest zoom that has a tile in the area', async () => {
    const request: ExtractRequest = { bounds: [-30, -30, -20, -20] };
    const { plan, extract } = await extractAndCheck(sparse(), request, { centerZoom: 6 });
    expect([plan.minzoom, plan.maxzoom]).toEqual([2, 5]);
    const h = readHeader(extract);
    expect([h.minZoom, h.maxZoom]).toEqual([2, 5]);
    expect(h.centerZoom).toBe(5);
    verifyIfTool(extract);

    const inside = await extractAndCheck(sparse(), { bounds: [15, 15, 20, 20] });
    expect([inside.plan.minzoom, inside.plan.maxzoom]).toEqual([2, 6]);
    verifyIfTool(inside.extract);
  });

  it('starts the header at the lowest zoom that has a tile in the area', async () => {
    const tiles = grid(wide, 3, 5, unique);
    const { plan, extract } = await extractAndCheck(tiles, { bounds: [0, 0, 10, 10] }, { minzoom: 2, centerZoom: 2 });
    expect([plan.minzoom, plan.maxzoom]).toEqual([3, 5]);
    expect(readHeader(extract).centerZoom).toBe(3);
    verifyIfTool(extract);
  });

  it('keeps the asked range when no tile is kept', async () => {
    const { plan } = await extractAndCheck(sparse(), { bounds: [100, 50, 110, 60] });
    expect(plan.addressedTiles).toBe(0);
    expect([plan.minzoom, plan.maxzoom]).toEqual([2, 6]);
  });

  it('cuts a run that crosses from one zoom into the next', async () => {
    // Zooms 0 to 2 all share one content, so the source holds one run of 21 tiles.
    const same = Uint8Array.of(5, 5, 5);
    const tiles = grid(WORLD, 0, 2, () => same);
    const src = await allTileEntries(memorySource(await writeTestArchive(tiles)));
    expect(src.entries).toEqual([{ tileId: 0, offset: 0, length: 3, runLength: 21 }]);
    const { plan, extract } = await extractAndCheck(tiles, { bounds: [-170, -80, 170, 80] });
    const { entries } = await allTileEntries(memorySource(extract));
    expect(entries.map((e) => [e.tileId, e.runLength])).toEqual([
      [0, 1],
      [1, 4],
      [5, 16],
    ]);
    expect(plan.tileContents).toBe(1);
    expect([plan.minzoom, plan.maxzoom]).toEqual([0, 2]);
    verifyIfTool(extract);
  });

  it('gives a point request a header area above zero', async () => {
    const { plan, extract } = await extractAndCheck(sparse(), { bounds: [20, 20, 20, 20] });
    expect(plan.bounds[0]).toBeLessThan(plan.bounds[2]);
    expect(plan.bounds[1]).toBeLessThan(plan.bounds[3]);
    expect(plan.maxzoom).toBe(6);
    verifyIfTool(extract);
  });
});

describe('planWholeArchive', () => {
  it('is one range covering the file, with nothing written first', async () => {
    const bytes = await writeTestArchive(grid(WORLD, 0, 3, unique));
    const plan = planWholeArchive(bytes.length, '"v1"');
    expect(plan).toEqual({ head: new Uint8Array(0), ranges: [{ offset: 0, length: bytes.length }], bytes: bytes.length, etag: '"v1"' });
    const copy = await assemble({ ...plan, etag: undefined } as typeof plan, memorySource(bytes));
    expect(copy).toEqual(bytes);
    expect(planWholeArchive(0).ranges).toEqual([]);
    expect(() => planWholeArchive(-1)).toThrow();
  });
});

describe('rangeReport', () => {
  it('counts requests and the cost of merging nearby ranges', () => {
    const plan = {
      head: new Uint8Array(10),
      ranges: [
        { offset: 100, length: 50 },
        { offset: 160, length: 10 },
        { offset: 1000, length: 5 },
      ],
      bytes: 75,
    };
    const r = rangeReport(plan, [0, 10, 1000]);
    expect(r.requests).toBe(3);
    expect(r.rangeBytes).toBe(65);
    expect(r.smallestRange).toBe(5);
    expect(r.medianRange).toBe(10);
    expect(r.largestRange).toBe(50);
    expect(r.tradeoff).toEqual([
      { gap: 0, requests: 3, extraBytes: 0 },
      { gap: 10, requests: 2, extraBytes: 10 },
      { gap: 1000, requests: 1, extraBytes: 840 },
    ]);
  });
});

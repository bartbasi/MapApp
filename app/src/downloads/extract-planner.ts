// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Plans the download of one area of a hosted PMTiles archive.
//
// The planner reads only the header and the directories of the hosted file
// and works out the whole new archive except its tile data:
//
//   [header 127 bytes][root directory][metadata][leaf directories][tile data]
//
// Everything before the tile data is the plan's `head`. The tile data is the
// plan's byte ranges of the hosted file, appended in order. Every new tile
// offset follows from the plan alone, which is why the directories can be
// written before any tile is fetched.

import { Compression, type Source } from 'pmtiles';
import type { Bounds } from '../map/tile-math';
import { HEADER_BYTES, HEAD_READ_BYTES, readHeader, writeHeader, type Header } from './archive-header';
import { parseDirectory, type Entry } from './directory';
import { layoutDirectories } from './directory-layout';
import type { ByteRange, ExtractPlan } from './download-plan';
import { decompressInternal, supportedInternalCompression } from './internal-compression';
import { wantedTileIds, type TileIdSet } from './tile-cover';

export interface ExtractRequest {
  /** West, south, east, north in degrees. */
  bounds: Bounds;
  /** The highest zoom to keep (the detail choice). Defaults to the archive's own. */
  maxzoom?: number;
}

export interface ExtractOptions {
  /** Read leaf directories separated by at most this many bytes in one read. Default 0. */
  leafReadGap?: number;
  /** Force leaf directories of this many entries in the new archive. For tests. */
  leafSize?: number;
}

/** A run of wanted tiles: tile IDs [tileId, tileId + runLength), all with the same content. */
interface Piece {
  tileId: number;
  runLength: number;
  /** Offset of the content in the hosted file's tile data section. */
  offset: number;
  length: number;
}

interface PendingLeaf {
  /** Absolute offset in the hosted file. */
  offset: number;
  length: number;
  /** The leaf holds tile IDs below this. */
  end: number;
}

/** Reads the hosted file, counting reads and holding the first block. */
class HostedFile {
  reads = 0;
  etag: string | undefined;
  private first = new Uint8Array(0);

  constructor(private readonly source: Source) {}

  /** Reads the first 16,384 bytes, or the whole file if it is shorter. */
  async readFirst(): Promise<Uint8Array> {
    const r = await this.source.getBytes(0, HEAD_READ_BYTES);
    this.reads++;
    this.etag = r.etag;
    this.first = new Uint8Array(r.data);
    return this.first;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset + length <= this.first.length) return this.first.subarray(offset, offset + length);
    const r = await this.source.getBytes(offset, length, undefined, this.etag);
    this.reads++;
    const bytes = new Uint8Array(r.data);
    if (bytes.length < length) throw new Error(`short read at ${offset}: ${bytes.length} of ${length} bytes`);
    return bytes.length > length ? bytes.subarray(0, length) : bytes;
  }
}

function checkRequest(request: ExtractRequest, header: Header): { minzoom: number; maxzoom: number } {
  const [w, s, e, n] = request.bounds;
  if (![w, s, e, n].every(Number.isFinite) || w > e || s > n || w < -180 || e > 180 || s < -90 || n > 90) {
    throw new RangeError(`bad area ${JSON.stringify(request.bounds)}`);
  }
  const minzoom = header.minZoom;
  let maxzoom = header.maxZoom;
  if (request.maxzoom !== undefined) {
    if (!Number.isInteger(request.maxzoom) || request.maxzoom < minzoom) {
      throw new RangeError(`detail level ${request.maxzoom} is below the archive's lowest zoom ${minzoom}`);
    }
    maxzoom = Math.min(maxzoom, request.maxzoom);
  }
  return { minzoom, maxzoom };
}

/** Adds the wanted parts of a directory's entries to `pieces`, and the leaves to read to `pending`. */
function visitDirectory(
  entries: readonly Entry[],
  end: number,
  wanted: TileIdSet,
  leafBase: number,
  pieces: Piece[],
  pending: PendingLeaf[],
): void {
  entries.forEach((e, i) => {
    if (e.runLength > 0) {
      for (const [s, t] of wanted.clip(e.tileId, e.tileId + e.runLength)) {
        pieces.push({ tileId: s, runLength: t - s, offset: e.offset, length: e.length });
      }
    } else {
      const hi = Math.min(end, entries[i + 1]?.tileId ?? end);
      if (wanted.overlaps(e.tileId, hi)) pending.push({ offset: leafBase + e.offset, length: e.length, end: hi });
    }
  });
}

/** Groups leaves into reads: sorted by offset, joined when the gap between them is small. */
function groupReads(pending: PendingLeaf[], gap: number): PendingLeaf[][] {
  const sorted = [...pending].sort((a, b) => a.offset - b.offset);
  const groups: PendingLeaf[][] = [];
  let groupEnd = -Infinity;
  for (const leaf of sorted) {
    const last = groups[groups.length - 1];
    if (last && leaf.offset - groupEnd <= gap) {
      last.push(leaf);
      groupEnd = Math.max(groupEnd, leaf.offset + leaf.length);
    } else {
      groups.push([leaf]);
      groupEnd = leaf.offset + leaf.length;
    }
  }
  return groups;
}

/** Walks the root and every leaf that can hold a wanted tile. Returns the wanted runs in tile ID order. */
async function collectPieces(
  file: HostedFile,
  header: Header,
  root: readonly Entry[],
  wanted: TileIdSet,
  leafReadGap: number,
): Promise<Piece[]> {
  const pieces: Piece[] = [];
  let pending: PendingLeaf[] = [];
  visitDirectory(root, Infinity, wanted, header.leafDirectoryOffset, pieces, pending);
  for (let depth = 0; pending.length > 0; depth++) {
    if (depth > 8) throw new Error('leaf directories nest too deep');
    const next: PendingLeaf[] = [];
    await Promise.all(
      groupReads(pending, leafReadGap).map(async (group) => {
        const start = group[0]!.offset;
        const end = Math.max(...group.map((l) => l.offset + l.length));
        const bytes = await file.read(start, end - start);
        for (const leaf of group) {
          const raw = bytes.subarray(leaf.offset - start, leaf.offset - start + leaf.length);
          const entries = parseDirectory(await decompressInternal(raw, header.internalCompression));
          visitDirectory(entries, leaf.end, wanted, header.leafDirectoryOffset, pieces, next);
        }
      }),
    );
    pending = next;
  }

  pieces.sort((a, b) => a.tileId - b.tileId);
  const runs: Piece[] = [];
  for (const p of pieces) {
    const last = runs[runs.length - 1];
    if (last && p.tileId < last.tileId + last.runLength) throw new Error(`the archive's directories overlap at tile ID ${p.tileId}`);
    if (last && last.tileId + last.runLength === p.tileId && last.offset === p.offset && last.length === p.length) {
      last.runLength += p.runLength;
    } else {
      runs.push({ ...p });
    }
  }
  return runs;
}

/**
 * Lays the distinct contents out in the order of their source offsets, which
 * keeps ranges long: contents that touch in the hosted file become one range.
 * Returns the hosted file ranges and each content's new offset, keyed by
 * source offset and length.
 */
function layoutTileData(
  runs: readonly Piece[],
  sourceTileData: number,
): { ranges: ByteRange[]; newOffset: Map<string, number>; contents: number; dataBytes: number } {
  const key = (p: { offset: number; length: number }) => `${p.offset}/${p.length}`;
  const distinct = new Map<string, { offset: number; length: number }>();
  for (const r of runs) distinct.set(key(r), { offset: r.offset, length: r.length });
  const contents = [...distinct.values()].sort((a, b) => a.offset - b.offset || a.length - b.length);

  const ranges: ByteRange[] = [];
  const newOffset = new Map<string, number>();
  let dataBytes = 0;
  let cur: { srcStart: number; srcEnd: number; newStart: number } | null = null;
  const close = () => {
    if (cur && cur.srcEnd > cur.srcStart) {
      ranges.push({ offset: sourceTileData + cur.srcStart, length: cur.srcEnd - cur.srcStart });
      dataBytes += cur.srcEnd - cur.srcStart;
    }
  };
  for (const c of contents) {
    // A content that touches or overlaps the current range joins it.
    if (!cur || c.offset > cur.srcEnd) {
      close();
      cur = { srcStart: c.offset, srcEnd: c.offset, newStart: dataBytes };
    }
    newOffset.set(key(c), cur.newStart + (c.offset - cur.srcStart));
    cur.srcEnd = Math.max(cur.srcEnd, c.offset + c.length);
  }
  close();
  return { ranges, newOffset, contents: contents.length, dataBytes };
}

/** True if the entries' tile data is in tile ID order, each content after the last or a repeat of an earlier one. */
function isClustered(entries: readonly Entry[]): boolean {
  let next = 0;
  for (const e of entries) {
    if (e.offset === next) next += e.length;
    else if (e.offset > next) return false;
  }
  return true;
}

function clipBounds(a: Bounds, b: Bounds): Bounds | null {
  const out: Bounds = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return out[0] <= out[2] && out[1] <= out[3] ? out : null;
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Plans an archive holding every tile of the hosted archive, from its lowest
 * zoom to the chosen detail, that overlaps the area. Tiles are kept whole.
 */
export async function planExtract(source: Source, request: ExtractRequest, options: ExtractOptions = {}): Promise<ExtractPlan> {
  const file = new HostedFile(source);
  const first = await file.readFirst();
  const header = readHeader(first);
  if (!supportedInternalCompression(header.internalCompression)) {
    throw new Error(`the archive's directories use compression ${Compression[header.internalCompression]}, which cannot be rewritten here`);
  }
  const { minzoom, maxzoom } = checkRequest(request, header);

  const rootBytes = await file.read(header.rootDirectoryOffset, header.rootDirectoryLength);
  const root = parseDirectory(await decompressInternal(rootBytes, header.internalCompression));
  const wanted = wantedTileIds(request.bounds, minzoom, maxzoom);
  const runs = await collectPieces(file, header, root, wanted, options.leafReadGap ?? 0);

  const data = layoutTileData(runs, header.tileDataOffset);
  const entries: Entry[] = runs.map((r) => ({
    tileId: r.tileId,
    runLength: r.runLength,
    length: r.length,
    offset: data.newOffset.get(`${r.offset}/${r.length}`)!,
  }));

  const dirs = await layoutDirectories(entries, header.internalCompression, options.leafSize === undefined ? {} : { leafSize: options.leafSize });
  const metadata = await file.read(header.jsonMetadataOffset, header.jsonMetadataLength);

  const archiveBounds: Bounds = [header.minLon, header.minLat, header.maxLon, header.maxLat];
  const bounds = clipBounds(request.bounds, archiveBounds) ?? request.bounds;
  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + dirs.root.length;
  const leafOffset = metadataOffset + metadata.length;
  const tileDataOffset = leafOffset + dirs.leaves.length;
  const clustered = header.clustered && isClustered(entries);
  const addressedTiles = entries.reduce((n, e) => n + e.runLength, 0);

  const newHeader: Header = {
    specVersion: 3,
    rootDirectoryOffset: rootOffset,
    rootDirectoryLength: dirs.root.length,
    jsonMetadataOffset: metadataOffset,
    jsonMetadataLength: metadata.length,
    leafDirectoryOffset: leafOffset,
    leafDirectoryLength: dirs.leaves.length,
    tileDataOffset,
    tileDataLength: data.dataBytes,
    numAddressedTiles: addressedTiles,
    numTileEntries: entries.length,
    numTileContents: data.contents,
    clustered,
    internalCompression: header.internalCompression,
    tileCompression: header.tileCompression,
    tileType: header.tileType,
    minZoom: minzoom,
    maxZoom: maxzoom,
    minLon: bounds[0],
    minLat: bounds[1],
    maxLon: bounds[2],
    maxLat: bounds[3],
    centerZoom: Math.min(maxzoom, Math.max(minzoom, header.centerZoom)),
    centerLon: (bounds[0] + bounds[2]) / 2,
    centerLat: (bounds[1] + bounds[3]) / 2,
  };
  const head = join([writeHeader(newHeader), dirs.root, metadata, dirs.leaves]);

  const plan: ExtractPlan = {
    head,
    ranges: data.ranges,
    bytes: head.length + data.dataBytes,
    addressedTiles,
    tileEntries: entries.length,
    tileContents: data.contents,
    minzoom,
    maxzoom,
    bounds,
    tileDataBytes: data.dataBytes,
    leafDirectories: dirs.leafCount,
    clustered,
    sourceReads: file.reads,
  };
  if (file.etag !== undefined) plan.etag = file.etag;
  return plan;
}

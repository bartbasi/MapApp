// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test helpers: a small PMTiles writer built on the planner's own serializer,
// an in-memory byte source that counts reads, and a walker that lists every
// tile entry of an archive.

import { Compression, TileType, zxyToTileId, type Source } from 'pmtiles';
import type { Bounds } from '../map/tile-math';
import { HEADER_BYTES, HEAD_READ_BYTES, readHeader, writeHeader, type Header } from './archive-header';
import { parseDirectory, type Entry } from './directory';
import { layoutDirectories } from './directory-layout';
import type { ByteRange } from './download-plan';
import { compressInternal, decompressInternal } from './internal-compression';

export interface TestTile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

export interface TestArchiveOptions {
  minzoom?: number;
  maxzoom?: number;
  bounds?: Bounds;
  metadata?: unknown;
  internalCompression?: Compression;
  /** 'first-use' writes contents in tile ID order (clustered); 'reverse' writes them backwards. */
  contentOrder?: 'first-use' | 'reverse';
  /** Force leaf directories of this many entries. */
  leafSize?: number;
}

function contentKey(b: Uint8Array): string {
  return Array.from(b).join(',');
}

/** Writes a PMTiles archive holding `tiles`, sharing identical contents and merging them into runs. */
export async function writeTestArchive(tiles: readonly TestTile[], options: TestArchiveOptions = {}): Promise<Uint8Array> {
  const c = options.internalCompression ?? Compression.Gzip;
  const withIds = tiles.map((t) => ({ id: zxyToTileId(t.z, t.x, t.y), t })).sort((a, b) => a.id - b.id);
  const order: string[] = [];
  const data = new Map<string, Uint8Array>();
  for (const { t } of withIds) {
    const k = contentKey(t.data);
    if (!data.has(k)) {
      data.set(k, t.data);
      order.push(k);
    }
  }
  if (options.contentOrder === 'reverse') order.reverse();
  const offsets = new Map<string, number>();
  let dataBytes = 0;
  for (const k of order) {
    offsets.set(k, dataBytes);
    dataBytes += data.get(k)!.length;
  }
  const entries: Entry[] = [];
  for (const { id, t } of withIds) {
    const offset = offsets.get(contentKey(t.data))!;
    const last = entries[entries.length - 1];
    if (last && last.tileId + last.runLength === id && last.offset === offset) last.runLength++;
    else entries.push({ tileId: id, offset, length: t.data.length, runLength: 1 });
  }
  const dirs = await layoutDirectories(entries, c, options.leafSize === undefined ? {} : { leafSize: options.leafSize });
  const metadata = await compressInternal(new TextEncoder().encode(JSON.stringify(options.metadata ?? {})), c);
  const zooms = tiles.map((t) => t.z);
  const bounds = options.bounds ?? [-180, -85, 180, 85];
  const minZoom = options.minzoom ?? Math.min(...zooms);
  const header: Header = {
    specVersion: 3,
    rootDirectoryOffset: HEADER_BYTES,
    rootDirectoryLength: dirs.root.length,
    jsonMetadataOffset: HEADER_BYTES + dirs.root.length,
    jsonMetadataLength: metadata.length,
    leafDirectoryOffset: HEADER_BYTES + dirs.root.length + metadata.length,
    leafDirectoryLength: dirs.leaves.length,
    tileDataOffset: HEADER_BYTES + dirs.root.length + metadata.length + dirs.leaves.length,
    tileDataLength: dataBytes,
    numAddressedTiles: tiles.length,
    numTileEntries: entries.length,
    numTileContents: order.length,
    clustered: options.contentOrder !== 'reverse',
    internalCompression: c,
    tileCompression: Compression.None,
    tileType: TileType.Png,
    minZoom,
    maxZoom: options.maxzoom ?? Math.max(...zooms),
    minLon: bounds[0],
    minLat: bounds[1],
    maxLon: bounds[2],
    maxLat: bounds[3],
    centerZoom: minZoom,
    centerLon: (bounds[0] + bounds[2]) / 2,
    centerLat: (bounds[1] + bounds[3]) / 2,
  };
  const out = new Uint8Array(header.tileDataOffset + dataBytes);
  out.set(writeHeader(header), 0);
  out.set(dirs.root, header.rootDirectoryOffset);
  out.set(metadata, header.jsonMetadataOffset);
  out.set(dirs.leaves, header.leafDirectoryOffset);
  for (const k of order) out.set(data.get(k)!, header.tileDataOffset + offsets.get(k)!);
  return out;
}

/** A byte source over memory. Every read is recorded in `reads`. */
export function memorySource(bytes: Uint8Array, key = 'test'): Source & { reads: ByteRange[] } {
  const reads: ByteRange[] = [];
  return {
    reads,
    getKey: () => key,
    getBytes: async (offset: number, length: number) => {
      reads.push({ offset, length });
      return { data: bytes.slice(offset, Math.min(bytes.length, offset + length)).buffer as ArrayBuffer };
    },
  };
}

/** Every tile entry of an archive, walking the root and all leaves. Also returns the header. */
export async function allTileEntries(source: Source): Promise<{ header: Header; entries: Entry[]; leafDirectories: number }> {
  const read = async (offset: number, length: number) => new Uint8Array((await source.getBytes(offset, length)).data, 0, length);
  const header = readHeader(new Uint8Array((await source.getBytes(0, HEAD_READ_BYTES)).data));
  const entries: Entry[] = [];
  let leafDirectories = 0;
  const walk = async (offset: number, length: number): Promise<void> => {
    const dir = parseDirectory(await decompressInternal(await read(offset, length), header.internalCompression));
    for (const e of dir) {
      if (e.runLength > 0) entries.push(e);
      else {
        leafDirectories++;
        await walk(header.leafDirectoryOffset + e.offset, e.length);
      }
    }
  };
  await walk(header.rootDirectoryOffset, header.rootDirectoryLength);
  return { header, entries, leafDirectories };
}

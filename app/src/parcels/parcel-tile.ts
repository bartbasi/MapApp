// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Turns the bytes of one parcel tile into parcels: an allowlisted record and
// the outline rings in the tile's own units. Nothing is projected here; that
// happens per query, in a frame around the phone.

import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { toParcelRecord, type ParcelRecord } from './parcel-record';
import { tileKey, type TileId } from './tile-coords';
import type { Ring } from './planar';

/** The layer name inside a parcel tile (D27). */
export const PARCEL_TILE_LAYER = 'parcels';

/** One polygon feature of a parcel tile. */
export interface TileParcel {
  /**
   * What makes two pieces the same parcel: county and parcel ID. A feature
   * with no parcel ID gets a key of its own, so it is never merged with
   * another parcel.
   */
  key: string;
  record: ParcelRecord;
  /** Outer rings, holes and parts, flat, in tile units. Used by the even-odd rule. */
  rings: Ring[];
  /** The rings' bounding box in tile units. */
  bbox: [number, number, number, number];
}

export interface DecodedParcelTile {
  tile: TileId;
  /** The county of the archive the tile came from. */
  county: string;
  /** Tile units across the tile. */
  extent: number;
  parcels: TileParcel[];
}

export function parcelKey(county: string, pid: string): string {
  return `${county}|${pid}`;
}

function isGzip(b: Uint8Array): boolean {
  return b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;
}

/**
 * The tile's bytes, ungzipped if they arrive gzipped. The pmtiles reader
 * normally hands over uncompressed tiles already (the tile protocol passes
 * them straight to the map), so this only acts on a gzip header.
 */
export async function decompressTile(data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!isGzip(bytes)) return bytes;
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decodes the parcels layer of a tile. Features that are not polygons are skipped. */
export function decodeParcelTile(bytes: Uint8Array, tile: TileId, county: string): DecodedParcelTile {
  const vt = new VectorTile(new PbfReader(bytes));
  const layer = vt.layers[PARCEL_TILE_LAYER];
  const out: DecodedParcelTile = { tile, county, extent: layer?.extent ?? 4096, parcels: [] };
  if (!layer) return out;
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 3) continue;
    const record = toParcelRecord(f.properties, county);
    const rings: Ring[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const line of f.loadGeometry()) {
      const flat: number[] = [];
      for (const p of line) {
        flat.push(p.x, p.y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      // The decoder repeats the first point at the end of a closed ring.
      const n = flat.length;
      if (n >= 4 && flat[0] === flat[n - 2] && flat[1] === flat[n - 1]) flat.length = n - 2;
      if (flat.length >= 6) rings.push(flat);
    }
    if (rings.length === 0) continue;
    const key = record.pid ? parcelKey(record.county, record.pid) :`${record.county}|#${tileKey(tile)}#${i}`;
    out.parcels.push({ key, record, rings, bbox: [minX, minY, maxX, maxY] });
  }
  return out;
}

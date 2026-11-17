// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The fixed 127-byte PMTiles v3 header. Reading uses the pmtiles library's
// parser; writing is here. All numbers are little-endian. Offsets and counts
// are 64-bit, positions are 32-bit integers of degrees times 10,000,000.

import { bytesToHeader, type Header } from 'pmtiles';

export type { Header };

export const HEADER_BYTES = 127;
/** The header and the root directory must lie inside this many bytes from the start. */
export const HEAD_READ_BYTES = 16384;

const MAGIC = 'PMTiles';

/** Parses the header at the start of `bytes`, which must hold at least 127 bytes. */
export function readHeader(bytes: Uint8Array): Header {
  if (bytes.length < HEADER_BYTES) throw new Error('too few bytes for a PMTiles header');
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) throw new Error('not a PMTiles archive');
  }
  if (bytes[7] !== 3) throw new Error(`PMTiles spec version ${bytes[7]} is not supported`);
  return bytesToHeader(bytes.slice(0, HEADER_BYTES).buffer);
}

function setUint64(v: DataView, at: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`header value out of range: ${value}`);
  v.setUint32(at, value % 0x100000000, true);
  v.setUint32(at + 4, Math.floor(value / 0x100000000), true);
}

function setDegrees(v: DataView, at: number, deg: number): void {
  v.setInt32(at, Math.round(deg * 1e7), true);
}

/** Writes a header. Missing optional lengths are written as 0. */
export function writeHeader(h: Header): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES);
  const v = new DataView(bytes.buffer);
  for (let i = 0; i < MAGIC.length; i++) bytes[i] = MAGIC.charCodeAt(i);
  bytes[7] = 3;
  setUint64(v, 8, h.rootDirectoryOffset);
  setUint64(v, 16, h.rootDirectoryLength);
  setUint64(v, 24, h.jsonMetadataOffset);
  setUint64(v, 32, h.jsonMetadataLength);
  setUint64(v, 40, h.leafDirectoryOffset);
  setUint64(v, 48, h.leafDirectoryLength ?? 0);
  setUint64(v, 56, h.tileDataOffset);
  setUint64(v, 64, h.tileDataLength ?? 0);
  setUint64(v, 72, h.numAddressedTiles);
  setUint64(v, 80, h.numTileEntries);
  setUint64(v, 88, h.numTileContents);
  bytes[96] = h.clustered ? 1 : 0;
  bytes[97] = h.internalCompression;
  bytes[98] = h.tileCompression;
  bytes[99] = h.tileType;
  bytes[100] = h.minZoom;
  bytes[101] = h.maxZoom;
  setDegrees(v, 102, h.minLon);
  setDegrees(v, 106, h.minLat);
  setDegrees(v, 110, h.maxLon);
  setDegrees(v, 114, h.maxLat);
  bytes[118] = h.centerZoom;
  setDegrees(v, 119, h.centerLon);
  setDegrees(v, 123, h.centerLat);
  return bytes;
}

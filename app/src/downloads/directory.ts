// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// PMTiles v3 directories, uncompressed: the entry count, then the tile ID
// deltas, run lengths, lengths and offsets of every entry, each column as
// varints. An offset is written as 0 when the entry starts right where the
// previous one ends, and as offset + 1 otherwise. A run length of 0 marks an
// entry that points to a leaf directory.

import type { Entry } from 'pmtiles';
import { readVarint, writeVarint } from './varint';

export type { Entry };

/** Serializes entries, which must be in strictly increasing tile ID order. */
export function serializeDirectory(entries: readonly Entry[]): Uint8Array {
  const out: number[] = [];
  writeVarint(out, entries.length);
  let lastId = 0;
  entries.forEach((e, i) => {
    if (i > 0 && e.tileId <= lastId) throw new RangeError(`directory entries out of order at tile ID ${e.tileId}`);
    writeVarint(out, e.tileId - lastId);
    lastId = e.tileId;
  });
  for (const e of entries) writeVarint(out, e.runLength);
  for (const e of entries) writeVarint(out, e.length);
  entries.forEach((e, i) => {
    const prev = entries[i - 1];
    writeVarint(out, prev && e.offset === prev.offset + prev.length ? 0 : e.offset + 1);
  });
  return Uint8Array.from(out);
}

/** Parses an uncompressed directory. */
export function parseDirectory(bytes: Uint8Array): Entry[] {
  const p = { buf: bytes, pos: 0 };
  const n = readVarint(p);
  const entries: Entry[] = [];
  let lastId = 0;
  for (let i = 0; i < n; i++) {
    lastId += readVarint(p);
    entries.push({ tileId: lastId, offset: 0, length: 0, runLength: 1 });
  }
  for (const e of entries) e.runLength = readVarint(p);
  for (const e of entries) e.length = readVarint(p);
  entries.forEach((e, i) => {
    const v = readVarint(p);
    const prev = entries[i - 1];
    e.offset = v === 0 && prev ? prev.offset + prev.length : v - 1;
  });
  return entries;
}

// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Unsigned LEB128 varints, as PMTiles v3 directories store them. Values up to
// 2^53 are exact; arithmetic is used instead of bit operators, which would cut
// numbers to 32 bits.

/** Appends one varint to `out`. */
export function writeVarint(out: number[], value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`varint out of range: ${value}`);
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

/** A read position in a byte buffer. */
export interface ReadPosition {
  buf: Uint8Array;
  pos: number;
}

/** Reads one varint at `p.pos` and moves past it. */
export function readVarint(p: ReadPosition): number {
  let result = 0;
  let scale = 1;
  for (let i = 0; i < 10; i++) {
    const b = p.buf[p.pos++];
    if (b === undefined) throw new RangeError('varint runs past the end of the buffer');
    result += (b & 0x7f) * scale;
    if (b < 0x80) return result;
    scale *= 0x80;
  }
  throw new RangeError('varint longer than 10 bytes');
}

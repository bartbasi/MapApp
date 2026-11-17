// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Lays a list of tile entries out as a root directory and, when the root
// would not fit beside the header in the first 16,384 bytes, a set of leaf
// directories. The split follows the method of the PMTiles reference writer:
// leaves of at least 4,096 entries, grown by a fifth until the root fits.

import type { Compression } from 'pmtiles';
import { HEADER_BYTES, HEAD_READ_BYTES } from './archive-header';
import { serializeDirectory, type Entry } from './directory';
import { compressInternal } from './internal-compression';

export interface DirectoryLayout {
  /** The root directory, compressed. */
  root: Uint8Array;
  /** All leaf directories, compressed and joined, in tile ID order. Empty when there are none. */
  leaves: Uint8Array;
  leafCount: number;
}

/** The most bytes the compressed root may take. */
export const MAX_ROOT_BYTES = HEAD_READ_BYTES - HEADER_BYTES;

async function withLeaves(entries: readonly Entry[], leafSize: number, c: Compression): Promise<DirectoryLayout> {
  const rootEntries: Entry[] = [];
  const parts: Uint8Array[] = [];
  let leafBytes = 0;
  for (let i = 0; i < entries.length; i += leafSize) {
    const chunk = entries.slice(i, i + leafSize);
    const leaf = await compressInternal(serializeDirectory(chunk), c);
    rootEntries.push({ tileId: chunk[0]!.tileId, offset: leafBytes, length: leaf.length, runLength: 0 });
    parts.push(leaf);
    leafBytes += leaf.length;
  }
  const leaves = new Uint8Array(leafBytes);
  let at = 0;
  for (const p of parts) {
    leaves.set(p, at);
    at += p.length;
  }
  return { root: await compressInternal(serializeDirectory(rootEntries), c), leaves, leafCount: parts.length };
}

/**
 * Builds the directories for `entries` (tile entries only, in tile ID order).
 * `leafSize` forces leaves of that many entries, for tests.
 */
export async function layoutDirectories(
  entries: readonly Entry[],
  c: Compression,
  options: { leafSize?: number } = {},
): Promise<DirectoryLayout> {
  if (options.leafSize !== undefined) return withLeaves(entries, options.leafSize, c);
  const root = await compressInternal(serializeDirectory(entries), c);
  if (root.length <= MAX_ROOT_BYTES) return { root, leaves: new Uint8Array(0), leafCount: 0 };
  let leafSize = Math.max(4096, entries.length / 3500);
  for (;;) {
    const layout = await withLeaves(entries, Math.floor(leafSize), c);
    if (layout.root.length <= MAX_ROOT_BYTES) return layout;
    leafSize *= 1.2;
  }
}

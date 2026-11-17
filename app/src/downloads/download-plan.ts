// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The shape of every map data download, whole archive or picked area: write
// `head`, then fetch each byte range of the hosted file in order and append
// it. The downloader needs to know nothing else.

import type { Bounds } from '../map/tile-math';

/** A byte range of the hosted file. */
export interface ByteRange {
  offset: number;
  length: number;
}

export interface DownloadPlan {
  /** Bytes that start the new file, written before any range. May be empty. */
  head: Uint8Array;
  /** Ranges of the hosted file, appended in this order. Ascending and non-overlapping. */
  ranges: ByteRange[];
  /** The size of the finished file: head plus every range. */
  bytes: number;
  /**
   * The hosted file's ETag when the plan was made, if the server gave one.
   * The plan is only valid for that version of the file.
   */
  etag?: string;
}

/** A plan for the tiles of one area, made by `planExtract`. */
export interface ExtractPlan extends DownloadPlan {
  /** Tiles the new archive answers for, counting each tile of a run. */
  addressedTiles: number;
  /** Directory entries for tiles in the new archive. */
  tileEntries: number;
  /** Distinct tile contents stored in the new archive. */
  tileContents: number;
  minzoom: number;
  maxzoom: number;
  /** The area written into the new header: the request clipped to the archive's own bounds. */
  bounds: Bounds;
  /** Bytes of tile data in the new archive (the sum of the ranges). */
  tileDataBytes: number;
  /** Leaf directories in the new archive. */
  leafDirectories: number;
  /** True if the new archive's tile data is in tile ID order, as the header's clustered flag says. */
  clustered: boolean;
  /** Reads of the hosted file the planner made: header and root, metadata if apart, leaf directories. */
  sourceReads: number;
}

/** The plan for downloading a hosted file whole. */
export function planWholeArchive(totalBytes: number, etag?: string): DownloadPlan {
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) throw new RangeError(`bad file size ${totalBytes}`);
  const plan: DownloadPlan = {
    head: new Uint8Array(0),
    ranges: totalBytes > 0 ? [{ offset: 0, length: totalBytes }] : [],
    bytes: totalBytes,
  };
  if (etag !== undefined) plan.etag = etag;
  return plan;
}

/** What merging ranges separated by at most `gap` bytes would give. */
export interface GapTradeoff {
  gap: number;
  requests: number;
  /** Unused bytes that would be downloaded and kept in the file. */
  extraBytes: number;
}

export interface RangeReport {
  /** HTTP requests the ranges need, one per range. */
  requests: number;
  /** Bytes fetched from the hosted file. */
  rangeBytes: number;
  smallestRange: number;
  medianRange: number;
  largestRange: number;
  /** Requests and wasted bytes if nearby ranges were merged, per gap size. */
  tradeoff: GapTradeoff[];
}

export const REPORT_GAPS: readonly number[] = [1024, 4096, 16384, 65536, 262144];

/** How many requests a plan needs, and what merging nearby ranges would save. */
export function rangeReport(plan: DownloadPlan, gaps: readonly number[] = REPORT_GAPS): RangeReport {
  const lengths = plan.ranges.map((r) => r.length).sort((a, b) => a - b);
  const tradeoff = gaps.map((gap) => {
    let requests = 0;
    let extraBytes = 0;
    let end = -Infinity;
    for (const r of plan.ranges) {
      const between = r.offset - end;
      if (between >= 0 && between <= gap) extraBytes += between;
      else requests++;
      end = r.offset + r.length;
    }
    return { gap, requests, extraBytes };
  });
  return {
    requests: plan.ranges.length,
    rangeBytes: lengths.reduce((a, b) => a + b, 0),
    smallestRange: lengths[0] ?? 0,
    medianRange: lengths[lengths.length >> 1] ?? 0,
    largestRange: lengths[lengths.length - 1] ?? 0,
    tradeoff,
  };
}

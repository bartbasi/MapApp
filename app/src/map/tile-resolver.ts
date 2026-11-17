// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Answers "tile z/x/y of layer L" from whichever installed archive has it.
//
// The map has one source per layer, however many counties are installed. A
// tile request is tried against each archive of that layer in order, skipping
// archives whose bounds or zoom range rule the tile out, and the first archive
// that has the tile answers. The archive contract guarantees whole tiles (a
// tile is never clipped to a county line), so the first hit is the right one.

import { boundsOverlap, tileBounds, type Bounds } from './tile-math';

/** One archive as the resolver sees it. */
export interface TileArchive {
  /** For messages only, such as "il-champaign/basemap" (archive-meta.ts archiveLabel). */
  readonly id: string;
  readonly layer: string;
  readonly county: string;
  /** The downloaded area the archive belongs to, if it did not come with the app. */
  readonly area?: string;
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly bounds: Bounds;
  /** The tile's bytes, uncompressed, or undefined if the archive does not hold it. */
  getTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer | undefined>;
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

export class TileResolver {
  private byLayer = new Map<string, TileArchive[]>();

  /** Replaces the archive list. Order matters: earlier archives answer first. */
  setArchives(archives: readonly TileArchive[]): void {
    const next = new Map<string, TileArchive[]>();
    for (const a of archives) {
      const list = next.get(a.layer) ?? [];
      list.push(a);
      next.set(a.layer, list);
    }
    this.byLayer = next;
  }

  /**
   * The archives that could hold this tile, in the order they are tried.
   * With a county, only one archive of the layer is considered: that county's
   * archive of the given area, or with no area, the one that came with the app.
   */
  candidates(layer: string, z: number, x: number, y: number, county?: string, area?: string): TileArchive[] {
    const list = this.byLayer.get(layer);
    if (!list) return [];
    const tb = tileBounds(z, x, y);
    return list.filter(
      (a) => (county === undefined || (a.county === county && a.area === area)) && z >= a.minzoom && z <= a.maxzoom && boundsOverlap(a.bounds, tb),
    );
  }

  /**
   * The tile from the first archive that has it, or undefined if none does.
   * If an archive fails to read, the next one is tried. The error is thrown
   * only when no archive could answer, so one bad file does not blank the map
   * where another covers it.
   */
  async getTile(layer: string, z: number, x: number, y: number, signal?: AbortSignal, county?: string, area?: string): Promise<ArrayBuffer | undefined> {
    let firstError: unknown;
    for (const archive of this.candidates(layer, z, x, y, county, area)) {
      signal?.throwIfAborted();
      try {
        const data = await archive.getTile(z, x, y, signal);
        if (data !== undefined) return data;
      } catch (e) {
        if (isAbort(e)) throw e;
        console.warn(`tile ${z}/${x}/${y} could not be read from ${archive.id}:`, e);
        firstError ??= e;
      }
    }
    if (firstError !== undefined) throw firstError;
    return undefined;
  }
}

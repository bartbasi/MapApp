// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Turns what the user asked for into one plan per hosted archive (D33):
//
// - A rectangle: every hosted archive of a requested layer whose bounds
//   overlap it, cut to the rectangle by the extract planner. Each costs one or
//   two small reads of the hosted file's directories.
// - A whole county: each requested layer's file whole, with the catalog's own
//   size and no reads. The one exception is imagery at less than its full
//   detail, which is cut from the hosted file like a rectangle (the county's
//   bounds), so the user's detail choice holds there too.
//
// An archive whose plan holds no tile is left out.
//
// Parcel data is never planned, even when asked for and even when a catalog
// lists it (catalog.ts refusal() gives the reasons). So no archive planned
// here carries a coverage outline, and an area's copy never claims one.

import { layerTitle } from '../map/installed';
import { boundsOverlap, unionBounds, type Bounds } from '../map/tile-math';
import type { ArchiveMeta } from '../platform/archive-meta';
import { refusal } from './catalog';
import type { AreaEstimate, AreaRequest, Catalog, CatalogArchive, LayerEstimate, RemoteFiles } from './contract';
import { planWholeArchive, type DownloadPlan } from './download-plan';
import { planExtract } from './extract-planner';
import { RemoteSource, type ReadCache } from './remote-source';

/** The layer whose detail the request can lower. */
export const AERIAL_LAYER = 'aerial';

/** One file of a planned request. */
export interface PlannedFile {
  archive: CatalogArchive;
  /** The hosted file's address. */
  url: string;
  plan: DownloadPlan;
  /** True when the file is taken whole (its checksum is then checked). */
  whole: boolean;
  /** The metadata of the archive the phone will hold. */
  meta: ArchiveMeta;
  /** Tiles in the new archive; 0 for a whole file, whose directories are not read. */
  tiles: number;
}

export interface RequestPlan {
  /** Same key, same plan: see requestKey(). */
  key: string;
  release: string;
  files: PlannedFile[];
  estimate: AreaEstimate;
  /** The rectangle downloaded, or the county's bounds. */
  bounds: Bounds;
  county?: string;
}

/** Checks a request's shape. Throws RangeError on a bad one. */
export function checkRequest(request: AreaRequest): void {
  if (!request || typeof request !== 'object') throw new RangeError('no request');
  if (!Array.isArray(request.layers) || request.layers.some((l) => typeof l !== 'string')) throw new RangeError('layers must be a list of layer names');
  if (!Number.isInteger(request.aerialMaxzoom) || request.aerialMaxzoom < 0 || request.aerialMaxzoom > 30) {
    throw new RangeError(`bad imagery detail ${String(request.aerialMaxzoom)}`);
  }
  const where = request.where as { bounds?: unknown; county?: unknown };
  if (where && 'bounds' in where) {
    const b = where.bounds;
    if (!Array.isArray(b) || b.length !== 4 || !b.every((x) => typeof x === 'number' && Number.isFinite(x))) throw new RangeError('bounds must be four numbers');
    const [w, s, e, n] = b as number[];
    if (!(w! < e! && s! < n! && w! >= -180 && e! <= 180 && s! >= -85.06 && n! <= 85.06)) throw new RangeError(`bad area ${JSON.stringify(b)}`);
  } else if (!where || typeof where.county !== 'string') {
    throw new RangeError('the request names neither a rectangle nor a county');
  }
}

/** A key that is equal for two requests exactly when they download the same thing from the same release. */
export function requestKey(request: AreaRequest, release: string): string {
  const where = 'bounds' in request.where ? { bounds: request.where.bounds } : { county: request.where.county };
  return JSON.stringify({ release, where, layers: [...new Set(request.layers)].sort(), aerialMaxzoom: request.aerialMaxzoom });
}

/**
 * The metadata of an area's copy of a hosted archive: the plan's bounds,
 * zooms and size. Never a coverage outline: an outline says where the data
 * speaks for every place, which a cut-down copy cannot (see the top of this file).
 */
export function extractMeta(source: ArchiveMeta, plan: { bounds: Bounds; minzoom: number; maxzoom: number; bytes: number }): ArchiveMeta {
  const meta: ArchiveMeta = { ...source, bounds: [...plan.bounds], minzoom: plan.minzoom, maxzoom: plan.maxzoom, bytes: plan.bytes };
  delete meta.coverage;
  return meta;
}

/** How planning reads the hosted files. */
export interface PlanReads {
  remote: RemoteFiles;
  signal?: AbortSignal;
  /** Directory reads kept between plans (remote-source.ts). */
  cache?: ReadCache;
}

async function planCut(archive: CatalogArchive, url: string, bounds: Bounds, maxzoom: number | undefined, release: string, reads: PlanReads): Promise<PlannedFile | null> {
  const source = new RemoteSource(reads.remote, url, archive.bytes, {
    ...(reads.signal ? { signal: reads.signal } : {}),
    ...(reads.cache ? { cache: { cache: reads.cache, release } } : {}),
  });
  const plan = await planExtract(source, maxzoom === undefined ? { bounds } : { bounds, maxzoom });
  if (plan.addressedTiles === 0) return null;
  return { archive, url, plan, whole: false, meta: extractMeta(archive.meta, plan), tiles: plan.addressedTiles };
}

/** The detail to cut a layer to, or null when the request's detail is below everything the archive has. */
function layerMaxzoom(archive: CatalogArchive, request: AreaRequest): number | undefined | null {
  if (archive.layer !== AERIAL_LAYER) return undefined;
  if (request.aerialMaxzoom < archive.meta.minzoom) return null;
  return request.aerialMaxzoom;
}

/** True when planning the request reads the hosted files, so it needs a connection. */
export function requestNeedsReads(catalog: Catalog, request: AreaRequest): boolean {
  if ('bounds' in request.where) return true;
  const county = request.where.county;
  return catalog.archives.some((a) => {
    if (a.county !== county || !request.layers.includes(a.layer) || refusal(a) !== null) return false;
    const maxzoom = layerMaxzoom(a, request);
    return maxzoom !== null && maxzoom !== undefined && maxzoom < a.meta.maxzoom;
  });
}

/**
 * Plans a request against the catalog. Reads only directories, and only for a
 * rectangle or for imagery at reduced detail. Parcel data is never planned:
 * asked for, it is named as missing.
 */
export async function planRequest(catalog: Catalog, request: AreaRequest, remote: RemoteFiles | PlanReads, signal?: AbortSignal): Promise<RequestPlan> {
  checkRequest(request);
  const reads: PlanReads = 'remote' in remote ? remote : { remote, ...(signal ? { signal } : {}) };
  reads.signal?.throwIfAborted();
  const wanted = new Set(request.layers);
  const release = catalog.release;
  // The catalog was checked already; this keeps the rule however the catalog was made.
  const archives = catalog.archives.filter((a) => refusal(a) === null);
  const urlOf = (a: CatalogArchive) => catalog.base + a.file;
  let bounds: Bounds;
  let county: string | undefined;
  let jobs: Promise<PlannedFile | null>[];

  if ('bounds' in request.where) {
    bounds = [...request.where.bounds];
    const rect = bounds;
    jobs = archives
      .filter((a) => wanted.has(a.layer) && boundsOverlap(a.meta.bounds, rect))
      .map((a) => {
        const maxzoom = layerMaxzoom(a, request);
        return maxzoom === null ? Promise.resolve(null) : planCut(a, urlOf(a), rect, maxzoom, release, reads);
      });
  } else {
    county = request.where.county;
    const own = archives.filter((a) => a.county === county);
    bounds = unionBounds(own.map((a) => a.meta.bounds)) ?? [0, 0, 0, 0];
    jobs = own
      .filter((a) => wanted.has(a.layer))
      .map((a) => {
        const maxzoom = layerMaxzoom(a, request);
        if (maxzoom === null) return Promise.resolve(null);
        if (maxzoom !== undefined && maxzoom < a.meta.maxzoom) return planCut(a, urlOf(a), a.meta.bounds, maxzoom, release, reads);
        const file: PlannedFile = { archive: a, url: urlOf(a), plan: planWholeArchive(a.bytes), whole: true, meta: a.meta, tiles: 0 };
        return Promise.resolve(file);
      });
  }

  const files = (await Promise.all(jobs)).filter((f): f is PlannedFile => f !== null);
  reads.signal?.throwIfAborted();
  const layers: LayerEstimate[] = files.map((f) => ({
    county: f.archive.county,
    layer: f.archive.layer,
    title: layerTitle({ county: f.archive.county, layer: f.archive.layer, meta: f.archive.meta }),
    bytes: f.plan.bytes,
    tiles: f.tiles,
  }));
  const have = new Set(files.map((f) => f.archive.layer));
  const estimate: AreaEstimate = {
    bytes: files.reduce((n, f) => n + f.plan.bytes, 0),
    layers,
    missing: [...wanted].filter((l) => !have.has(l)),
  };
  const out: RequestPlan = { key: requestKey(request, catalog.release), release: catalog.release, files, estimate, bounds };
  if (county !== undefined) out.county = county;
  return out;
}

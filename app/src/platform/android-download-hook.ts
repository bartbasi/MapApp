// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// Test builds only (VITE_MAPAPP_DOWNLOAD_HOOK=1): a handle on
// window.__mapappDownloads to drive the native downloader from the WebView's
// DevTools console, with plans made by the real planner, before the download
// screens exist. Nothing here runs in an ordinary build.
//
//   const d = window.__mapappDownloads
//   await d.planExtract(url, [w, s, e, n], maxzoom)   the plan, head as base64
//   await d.startArea(id, record, files)              plans and starts an area
//   d.events                                          every change event seen
//   d.network                                         every network event seen

import type { RangeResponse, Source } from 'pmtiles';
import type { AreaState, FileJob, NetworkState } from '../downloads/contract';
import { planWholeArchive, type DownloadPlan } from '../downloads/download-plan';
import { planExtract } from '../downloads/extract-planner';
import type { Bounds } from '../map/tile-math';
import { toBase64 } from './base64';
import type { DownloadParts } from './platform';

/** A hosted file read through the shell, for the planner. */
function remoteSource(parts: DownloadParts, url: string): Source {
  return {
    getKey: () => url,
    async getBytes(offset, length, signal): Promise<RangeResponse> {
      const r = await parts.remote.read(url, offset, length, signal);
      const out: RangeResponse = { data: r.data };
      if (r.etag !== undefined) out.etag = r.etag;
      return out;
    },
  };
}

/** One file to plan: a box of an archive, or the whole archive. */
interface FileOrder {
  county: string;
  layer: string;
  url: string;
  kind: 'extract' | 'whole';
  bounds?: Bounds;
  maxzoom?: number;
  /** Whole archive: its size and checksum, as the catalog gives them. */
  bytes?: number;
  sha256?: string;
  /** The meta.json text to write beside the finished file. */
  meta: string;
}

function describe(plan: DownloadPlan) {
  return {
    head: toBase64(plan.head),
    headBytes: plan.head.length,
    ranges: plan.ranges.map((r) => [r.offset, r.length]),
    bytes: plan.bytes,
    etag: plan.etag ?? null,
  };
}

export function installDownloadHook(parts: DownloadParts): void {
  const events: { t: number; state: AreaState }[] = [];
  const network: { t: number; state: NetworkState }[] = [];
  parts.jobs.onChange((state) => {
    events.push({ t: Date.now(), state });
    if (events.length > 5000) events.splice(0, 1000);
  });
  parts.network.onChange((state) => network.push({ t: Date.now(), state }));

  async function plan(order: FileOrder): Promise<DownloadPlan> {
    if (order.kind === 'whole') {
      if (order.bytes === undefined) throw new Error('a whole file needs its size');
      // The ETag of the hosted file, from one small read, so the job can insist on it.
      const first = await parts.remote.read(order.url, 0, 16, undefined);
      return planWholeArchive(order.bytes, first.etag);
    }
    if (!order.bounds) throw new Error('an extract needs bounds');
    return planExtract(remoteSource(parts, order.url), { bounds: order.bounds, ...(order.maxzoom !== undefined ? { maxzoom: order.maxzoom } : {}) });
  }

  const handle = {
    parts,
    events,
    network,
    async planExtract(url: string, bounds: Bounds, maxzoom?: number) {
      const p = await planExtract(remoteSource(parts, url), { bounds, ...(maxzoom !== undefined ? { maxzoom } : {}) });
      return describe(p);
    },
    /** Plans every file, starts the area, and returns the plans for checking. */
    async startArea(id: string, record: string, orders: FileOrder[]) {
      const files: FileJob[] = [];
      const plans = [];
      for (const o of orders) {
        const p = await plan(o);
        const f: FileJob = { county: o.county, layer: o.layer, url: o.url, head: p.head, ranges: p.ranges, bytes: p.bytes, meta: o.meta };
        if (p.etag !== undefined) f.etag = p.etag;
        if (o.sha256 !== undefined) f.sha256 = o.sha256;
        files.push(f);
        plans.push({ county: o.county, layer: o.layer, ...describe(p) });
      }
      await parts.jobs.start({ id, record, files });
      return plans;
    },
    list: () => parts.jobs.list(),
    pause: (id: string) => parts.jobs.pause(id),
    resume: (id: string) => parts.jobs.resume(id),
    remove: (id: string) => parts.jobs.remove(id),
    freeBytes: () => parts.jobs.freeBytes(),
    networkNow: () => parts.network.get(),
  };
  Object.assign(window, { __mapappDownloads: handle });
  console.info('download test hook installed on window.__mapappDownloads');
}

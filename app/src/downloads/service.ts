// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// The download manager: DownloadService (contract.ts) on top of the platform's
// RemoteFiles, DownloadJobs and Network (D33). It owns the catalog, the
// planning of a request and the area records. The platform's downloader does
// the byte work and knows nothing of maps.

import type { DownloadParts } from '../platform/platform';
import { compareAreaIdsNewestFirst, makeAreaId, parseAreaRecord } from './area-record';
import { buildCatalogUrl, loadStoredCatalog, localCatalogStorage, parseCatalogText, type CatalogStorage } from './catalog';
import type {
  AreaEstimate,
  AreaJob,
  AreaRecord,
  AreaRequest,
  AreaState,
  AreaView,
  Catalog,
  CountyOffer,
  DownloadService,
  FileJob,
  NetworkState,
} from './contract';
import { CatalogUnavailableError, CatalogUnsupportedError, NotEnoughSpaceError, NothingToDownloadError, OfflineError, isAbortError } from './errors';
import { checkRequest, planRequest, requestKey, requestNeedsReads, type RequestPlan } from './request-plan';
import { ReadCache, raceAbort } from './remote-source';
import { unionBounds } from '../map/tile-math';

/** Space left free on the phone after a download, on top of its own size. */
export const SPACE_MARGIN_BYTES = 50 * 1024 * 1024;

/** A catalog fetched this long ago is fetched again before it is used. */
export const CATALOG_MAX_AGE_MS = 10 * 60 * 1000;

export interface DownloadServiceOptions {
  /** Defaults to the build's VITE_MAPAPP_CATALOG_URL, else the repository's catalog. */
  catalogUrl?: string;
  /** Where the last good catalog is kept. Defaults to the browser's local storage. */
  storage?: CatalogStorage;
  /** Accept an http base address in the catalog. Defaults to true in a development build only (catalog.ts). */
  allowHttp?: boolean;
  /** Directory reads kept between estimates. A new one is made when left out. */
  readCache?: ReadCache;
  /** For tests. */
  now?: () => number;
  random?: () => number;
}

/** The service, plus what tests and the app's start-up need. */
export interface DownloadManager extends DownloadService {
  /** Settles once the first list of areas and the first network state are in. */
  readonly ready: Promise<void>;
  /** Stops listening to the platform. */
  dispose(): void;
}

type Listener<T> = (value: T) => void;

function emit<T>(listeners: Set<Listener<T>>, value: T): void {
  for (const l of [...listeners]) {
    try {
      l(value);
    } catch (e) {
      console.error('a download listener failed:', e);
    }
  }
}

function subscribe<T>(listeners: Set<Listener<T>>, l: Listener<T>): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The newest data date among the files' sources. */
function newestDataDate(plan: RequestPlan): string {
  let best = '';
  for (const f of plan.files) for (const s of f.meta.sources) if (s.dataDate > best) best = s.dataDate;
  return best;
}

/**
 * One file of the job. A whole file carries its SHA-256 and no ETag, on
 * purpose: the checksum is the real guard, checked when the file is complete,
 * and pinning an ETag would cost one more read through the release host's
 * redirect for each file, against addresses whose ETag behaviour on the real
 * host is not tested yet (D33). A release's files never change, so a changed
 * whole file is a fault the checksum reports as 'corrupt'. An extract keeps
 * the ETag its plan was made from, because its head was built from the
 * hosted file's directories and is wrong for any other version of it.
 */
function fileJob(file: RequestPlan['files'][number]): FileJob {
  const job: FileJob = {
    county: file.archive.county,
    layer: file.archive.layer,
    url: file.url,
    head: file.plan.head,
    ranges: file.plan.ranges,
    bytes: file.plan.bytes,
    meta: JSON.stringify(file.meta),
  };
  if (file.plan.etag !== undefined) job.etag = file.plan.etag;
  if (file.whole) job.sha256 = file.archive.sha256;
  return job;
}

export function createDownloadService(parts: DownloadParts, options: DownloadServiceOptions = {}): DownloadManager {
  const { remote, jobs, network } = parts;
  const catalogUrl = options.catalogUrl ?? buildCatalogUrl();
  const storage = options.storage ?? localCatalogStorage;
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;

  // ------------------------------------------------------------ state
  let catalog: Catalog | null = null;
  let catalogFetchedAt = -Infinity;
  let catalogFetch: Promise<Catalog> | null = null;
  /** The plans of the latest estimate, reused by start() for the same request. */
  let lastPlan: RequestPlan | null = null;
  /** Directory reads of the hosted files, kept for the life of the service (remote-source.ts). */
  const reads = options.readCache ?? new ReadCache();
  let cachedRelease: string | null = null;
  /** An http base is accepted only from the same http origin as the catalog, outside development. */
  const catalogChecks = { catalogUrl, ...(options.allowHttp !== undefined ? { allowHttp: options.allowHttp } : {}) };

  let net: NetworkState = { online: true, metered: false };
  const states = new Map<string, AreaState>();
  /** Areas removed through this service: late progress reports for them are ignored. */
  const removed = new Set<string>();
  let views: readonly AreaView[] = [];

  const areaListeners = new Set<Listener<readonly AreaView[]>>();
  const archiveListeners = new Set<Listener<void>>();
  const networkListeners = new Set<Listener<NetworkState>>();

  // ------------------------------------------------------------ areas
  function rebuildViews(): void {
    const list: AreaView[] = [...states.values()].map((s) => {
      const view: AreaView = {
        record: parseAreaRecord(s.record, s.id).record,
        status: s.status,
        allowMetered: s.allowMetered === true,
        bytesDone: s.bytesDone,
        bytesTotal: s.bytesTotal,
      };
      if (s.error !== undefined) view.error = s.error;
      if (s.status === 'waiting' && s.waitingFor !== undefined) view.waitingFor = s.waitingFor;
      return view;
    });
    list.sort((a, b) => (a.record.created < b.record.created ? 1 : a.record.created > b.record.created ? -1 : compareAreaIdsNewestFirst(a.record.id, b.record.id)));
    views = list;
    emit(areaListeners, views);
  }

  /** Takes in a new state. Returns true when the map's archives changed. */
  function absorb(state: AreaState): boolean {
    const before = states.get(state.id);
    states.set(state.id, { ...state });
    return state.status === 'complete' && before?.status !== 'complete';
  }

  /** Brings the states in line with the downloader's list: new areas, changed ones and ones gone. */
  async function refresh(): Promise<void> {
    const list = await jobs.list();
    let archivesChanged = false;
    const listed = new Set<string>();
    for (const s of list) {
      if (removed.has(s.id)) continue;
      listed.add(s.id);
      if (absorb(s)) archivesChanged = true;
    }
    for (const [id, s] of states) {
      if (!listed.has(id)) {
        states.delete(id);
        if (s.status === 'complete') archivesChanged = true;
      }
    }
    rebuildViews();
    if (archivesChanged) emit(archiveListeners, undefined);
  }

  const offJobs = jobs.onChange((state) => {
    if (removed.has(state.id)) return;
    const changed = absorb(state);
    rebuildViews();
    if (changed) emit(archiveListeners, undefined);
  });
  const offNetwork = network.onChange((state) => {
    net = { ...state };
    emit(networkListeners, net);
  });

  const ready = (async () => {
    const [list, state] = await Promise.all([
      jobs.list().catch((e: unknown) => {
        console.warn('the list of downloaded areas could not be read:', e);
        return [] as AreaState[];
      }),
      network.get().catch(() => net),
    ]);
    // Areas already complete at start-up are on the map already: no change event.
    for (const s of list) if (!removed.has(s.id) && !states.has(s.id)) states.set(s.id, { ...s });
    rebuildViews();
    net = { ...state };
    emit(networkListeners, net);
  })();

  // ------------------------------------------------------------ catalog
  async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
    const text = await remote.text(catalogUrl, signal);
    const parsed = parseCatalogText(text, catalogChecks);
    storage.save(text);
    return parsed;
  }

  function useCatalog(c: Catalog): Catalog {
    // Reads of an older release are of no use once the catalog has moved on.
    if (cachedRelease !== c.release) reads.clear();
    cachedRelease = c.release;
    catalog = c;
    return c;
  }

  function storedCatalog(): Catalog | null {
    return catalog ?? loadStoredCatalog(storage, catalogChecks);
  }

  /**
   * The catalog: fresh if it can be had, else the last good one, else
   * CatalogUnavailableError. A catalog of a schema this app cannot read gives
   * CatalogUnsupportedError, with no fallback to the kept copy: a new schema
   * means the publisher meant older apps to stop, and the user must update.
   */
  async function getCatalog(signal?: AbortSignal): Promise<Catalog> {
    if (catalog && now() - catalogFetchedAt < CATALOG_MAX_AGE_MS) return catalog;
    if (net.online) {
      try {
        catalogFetch ??= fetchCatalog().finally(() => (catalogFetch = null));
        const fresh = await raceAbort(catalogFetch, signal);
        catalogFetchedAt = now();
        return useCatalog(fresh);
      } catch (e) {
        if (isAbortError(e) || e instanceof CatalogUnsupportedError) throw e;
        console.warn('the catalog could not be fetched:', (e as Error).message);
        const kept = storedCatalog();
        if (kept) return useCatalog(kept);
        throw new CatalogUnavailableError('The list of downloads could not be fetched.', { cause: e });
      }
    }
    const kept = storedCatalog();
    if (kept) return useCatalog(kept);
    throw new CatalogUnavailableError('The list of downloads needs a connection the first time.');
  }

  /** Plans a request, turning a failed read with no connection into OfflineError. */
  async function plan(request: AreaRequest, signal?: AbortSignal): Promise<RequestPlan> {
    const cat = await getCatalog(signal);
    const key = requestKey(request, cat.release);
    if (lastPlan?.key === key) return lastPlan;
    if (!net.online && requestNeedsReads(cat, request)) throw new OfflineError();
    try {
      const p = await planRequest(cat, request, { remote, cache: reads, ...(signal ? { signal } : {}) });
      lastPlan = p;
      return p;
    } catch (e) {
      if (isAbortError(e) || e instanceof RangeError) throw e;
      const state = await network.get().catch(() => net);
      if (!state.online) throw new OfflineError();
      throw e;
    }
  }

  // ------------------------------------------------------------ the service
  return {
    ready,

    async offers(signal) {
      const cat = await getCatalog(signal);
      const byCounty = new Map<string, CountyOffer>();
      for (const a of cat.archives) {
        let offer = byCounty.get(a.county);
        if (!offer) {
          offer = { county: a.county, countyName: a.meta.countyName, bounds: [...a.meta.bounds], layers: [] };
          byCounty.set(a.county, offer);
        }
        offer.bounds = unionBounds([offer.bounds, a.meta.bounds]) ?? offer.bounds;
        offer.layers.push({ layer: a.layer, title: a.meta.title, bytes: a.bytes, maxzoom: a.meta.maxzoom });
      }
      return [...byCounty.values()];
    },

    async estimate(request, signal) {
      checkRequest(request);
      return (await plan(request, signal)).estimate;
    },

    async start(request, name, startOptions) {
      checkRequest(request);
      if (!net.online) throw new OfflineError();
      const p = await plan(request);
      if (p.files.length === 0) throw new NothingToDownloadError();
      const free = await jobs.freeBytes();
      const needed = p.estimate.bytes + SPACE_MARGIN_BYTES;
      if (free !== undefined && free < needed) throw new NotEnoughSpaceError(needed, free);

      const created = now();
      const id = makeAreaId(created, random);
      const countyName = p.county !== undefined ? p.files[0]?.archive.meta.countyName : undefined;
      const record: AreaRecord = {
        id,
        name: name.trim() || countyName || 'Area',
        bounds: p.bounds,
        layers: [...new Set(p.files.map((f) => f.archive.layer))],
        aerialMaxzoom: request.aerialMaxzoom,
        created: new Date(created).toISOString(),
        release: p.release,
        dataDate: newestDataDate(p),
        bytes: p.estimate.bytes,
      };
      if (p.county !== undefined) record.county = p.county;
      // Mobile data only when the user was asked and said yes (S1, D33).
      const job: AreaJob = { id, record: JSON.stringify(record), files: p.files.map(fileJob), allowMetered: startOptions?.allowMetered === true };
      await jobs.start(job);
      // The downloader reports the new area through onChange; the list makes sure.
      await refresh().catch((e: unknown) => console.warn('the list of areas could not be read:', e));
      return id;
    },

    async pause(id) {
      await jobs.pause(id);
      await refresh();
    },

    async resume(id) {
      if (!net.online) throw new OfflineError();
      await jobs.resume(id);
      await refresh();
    },

    async setAllowMetered(id, allow) {
      await jobs.setAllowMetered(id, allow);
      await refresh();
    },

    async remove(id) {
      removed.add(id);
      const was = states.get(id);
      try {
        await jobs.remove(id);
      } catch (e) {
        removed.delete(id);
        throw e;
      }
      states.delete(id);
      rebuildViews();
      if (was?.status === 'complete') emit(archiveListeners, undefined);
    },

    areas: () => views,
    onAreas: (l) => subscribe(areaListeners, l),
    onArchivesChanged: (l) => subscribe(archiveListeners, () => l()),
    network: () => net,
    onNetwork: (l) => subscribe(networkListeners, l),
    freeBytes: () => jobs.freeBytes(),

    dispose() {
      offJobs();
      offNetwork();
      areaListeners.clear();
      archiveListeners.clear();
      networkListeners.clear();
    },
  };
}

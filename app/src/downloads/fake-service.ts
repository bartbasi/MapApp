// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

// A download service that lives in memory and downloads nothing. It is for
// development and tests only: the download screens can be opened against it in
// a browser and put into every status and every error, for screenshots and for
// checks. The real service is the manager in this folder (D33).
//
// Open the app with ?fakeDownloads to use it, in a development build only:
//   ?fakeDownloads            nothing downloaded yet
//   ?fakeDownloads=states     one download in each status and each error
//   ?fakeDownloads=county     Macon County downloaded and complete
//   &fakeNet=offline|metered  the network the screens see
//   &fakeFree=<MB>            free space on the phone
//   &fakeSpeed=<MB a second>  how fast a download moves (default 2)
//   &fakeCatalog=none         the list of counties was never fetched
//   &fakeEstimate=fail        every size fails, as when the server does not answer
// In the browser console, window.__mapappDownloads is the service, with the
// controls below (setNetwork, setFree, failNext, fail, complete, setProgress).

import type { Bounds } from '../map/tile-math';
import type {
  AreaError,
  AreaEstimate,
  AreaRecord,
  AreaRequest,
  AreaStatus,
  AreaView,
  CountyOffer,
  DownloadService,
  LayerEstimate,
  NetworkState,
} from './contract';

const MB = 1024 * 1024;

/** The two counties as the catalog lists them, with the sizes of the built archives of 2026-11-17. */
export const FAKE_OFFERS: readonly CountyOffer[] = [
  {
    county: 'il-champaign',
    countyName: 'Champaign County',
    bounds: [-88.4637, 39.879, -87.9287, 40.4007],
    layers: [
      { layer: 'basemap', title: 'Base map', bytes: 12035805, maxzoom: 15 },
      { layer: 'publicland', title: 'Public land', bytes: 132841, maxzoom: 14 },
      { layer: 'aerial', title: 'Aerial imagery', bytes: 225572890, maxzoom: 16 },
    ],
  },
  {
    county: 'il-macon',
    countyName: 'Macon County',
    bounds: [-89.2179, 39.6526, -88.745, 40.0554],
    layers: [
      { layer: 'basemap', title: 'Base map', bytes: 4271625, maxzoom: 15 },
      { layer: 'publicland', title: 'Public land', bytes: 99815, maxzoom: 14 },
      { layer: 'aerial', title: 'Aerial imagery', bytes: 140565035, maxzoom: 16 },
    ],
  },
];

/** The newest source date of each layer, as the archives' meta files give it. */
const DATA_DATES: Readonly<Record<string, string>> = { basemap: '2026-11-12', publicland: '2025-03-31', aerial: '2025-09-15' };
const RELEASE = 'data-2026-11-17';

/**
 * MB a square km, measured on a 10 km box of Macon County (D33): 1.7 MB of
 * base map, and 22.7, about 8.1 and 2.9 MB of imagery at zoom 16, 15 and 14.
 */
const DENSITY: Readonly<Record<string, number>> = { basemap: 0.017, publicland: 0.0012 };
const IMAGERY_DENSITY: Readonly<Record<number, number>> = { 16: 0.227, 15: 0.081, 14: 0.029 };

export type FakeScenario = 'none' | 'states' | 'county';

export interface FakeOptions {
  scenario?: FakeScenario;
  network?: NetworkState;
  /** Free space in bytes; undefined means the platform cannot tell. */
  freeBytes?: number | undefined;
  /** Bytes a second while downloading. */
  speed?: number;
  /** How long a size takes to work out, in ms. */
  estimateMs?: number;
  /** How often progress moves, in ms. 0 stops the clock (for tests, which call tick()). */
  tickMs?: number;
  /** The list of counties was never fetched, so offers() fails while offline. */
  noCatalog?: boolean;
  /** Every estimate fails with a plain error, as when the server does not answer. */
  failEstimates?: boolean;
}

interface FakeArea {
  record: AreaRecord;
  request: AreaRequest;
  status: AreaStatus;
  error?: AreaError;
  bytesDone: number;
  /** Fail with this error once this many bytes are done. */
  failAt?: { bytes: number; error: AreaError };
}

/** An error with the service's own error name, as the real service gives (errors.ts). */
function codedError(code: 'offline' | 'no-space' | 'nothing' | 'catalog-unavailable', message: string, extra: object = {}): Error {
  return Object.assign(new Error(message), { code }, extra);
}

/** Room the real service keeps free beside a download (service.ts). */
const SPACE_MARGIN = 50 * MB;

function abortError(): Error {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function overlapKm2(a: Bounds, b: Bounds): number {
  const w = Math.max(a[0], b[0]);
  const s = Math.max(a[1], b[1]);
  const e = Math.min(a[2], b[2]);
  const n = Math.min(a[3], b[3]);
  if (e <= w || n <= s) return 0;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  return (e - w) * 111.32 * Math.cos(midLat) * (n - s) * 110.574;
}

export class FakeDownloadService implements DownloadService {
  private list: FakeArea[] = [];
  private net: NetworkState;
  private free: number | undefined;
  private speed: number;
  private readonly estimateMs: number;
  private catalogFetched: boolean;
  private failEstimates: boolean;
  private nextId = 1;
  private nextFailure: { error: AreaError; fraction: number } | null = null;
  private readonly areaListeners = new Set<(a: readonly AreaView[]) => void>();
  private readonly archiveListeners = new Set<() => void>();
  private readonly netListeners = new Set<(n: NetworkState) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private views: readonly AreaView[] = [];

  constructor(options: FakeOptions = {}) {
    this.net = options.network ?? { online: true, metered: false };
    this.free = 'freeBytes' in options ? options.freeBytes : 9.6 * 1024 * MB;
    this.speed = options.speed ?? 2 * MB;
    this.estimateMs = options.estimateMs ?? 700;
    this.catalogFetched = !options.noCatalog;
    this.failEstimates = options.failEstimates ?? false;
    const tickMs = options.tickMs ?? 500;
    if (tickMs > 0) this.timer = setInterval(() => this.tick(tickMs / 1000), tickMs);
    this.seed(options.scenario ?? 'none');
    this.views = this.makeViews();
  }

  // ------------------------------------------------------------ DownloadService

  async offers(signal?: AbortSignal): Promise<CountyOffer[]> {
    await this.wait(300, signal);
    if (!this.net.online && !this.catalogFetched) throw codedError('catalog-unavailable', 'The list of downloads needs a connection the first time.');
    this.catalogFetched = true;
    return FAKE_OFFERS.map((o) => ({ ...o, layers: o.layers.map((l) => ({ ...l })) }));
  }

  async estimate(request: AreaRequest, signal?: AbortSignal): Promise<AreaEstimate> {
    await this.wait(this.estimateMs, signal);
    if (!this.net.online) throw codedError('offline', 'There is no connection.');
    if (this.failEstimates) throw new Error('the server did not answer');
    return this.sizeOf(request);
  }

  async start(request: AreaRequest, name: string): Promise<string> {
    if (!this.net.online) throw codedError('offline', 'There is no connection.');
    const est = this.sizeOf(request);
    if (est.bytes === 0) throw codedError('nothing', 'There is no map data to download for this place and these layers.');
    const needed = est.bytes + SPACE_MARGIN;
    if (this.free !== undefined && this.free < needed) throw codedError('no-space', 'Not enough space.', { neededBytes: needed, freeBytes: this.free });
    const id = `area-${this.nextId++}`;
    const county = 'county' in request.where ? request.where.county : undefined;
    const offer = county ? FAKE_OFFERS.find((o) => o.county === county) : undefined;
    const bounds: Bounds = 'bounds' in request.where ? request.where.bounds : (offer?.bounds ?? [0, 0, 0, 0]);
    const record: AreaRecord = {
      id,
      name,
      bounds,
      ...(county ? { county } : {}),
      layers: [...request.layers],
      aerialMaxzoom: request.aerialMaxzoom,
      created: new Date().toISOString(),
      release: RELEASE,
      dataDate: newestDate(request.layers),
      bytes: est.bytes,
    };
    const area: FakeArea = { record, request, status: 'queued', bytesDone: 0 };
    if (this.nextFailure) {
      area.failAt = { bytes: Math.floor(est.bytes * this.nextFailure.fraction), error: this.nextFailure.error };
      this.nextFailure = null;
    }
    this.list.push(area);
    this.schedule();
    this.changed();
    return id;
  }

  async pause(id: string): Promise<void> {
    const a = this.find(id);
    if (!a || a.status === 'complete' || a.status === 'failed') return;
    a.status = 'paused';
    this.schedule();
    this.changed();
  }

  async resume(id: string): Promise<void> {
    if (!this.net.online) throw codedError('offline', 'There is no connection.');
    const a = this.find(id);
    if (!a || (a.status !== 'paused' && a.status !== 'failed')) return;
    if (a.status === 'failed' && a.error === 'no-space' && this.free !== undefined && this.free < a.record.bytes - a.bytesDone) {
      // Still not enough room: it stops again at once, as a real phone would.
      this.changed();
      return;
    }
    delete a.error;
    delete a.failAt;
    a.status = 'queued';
    this.schedule();
    this.changed();
  }

  async remove(id: string): Promise<void> {
    const a = this.find(id);
    if (!a) return;
    this.list = this.list.filter((x) => x !== a);
    if (this.free !== undefined) this.free += a.bytesDone;
    this.schedule();
    this.changed();
    if (a.status === 'complete') this.archivesChanged();
  }

  areas(): readonly AreaView[] {
    return this.views;
  }

  onAreas(listener: (areas: readonly AreaView[]) => void): () => void {
    this.areaListeners.add(listener);
    return () => this.areaListeners.delete(listener);
  }

  onArchivesChanged(listener: () => void): () => void {
    this.archiveListeners.add(listener);
    return () => this.archiveListeners.delete(listener);
  }

  network(): NetworkState {
    return this.net;
  }

  onNetwork(listener: (state: NetworkState) => void): () => void {
    this.netListeners.add(listener);
    return () => this.netListeners.delete(listener);
  }

  async freeBytes(): Promise<number | undefined> {
    return this.free;
  }

  // ------------------------------------------------------------ controls for development and tests

  setNetwork(state: NetworkState): void {
    this.net = { ...state };
    for (const l of this.netListeners) l(this.net);
    this.schedule();
    this.changed();
  }

  setFree(bytes: number | undefined): void {
    this.free = bytes;
  }

  setFailEstimates(fail: boolean): void {
    this.failEstimates = fail;
  }

  setSpeed(bytesPerSecond: number): void {
    this.speed = bytesPerSecond;
  }

  /** The next download started fails with this error, this far through. */
  failNext(error: AreaError, fraction = 0.3): void {
    this.nextFailure = { error, fraction };
  }

  /** Fails a download now. */
  fail(id: string, error: AreaError): void {
    const a = this.find(id);
    if (!a) return;
    a.status = 'failed';
    a.error = error;
    this.schedule();
    this.changed();
  }

  complete(id: string): void {
    const a = this.find(id);
    if (!a) return;
    a.bytesDone = a.record.bytes;
    a.status = 'complete';
    delete a.error;
    this.schedule();
    this.changed();
    this.archivesChanged();
  }

  setProgress(id: string, fraction: number): void {
    const a = this.find(id);
    if (!a) return;
    a.bytesDone = Math.floor(a.record.bytes * Math.min(1, Math.max(0, fraction)));
    this.changed();
  }

  /** Moves the running download on by this many seconds of downloading. */
  tick(seconds: number): void {
    const a = this.list.find((x) => x.status === 'downloading');
    if (!a) return;
    let step = Math.floor(this.speed * seconds);
    if (a.failAt && a.bytesDone + step >= a.failAt.bytes) {
      step = Math.max(0, a.failAt.bytes - a.bytesDone);
      this.write(a, step);
      a.status = 'failed';
      a.error = a.failAt.error;
      delete a.failAt;
      this.schedule();
      this.changed();
      return;
    }
    if (this.free !== undefined && step > this.free) {
      this.write(a, this.free);
      a.status = 'failed';
      a.error = 'no-space';
      this.schedule();
      this.changed();
      return;
    }
    this.write(a, Math.min(step, a.record.bytes - a.bytesDone));
    if (a.bytesDone >= a.record.bytes) {
      a.status = 'complete';
      this.schedule();
      this.changed();
      this.archivesChanged();
      return;
    }
    this.changed();
  }

  destroy(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  // ------------------------------------------------------------ inside

  private write(a: FakeArea, bytes: number): void {
    a.bytesDone += bytes;
    if (this.free !== undefined) this.free = Math.max(0, this.free - bytes);
  }

  /** One download runs at a time, the oldest first; the others wait their turn. Offline, the running one waits. */
  private schedule(): void {
    const running = this.list.find((a) => a.status === 'downloading' || a.status === 'waiting');
    if (running) {
      running.status = this.net.online ? 'downloading' : 'waiting';
      return;
    }
    const next = this.list.find((a) => a.status === 'queued');
    if (next) next.status = this.net.online ? 'downloading' : 'waiting';
  }

  private find(id: string): FakeArea | undefined {
    return this.list.find((a) => a.record.id === id);
  }

  private sizeOf(request: AreaRequest): AreaEstimate {
    const layers: LayerEstimate[] = [];
    const found = new Set<string>();
    for (const offer of FAKE_OFFERS) {
      const where = request.where;
      const whole = 'county' in where;
      if ('county' in where && where.county !== offer.county) continue;
      const km2 = 'bounds' in request.where ? overlapKm2(request.where.bounds, offer.bounds) : Infinity;
      if (km2 <= 0) continue;
      for (const l of offer.layers) {
        if (!request.layers.includes(l.layer)) continue;
        const density = l.layer === 'aerial' ? (IMAGERY_DENSITY[request.aerialMaxzoom] ?? 0.227) : (DENSITY[l.layer] ?? 0.01);
        const bytes = whole ? l.bytes : Math.min(l.bytes, Math.round(km2 * density * MB));
        if (bytes <= 0) continue;
        found.add(l.layer);
        layers.push({ county: offer.county, layer: l.layer, title: l.title, bytes, tiles: Math.max(1, Math.round(bytes / 20000)) });
      }
    }
    return {
      bytes: layers.reduce((s, l) => s + l.bytes, 0),
      layers,
      missing: request.layers.filter((l) => !found.has(l)),
    };
  }

  private wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(abortError());
      });
    });
  }

  private makeViews(): readonly AreaView[] {
    return [...this.list]
      .sort((a, b) => (a.record.created < b.record.created ? 1 : a.record.created > b.record.created ? -1 : 0))
      .map((a) => ({
        record: a.record,
        status: a.status,
        ...(a.error ? { error: a.error } : {}),
        bytesDone: a.bytesDone,
        bytesTotal: a.record.bytes,
      }));
  }

  private changed(): void {
    this.views = this.makeViews();
    for (const l of this.areaListeners) l(this.views);
  }

  private archivesChanged(): void {
    for (const l of this.archiveListeners) l();
  }

  private seed(scenario: FakeScenario): void {
    if (scenario === 'none') return;
    const add = (name: string, request: AreaRequest, status: AreaStatus, fraction: number, created: string, error?: AreaError) => {
      const est = this.sizeOf(request);
      const id = `area-${this.nextId++}`;
      const county = 'county' in request.where ? request.where.county : undefined;
      const bounds = 'bounds' in request.where ? request.where.bounds : (FAKE_OFFERS.find((o) => o.county === county)?.bounds ?? [0, 0, 0, 0]);
      this.list.push({
        record: { id, name, bounds, ...(county ? { county } : {}), layers: request.layers, aerialMaxzoom: request.aerialMaxzoom, created, release: RELEASE, dataDate: newestDate(request.layers), bytes: est.bytes },
        request,
        status,
        ...(error ? { error } : {}),
        bytesDone: Math.floor(est.bytes * fraction),
      });
    };
    const all = ['basemap', 'publicland', 'aerial'];
    add('Macon County', { where: { county: 'il-macon' }, layers: all, aerialMaxzoom: 16 }, 'complete', 1, '2026-11-10T07:00:00Z');
    if (scenario === 'county') return;
    // Small areas in Macon County, around Warrensburg and Lake Decatur.
    const box = (lng: number, lat: number, dLng: number, dLat: number): Bounds => [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
    add('North timber', { where: { bounds: box(-89.06, 39.93, 0.03, 0.02) }, layers: all, aerialMaxzoom: 16 }, 'downloading', 0.45, '2026-11-17T06:10:00Z');
    add('Creek bottom', { where: { bounds: box(-88.98, 39.86, 0.025, 0.018) }, layers: all, aerialMaxzoom: 15 }, 'queued', 0, '2026-11-17T06:09:00Z');
    add('Champaign County', { where: { county: 'il-champaign' }, layers: ['basemap', 'publicland'], aerialMaxzoom: 16 }, 'paused', 0.3, '2026-11-17T06:08:00Z');
    add('Lake shore', { where: { bounds: box(-88.91, 39.82, 0.02, 0.015) }, layers: all, aerialMaxzoom: 14 }, 'waiting', 0.6, '2026-11-17T06:07:00Z');
    const errors: AreaError[] = ['changed', 'no-space', 'server', 'corrupt', 'other'];
    errors.forEach((error, i) => {
      add(`Stand ${i + 1}`, { where: { bounds: box(-89.12 + i * 0.05, 39.75, 0.015, 0.012) }, layers: all, aerialMaxzoom: 16 }, 'failed', 0.2 + i * 0.1, `2026-11-16T0${i}:00:00Z`, error);
    });
    // A record the phone could not read, as the real service shows one: no name, no place, no layers.
    const id = `area-${this.nextId++}`;
    this.list.push({
      record: { id, name: '', bounds: [0, 0, 0, 0], layers: [], aerialMaxzoom: 0, created: '2026-11-15T00:00:00Z', release: '', dataDate: '', bytes: 3 * MB },
      request: { where: { bounds: [0, 0, 0, 0] }, layers: [], aerialMaxzoom: 0 },
      status: 'failed',
      error: 'other',
      bytesDone: MB,
    });
    this.schedule();
  }
}

function newestDate(layers: readonly string[]): string {
  return layers.map((l) => DATA_DATES[l] ?? '').filter(Boolean).sort().pop() ?? '';
}

/** The fake's options from the page address, or null when the page did not ask for the fake. */
export function fakeOptionsFrom(search: string): FakeOptions | null {
  const q = new URLSearchParams(search);
  if (!q.has('fakeDownloads')) return null;
  const scenario = q.get('fakeDownloads');
  const net = q.get('fakeNet');
  const free = q.get('fakeFree');
  const speed = q.get('fakeSpeed');
  return {
    scenario: scenario === 'states' || scenario === 'county' ? scenario : 'none',
    network: net === 'offline' ? { online: false, metered: false } : net === 'metered' ? { online: true, metered: true } : { online: true, metered: false },
    ...(free !== null ? { freeBytes: Number(free) * MB } : {}),
    ...(speed !== null ? { speed: Number(speed) * MB } : {}),
    noCatalog: q.get('fakeCatalog') === 'none',
    failEstimates: q.get('fakeEstimate') === 'fail',
  };
}

export function createFakeDownloadService(options: FakeOptions): FakeDownloadService {
  const service = new FakeDownloadService(options);
  if (typeof window !== 'undefined') Object.assign(window, { __mapappDownloads: service });
  return service;
}
